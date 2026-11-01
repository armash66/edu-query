# Deliverable 14: Institutional Policy Ambiguities and Author Decision Register

Before publishing an academic paper on EduQuery V3, the paper authors must clarify and finalize several institutional grading policies, credit conventions, and administrative thresholds that vary across universities.

---

### Decision 1: Official Credit Scale and Grade Point Mapping
- **Current System Implementation**: Follows University of Mumbai CBCS 10-point grading scale:
  - $O$ (Outstanding): Grade Point 10
  - $A+$ (Excellent): Grade Point 9
  - $A$ (Very Good): Grade Point 8
  - $B+$ (Good): Grade Point 7
  - $B$ (Above Average): Grade Point 6
  - $C$ (Average): Grade Point 5
  - $D$ (Pass): Grade Point 4
  - $F$ (Fail) / $AB$ (Absent): Grade Point 0
- **Author Decision Needed**: Does the paper present this as the institutional standard, or should the paper describe the mapping as a configurable schema parameter that adapts to 4.0 GPA (US) or 7.0/8.0 scales (UK/Australia)?

---

### Decision 2: Passing Rules and ATKT (Allowed to Keep Terms) Criteria
- **Current System Implementation**:
  - A student is categorized as `FAILED` if their overall marksheet result contains `"FAIL"` or if they fail $\ge 1$ course evaluations.
  - Early warning rules flag critical risk if a student fails $\ge 2$ internal continuous assessments or records internal absences.
- **Author Decision Needed**: University policies differ on academic progression:
  - Does the target institution allow students with 1 or 2 backlogs to progress under ATKT provisions?
  - Are internal evaluations (ISA/MSE) strictly independent passing requirements (e.g., minimum 16/40 in ISA to sit for ESE), or is passing based solely on composite course totals ($40/100$)?

---

### Decision 3: Institutional Classification Bands (Class Distinctions)
- **Current System Implementation**: Exported merit lists categorize passed students based on CGPA / SGPI:
  - $\text{CGPA} \ge 7.5$: **Distinction**
  - $6.5 \le \text{CGPA} < 7.5$: **First Class**
  - $6.0 \le \text{CGPA} < 6.5$: **Higher Second Class**
  - $5.0 \le \text{CGPA} < 6.0$: **Second Class**
  - $\text{CGPA} < 5.0$: **Pass Class**
- **Author Decision Needed**: Do these grade point cutoffs match the specific university's degree awarding gazette, or does the institution calculate classifications from raw percentage aggregate marks rather than SGPI?

---

### Decision 4: Interpretation of Mark Suffixes and Grading Flags
- **Current System Implementation**: Regex parser strips alphanumeric suffixes and stores them in `flag` and `raw_text`:
  - `32F`: Score 32 with explicit failure flag.
  - `18E`: Score 18 with exemption indicator.
  - `45@`: Score 45 with grace/condonation indicator.
  - `AB`, `ABS`: Recorded absentee.
- **Author Decision Needed**:
  - Does the university treat `E` as a prior-semester exemption that is excluded from fresh SGPI calculation?
  - Are grace marks (`@` or `+`) subject to institutional caps (e.g., maximum 5 grace marks per semester under university ordinances)?

---

### Decision 5: Legal Precedence in Arithmetic Reconciliation Discrepancies
- **Current System Implementation**: When `|printed_total - computed_total| > 0.05`, EduQuery flags the record as a reconciliation discrepancy in `reconciliation` table and displays it in Data Quality for faculty review.
- **Author Decision Needed**: In the event of a dispute, which figure holds legal authority under university examination bylaws:
  1. Does the sum of component assessments override the printed total? OR
  2. Does the printed total take legal precedence as the declared grade until formally amended by an examination board gazette?

---

### Decision 6: Mandatory vs Advisory Remedial Counseling
- **Current System Implementation**: Notice drafting generates an official circular requiring students with backlogs to attend mandatory remedial modules prior to backlog re-examination.
- **Author Decision Needed**: Is remedial attendance legally mandatory for examination re-entry at the institution, or is it an advisory mentorship intervention recommended under NAAC/NBA accreditation criteria?

