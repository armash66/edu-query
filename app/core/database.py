"""Database connection and schema definitions for EduQuery V3."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

TABLE_SCHEMAS = {
    "students": """
        student_id VARCHAR,
        seat_no VARCHAR,
        roll_no VARCHAR,
        name VARCHAR,
        email VARCHAR,
        division VARCHAR,
        level VARCHAR,
        total_marks DOUBLE,
        total_credits DOUBLE,
        result VARCHAR,
        sgpi DOUBLE,
        cgpa DOUBLE,
        elective_choice VARCHAR,
        source_sheet VARCHAR,
        source_row INTEGER
    """,
    "courses": """
        code VARCHAR,
        name VARCHAR,
        kind VARCHAR,
        paired_code VARCHAR,
        credits DOUBLE,
        credits_raw VARCHAR,
        components VARCHAR
    """,
    "scores": """
        student_id VARCHAR,
        course_code VARCHAR,
        component VARCHAR,
        value DOUBLE,
        flag VARCHAR,
        state VARCHAR,
        raw_text VARCHAR,
        grade VARCHAR,
        source_sheet VARCHAR,
        source_row INTEGER
    """,
    "grades": """
        student_id VARCHAR,
        course_code VARCHAR,
        letter VARCHAR
    """,
    "enrollment": """
        student_id VARCHAR,
        course_code VARCHAR
    """,
    "reconciliation": """
        student_id VARCHAR,
        course_code VARCHAR,
        printed_total DOUBLE,
        computed_total DOUBLE,
        total_match BOOLEAN,
        grade VARCHAR,
        flags VARCHAR
    """,
    "layout_profiles": """
        fingerprint VARCHAR,
        layout_spec VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """,
    "quality_findings": """
        check_id VARCHAR,
        severity VARCHAR,
        title VARCHAR,
        count INTEGER,
        problem VARCHAR,
        impact VARCHAR,
        recommended_action VARCHAR,
        details_json VARCHAR
    """,
}


def init_database(con: duckdb.DuckDBPyConnection) -> None:
    """Initialize clean DuckDB tables with full V3 schema."""
    for table, schema in TABLE_SCHEMAS.items():
        con.execute(f"DROP TABLE IF EXISTS {table}")
        con.execute(f"CREATE TABLE {table} ({schema})")


def get_connection(db_path: str | Path = ":memory:", read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """Open or create a DuckDB connection."""
    return duckdb.connect(str(db_path), read_only=read_only)


def populate_table(con: duckdb.DuckDBPyConnection, table_name: str, rows: list[dict[str, Any]]) -> None:
    """Efficiently bulk-insert a list of dictionary records into a DuckDB table."""
    if not rows:
        return
    df = pd.DataFrame(rows)
    con.register(f"_{table_name}_df", df)
    columns = list(df.columns)
    quoted_cols = ",".join(columns)
    con.execute(f"INSERT INTO {table_name} ({quoted_cols}) SELECT {quoted_cols} FROM _{table_name}_df")
    con.unregister(f"_{table_name}_df")
