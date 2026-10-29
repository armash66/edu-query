"""Application service for the interactive academic investigation engine."""
from __future__ import annotations

import csv
import io
from typing import Any

import duckdb

from app.api.schemas.investigation import (
    FieldCapability,
    InvestigationCapabilitiesResponse,
    InvestigationCondition,
    InvestigationFilterGroup,
    InvestigationOperator,
    InvestigationQueryRequest,
    InvestigationQueryResponse,
)
from app.api.schemas.student import StudentSummaryItem
from app.reports.student_breakdown import (
    StudentSubjectCounts,
    escape_like_pattern,
    get_students_subject_counts_batch,
)
from app.services.export_service import sanitize_csv_cell

# Maximum allowed conditions to prevent complex DoS queries
MAX_CONDITIONS = 10

ALLOWED_SORT_COLUMNS = {
    "student_id": "student_id",
    "name": "name",
    "roll_no": "roll_no",
    "seat_no": "seat_no",
    "division": "division",
    "total_marks": "total_marks",
    "sgpi": "sgpi",
    "cgpa": "cgpa",
    "result": "result",
}


def get_investigation_capabilities(con: duckdb.DuckDBPyConnection) -> InvestigationCapabilitiesResponse:
    """Discover dataset capabilities, available divisions, courses, and score bounds."""
    # Discover divisions
    div_rows = con.execute(
        "SELECT DISTINCT division FROM students WHERE division IS NOT NULL AND TRIM(division) != '' ORDER BY division"
    ).fetchall()
    divisions = [str(r[0]) for r in div_rows]

    # Discover results / outcomes
    res_rows = con.execute(
        "SELECT DISTINCT result FROM students WHERE result IS NOT NULL AND TRIM(result) != '' ORDER BY result"
    ).fetchall()
    results = [str(r[0]) for r in res_rows]

    # Discover courses
    course_rows = con.execute(
        "SELECT DISTINCT code FROM courses WHERE code IS NOT NULL ORDER BY code"
    ).fetchall()
    courses = [str(r[0]) for r in course_rows]

    # Discover marks / bounds
    bounds_row = con.execute(
        "SELECT MIN(total_marks), MAX(total_marks), MIN(sgpi), MAX(sgpi), MIN(cgpa), MAX(cgpa) FROM students"
    ).fetchone()

    min_marks = float(bounds_row[0]) if bounds_row and bounds_row[0] is not None else 0.0
    max_marks = float(bounds_row[1]) if bounds_row and bounds_row[1] is not None else 1000.0
    min_sgpi = float(bounds_row[2]) if bounds_row and bounds_row[2] is not None else 0.0
    max_sgpi = float(bounds_row[3]) if bounds_row and bounds_row[3] is not None else 10.0
    min_cgpa = float(bounds_row[4]) if bounds_row and bounds_row[4] is not None else 0.0
    max_cgpa = float(bounds_row[5]) if bounds_row and bounds_row[5] is not None else 10.0

    # Discover absent components
    comp_rows = con.execute(
        """
        SELECT DISTINCT component 
        FROM scores 
        WHERE component != 'TOT1' 
          AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
               OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
        ORDER BY component
        """
    ).fetchall()
    absent_components = [str(r[0]) for r in comp_rows if r[0]]

    fields: list[FieldCapability] = [
        FieldCapability(
            field="division",
            label="Division",
            data_type="choice",
            supported_operators=["eq", "neq", "in"],
            choices=divisions,
        ),
        FieldCapability(
            field="result",
            label="Academic Outcome",
            data_type="choice",
            supported_operators=["eq", "neq", "in"],
            choices=results if results else ["Passed", "Failed", "Unresolved"],
        ),
        FieldCapability(
            field="course_code",
            label="Enrolled Subject",
            data_type="choice",
            supported_operators=["eq", "neq", "in"],
            choices=courses,
        ),
        FieldCapability(
            field="failed_subject_count",
            label="Confirmed Failed Subjects",
            data_type="number",
            supported_operators=["gte", "lte", "eq"],
            min_value=0.0,
            max_value=20.0,
        ),
        FieldCapability(
            field="multi_fails",
            label="Failing 2+ Subjects",
            data_type="boolean",
            supported_operators=["eq"],
        ),
        FieldCapability(
            field="has_absent",
            label="Has Absent Marks",
            data_type="boolean",
            supported_operators=["eq"],
        ),
        FieldCapability(
            field="absent_subject_count",
            label="Absent Subject Count",
            data_type="number",
            supported_operators=["gte", "lte", "eq"],
            min_value=0.0,
            max_value=20.0,
        ),
        FieldCapability(
            field="absent_course_code",
            label="Absent in Subject",
            data_type="choice",
            supported_operators=["eq", "neq", "in"],
            choices=courses,
        ),
        FieldCapability(
            field="absent_component",
            label="Absent in Component",
            data_type="choice",
            supported_operators=["eq", "neq", "in"],
            choices=absent_components,
        ),
        FieldCapability(
            field="total_marks",
            label="Total Marks",
            data_type="number",
            supported_operators=["gte", "lte", "eq", "between"],
            min_value=min_marks,
            max_value=max_marks,
        ),
        FieldCapability(
            field="sgpi",
            label="SGPI",
            data_type="number",
            supported_operators=["gte", "lte", "eq", "between"],
            min_value=min_sgpi,
            max_value=max_sgpi,
        ),
        FieldCapability(
            field="cgpa",
            label="CGPA",
            data_type="number",
            supported_operators=["gte", "lte", "eq", "between"],
            min_value=min_cgpa,
            max_value=max_cgpa,
        ),
        FieldCapability(
            field="name",
            label="Student Name",
            data_type="string",
            supported_operators=["contains", "eq"],
        ),
        FieldCapability(
            field="student_id",
            label="Student ID / Roll / Seat",
            data_type="string",
            supported_operators=["contains", "eq"],
        ),
    ]

    return InvestigationCapabilitiesResponse(
        status="success",
        fields=fields,
        max_conditions=MAX_CONDITIONS,
        supported_logic=["AND", "OR"],
    )


def _build_condition_sql(
    cond: InvestigationCondition,
) -> tuple[str, list[object], str]:
    """Translate a single InvestigationCondition into parameterized SQL and an explanation."""
    field = cond.field
    op = cond.operator
    val = cond.value

    # Subquery for multi-fails
    fails_subquery = """
        SELECT student_id
        FROM reconciliation
        WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
          AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
        GROUP BY student_id
        HAVING COUNT(DISTINCT course_code)
    """

    if field == "division":
        if op == "eq":
            return "UPPER(TRIM(division)) = UPPER(TRIM(?))", [str(val)], f"Division is '{val}'"
        elif op == "neq":
            return "UPPER(TRIM(division)) != UPPER(TRIM(?))", [str(val)], f"Division is not '{val}'"
        elif op == "in" and isinstance(val, list) and val:
            placeholders = ", ".join(["UPPER(TRIM(?))"] * len(val))
            params = [str(x) for x in val]
            return f"UPPER(TRIM(division)) IN ({placeholders})", params, f"Division in [{', '.join(params)}]"

    elif field == "result":
        val_str = str(val).upper().strip()
        if "FAIL" in val_str:
            if op == "eq":
                return "UPPER(TRIM(result)) LIKE '%FAIL%'", [], "Outcome is 'FAILED'"
            elif op == "neq":
                return "NOT (UPPER(TRIM(result)) LIKE '%FAIL%')", [], "Outcome is not 'FAILED'"
        elif "PASS" in val_str:
            if op == "eq":
                return "UPPER(TRIM(result)) LIKE '%PASS%'", [], "Outcome is 'PASSED'"
            elif op == "neq":
                return "NOT (UPPER(TRIM(result)) LIKE '%PASS%')", [], "Outcome is not 'PASSED'"
        if op == "eq":
            return "UPPER(TRIM(result)) = UPPER(TRIM(?))", [str(val)], f"Outcome is '{val}'"
        elif op == "neq":
            return "UPPER(TRIM(result)) != UPPER(TRIM(?))", [str(val)], f"Outcome is not '{val}'"
        elif op == "in" and isinstance(val, list) and val:
            placeholders = ", ".join(["UPPER(TRIM(?))"] * len(val))
            params = [str(x) for x in val]
            return f"UPPER(TRIM(result)) IN ({placeholders})", params, f"Outcome in [{', '.join(params)}]"

    elif field == "course_code":
        if op == "eq":
            return (
                "student_id IN (SELECT student_id FROM enrollment WHERE UPPER(course_code) = UPPER(?))",
                [str(val)],
                f"Enrolled in course '{val}'",
            )
        elif op == "neq":
            return (
                "student_id NOT IN (SELECT student_id FROM enrollment WHERE UPPER(course_code) = UPPER(?))",
                [str(val)],
                f"Not enrolled in course '{val}'",
            )
        elif op == "in" and isinstance(val, list) and val:
            placeholders = ", ".join(["UPPER(?)"] * len(val))
            params = [str(x) for x in val]
            return (
                f"student_id IN (SELECT student_id FROM enrollment WHERE UPPER(course_code) IN ({placeholders}))",
                params,
                f"Enrolled in any course in [{', '.join(params)}]",
            )

    elif field == "multi_fails":
        bool_val = bool(val) if not isinstance(val, str) else val.lower() in ("true", "1", "yes")
        if bool_val:
            return (
                f"student_id IN ({fails_subquery} >= 2)",
                [],
                "Failing 2 or more subjects",
            )
        else:
            return (
                f"student_id NOT IN ({fails_subquery} >= 2)",
                [],
                "Failing fewer than 2 subjects",
            )

    elif field == "failed_subject_count":
        try:
            num = int(val)
        except (ValueError, TypeError):
            num = 0
        if op == "gte":
            return f"student_id IN ({fails_subquery} >= ?)", [num], f"Failed subjects >= {num}"
        elif op == "lte":
            return f"student_id IN ({fails_subquery} <= ?)", [num], f"Failed subjects <= {num}"
        elif op == "eq":
            return f"student_id IN ({fails_subquery} = ?)", [num], f"Failed subjects = {num}"

    elif field == "has_absent":
        absent_students_subquery = """
            SELECT DISTINCT student_id FROM scores
            WHERE component != 'TOT1'
              AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                   OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
            UNION
            SELECT DISTINCT student_id FROM grades
            WHERE UPPER(TRIM(COALESCE(letter, ''))) IN ('AB', 'ABS', 'ABSENT')
        """
        bool_val = bool(val) if not isinstance(val, str) else val.lower() in ("true", "1", "yes")
        if bool_val:
            return (
                f"student_id IN ({absent_students_subquery})",
                [],
                "Has absent marks",
            )
        else:
            return (
                f"student_id NOT IN ({absent_students_subquery})",
                [],
                "Has no absent marks",
            )

    elif field == "absent_subject_count":
        try:
            num = int(val)
        except (ValueError, TypeError):
            num = 0

        absent_courses_subquery = """
            SELECT student_id, course_code FROM scores
            WHERE component != 'TOT1'
              AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                   OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
            UNION
            SELECT student_id, course_code FROM grades
            WHERE UPPER(TRIM(COALESCE(letter, ''))) IN ('AB', 'ABS', 'ABSENT')
        """
        absent_students_sub = """
            SELECT DISTINCT student_id FROM scores
            WHERE component != 'TOT1'
              AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                   OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
            UNION
            SELECT DISTINCT student_id FROM grades
            WHERE UPPER(TRIM(COALESCE(letter, ''))) IN ('AB', 'ABS', 'ABSENT')
        """
        grouped_sub = f"SELECT student_id FROM ({absent_courses_subquery}) GROUP BY student_id HAVING COUNT(DISTINCT course_code)"
        if op == "gte":
            if num <= 0:
                return "1=1", [], "Absent subjects >= 0"
            return f"student_id IN ({grouped_sub} >= ?)", [num], f"Absent subjects >= {num}"
        elif op == "lte":
            if num <= 0:
                return f"student_id NOT IN ({absent_students_sub})", [], "Absent subjects <= 0"
            return f"student_id NOT IN ({grouped_sub} > ?)", [num], f"Absent subjects <= {num}"
        elif op == "eq":
            if num == 0:
                return f"student_id NOT IN ({absent_students_sub})", [], "Absent subjects = 0"
            return f"student_id IN ({grouped_sub} = ?)", [num], f"Absent subjects = {num}"

    elif field == "absent_course_code":
        course_sub = """
            SELECT student_id FROM scores
            WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?))
              AND component != 'TOT1'
              AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                   OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
            UNION
            SELECT student_id FROM grades
            WHERE UPPER(TRIM(course_code)) = UPPER(TRIM(?))
              AND UPPER(TRIM(COALESCE(letter, ''))) IN ('AB', 'ABS', 'ABSENT')
        """
        if op == "eq":
            return f"student_id IN ({course_sub})", [str(val), str(val)], f"Absent in subject '{val}'"
        elif op == "neq":
            return f"student_id NOT IN ({course_sub})", [str(val), str(val)], f"Not absent in subject '{val}'"
        elif op == "in" and isinstance(val, list) and val:
            placeholders = ", ".join(["UPPER(TRIM(?))"] * len(val))
            params = [str(x) for x in val]
            course_in_sub = f"""
                SELECT student_id FROM scores
                WHERE UPPER(TRIM(course_code)) IN ({placeholders})
                  AND component != 'TOT1'
                  AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                       OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
                UNION
                SELECT student_id FROM grades
                WHERE UPPER(TRIM(course_code)) IN ({placeholders})
                  AND UPPER(TRIM(COALESCE(letter, ''))) IN ('AB', 'ABS', 'ABSENT')
            """
            return f"student_id IN ({course_in_sub})", params + params, f"Absent in any of [{', '.join(params)}]"

    elif field == "absent_component":
        comp_sub = """
            SELECT student_id FROM scores
            WHERE UPPER(TRIM(component)) = UPPER(TRIM(?))
              AND component != 'TOT1'
              AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                   OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
        """
        if op == "eq":
            return f"student_id IN ({comp_sub})", [str(val)], f"Absent in component '{val}'"
        elif op == "neq":
            return f"student_id NOT IN ({comp_sub})", [str(val)], f"Not absent in component '{val}'"
        elif op == "in" and isinstance(val, list) and val:
            placeholders = ", ".join(["UPPER(TRIM(?))"] * len(val))
            params = [str(x) for x in val]
            comp_in_sub = f"""
                SELECT student_id FROM scores
                WHERE UPPER(TRIM(component)) IN ({placeholders})
                  AND component != 'TOT1'
                  AND (UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                       OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT'))
            """
            return f"student_id IN ({comp_in_sub})", params, f"Absent in component in [{', '.join(params)}]"

    elif field in ("total_marks", "sgpi", "cgpa"):
        col = field
        label = "Total Marks" if field == "total_marks" else field.upper()
        if op == "between" and isinstance(val, (list, tuple)) and len(val) >= 2:
            try:
                low, high = float(val[0]), float(val[1])
                return f"{col} BETWEEN ? AND ?", [low, high], f"{label} between {low} and {high}"
            except (ValueError, TypeError):
                pass
        try:
            num = float(val)
        except (ValueError, TypeError):
            num = 0.0

        if op == "gte":
            return f"{col} >= ?", [num], f"{label} >= {num}"
        elif op == "lte":
            return f"{col} <= ?", [num], f"{label} <= {num}"
        elif op == "eq":
            return f"{col} = ?", [num], f"{label} = {num}"
        elif op == "neq":
            return f"{col} != ?", [num], f"{label} != {num}"

    elif field in ("name", "student_id", "seat_no", "roll_no"):
        col = field
        str_val = str(val).strip()
        label = "Name" if field == "name" else "Student ID" if field == "student_id" else field.replace("_", " ").title()
        if op == "contains":
            escaped = escape_like_pattern(str_val).lower()
            return f"LOWER({col}) LIKE ? ESCAPE '!'", [f"%{escaped}%"], f"{label} contains '{str_val}'"
        elif op == "eq":
            return f"LOWER(TRIM({col})) = LOWER(TRIM(?))", [str_val], f"{label} is '{str_val}'"

    # Default fallback: safe 1=1
    return "1=1", [], "All records"


def build_investigation_filter_sql(
    group: InvestigationFilterGroup | None,
    search: str | None = None,
) -> tuple[str, list[object], str]:
    """Compile an InvestigationFilterGroup and search query into safe parameterized SQL."""
    where_parts: list[str] = []
    params: list[object] = []
    explanations: list[str] = []

    # 1. Free-text search
    if search and search.strip():
        clean_q = search.strip()
        escaped = escape_like_pattern(clean_q).lower()
        like_pattern = f"%{escaped}%"
        where_parts.append(
            "(LOWER(name) LIKE ? ESCAPE '!' OR "
            "LOWER(student_id) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(seat_no, '')) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(roll_no, '')) LIKE ? ESCAPE '!')"
        )
        params.extend([like_pattern, like_pattern, like_pattern, like_pattern])
        explanations.append(f"Search matches '{clean_q}'")

    # 2. Condition group
    if group and group.conditions:
        cond_parts: list[str] = []
        cond_explanations: list[str] = []
        # Enforce max condition complexity
        valid_conditions = group.conditions[:MAX_CONDITIONS]

        for cond in valid_conditions:
            sql_clause, cond_params, expl = _build_condition_sql(cond)
            if sql_clause != "1=1":
                cond_parts.append(sql_clause)
                params.extend(cond_params)
                cond_explanations.append(expl)

        if cond_parts:
            logic_op = f" {group.logic} "
            grouped_sql = f"({logic_op.join(cond_parts)})"
            where_parts.append(grouped_sql)
            explanations.append(f"({logic_op.join(cond_explanations)})")

    if not where_parts:
        return "1=1", [], "All cohort students"

    full_where_sql = " AND ".join(where_parts)
    full_explanation = " AND ".join(explanations)
    return full_where_sql, params, f"Showing students where: {full_explanation}"


def execute_investigation_query(
    con: duckdb.DuckDBPyConnection,
    req: InvestigationQueryRequest,
) -> InvestigationQueryResponse:
    """Execute parameterized investigation query with live matching count and pagination."""
    where_sql, params, explanation = build_investigation_filter_sql(req.group, req.search)

    # Total cohort size
    cohort_row = con.execute("SELECT COUNT(*) FROM students").fetchone()
    cohort_total = int(cohort_row[0]) if cohort_row else 0

    # Matching records count
    count_sql = f"SELECT COUNT(*) FROM students WHERE {where_sql}"
    count_row = con.execute(count_sql, params).fetchone()
    total_matching = int(count_row[0]) if count_row else 0

    # Sorting
    sort_col = ALLOWED_SORT_COLUMNS.get(req.sort_by or "division", "division")
    sort_dir = "DESC" if req.sort_dir == "desc" else "ASC"
    order_clause = f"{sort_col} {sort_dir} NULLS LAST, student_id ASC"

    # Select query
    select_sql = f"""
        SELECT student_id, seat_no, roll_no, name, division, level,
               total_marks, result, sgpi, cgpa
        FROM students
        WHERE {where_sql}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
    """
    query_params = list(params) + [req.limit, req.offset]
    rows = con.execute(select_sql, query_params).fetchall()

    student_ids = [str(r[0]) for r in rows]
    subject_counts = get_students_subject_counts_batch(con, student_ids)

    items: list[StudentSummaryItem] = []
    for r in rows:
        sid = str(r[0])
        counts = subject_counts.get(sid, StudentSubjectCounts(0, 0, 0, 0))
        items.append(
            StudentSummaryItem(
                student_id=sid,
                seat_no=str(r[1]) if r[1] is not None else None,
                roll_no=str(r[2]) if r[2] is not None else None,
                name=str(r[3]),
                division=str(r[4]) if r[4] is not None else None,
                level=str(r[5]) if r[5] is not None else None,
                total_marks=float(r[6]) if r[6] is not None else None,
                overall_result=str(r[7]) if r[7] is not None else None,
                sgpi=float(r[8]) if r[8] is not None else None,
                cgpa=float(r[9]) if r[9] is not None else None,
                passed_subject_count=counts.passed,
                failed_subject_count=counts.failed,
                absent_subject_count=counts.absent,
                unresolved_subject_count=counts.unresolved,
            )
        )

    return InvestigationQueryResponse(
        total=total_matching,
        cohort_total=cohort_total,
        limit=req.limit,
        offset=req.offset,
        items=items,
        active_explanation=explanation,
    )


def export_investigation_csv(
    con: duckdb.DuckDBPyConnection,
    req: InvestigationQueryRequest,
) -> tuple[str, str]:
    """Generate unpaginated formula-safe CSV export for the full matching investigation result set."""
    where_sql, params, explanation = build_investigation_filter_sql(req.group, req.search)

    sort_col = ALLOWED_SORT_COLUMNS.get(req.sort_by or "division", "division")
    sort_dir = "DESC" if req.sort_dir == "desc" else "ASC"
    order_clause = f"{sort_col} {sort_dir} NULLS LAST, student_id ASC"

    select_sql = f"""
        SELECT student_id, name, roll_no, seat_no, division, level,
               total_marks, result, sgpi, cgpa, source_sheet, source_row
        FROM students
        WHERE {where_sql}
        ORDER BY {order_clause}
    """
    rows = con.execute(select_sql, params).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)

    writer.writerow(["# EduQuery V3 - Academic Investigation Export"])
    writer.writerow([f"# {explanation}"])
    writer.writerow([f"# Total Matching Records: {len(rows)}"])
    writer.writerow([])
    writer.writerow([
        "Student ID",
        "Name",
        "Roll No",
        "Seat No",
        "Division",
        "Level",
        "Total Marks",
        "Overall Result",
        "SGPI",
        "CGPA",
        "Source Sheet",
        "Source Row",
    ])

    for r in rows:
        writer.writerow([
            sanitize_csv_cell(r[0]),
            sanitize_csv_cell(r[1]),
            sanitize_csv_cell(r[2]),
            sanitize_csv_cell(r[3]),
            sanitize_csv_cell(r[4]),
            sanitize_csv_cell(r[5]),
            sanitize_csv_cell(r[6]),
            sanitize_csv_cell(r[7]),
            sanitize_csv_cell(r[8]),
            sanitize_csv_cell(r[9]),
            sanitize_csv_cell(r[10]),
            sanitize_csv_cell(r[11]),
        ])

    return "investigation_roster.csv", buf.getvalue()


def export_investigation_excel_service(
    con: duckdb.DuckDBPyConnection,
    req: InvestigationQueryRequest,
) -> tuple[str, bytes]:
    """Generate unpaginated Excel .xlsx export for matching investigation cohort records."""
    from app.services.export_service import export_investigation_excel

    where_sql, params, explanation = build_investigation_filter_sql(req.group, req.search)
    sort_col = ALLOWED_SORT_COLUMNS.get(req.sort_by or "division", "division")
    sort_dir = "DESC" if req.sort_dir == "desc" else "ASC"
    order_clause = f"{sort_col} {sort_dir} NULLS LAST, student_id ASC"
    return export_investigation_excel(con, where_sql, params, order_clause, explanation)

