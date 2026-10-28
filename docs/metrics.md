# EduQuery Cohort & Performance Metrics Reference

This document defines the mathematical formulation, numerator, denominator, boundary handling, and synthetic dataset ground-truth values for every metric displayed on the EduQuery Overview page and academic analytical views.

---

## 1. Executive Cohort KPIs

### 1.1 Total Enrolled Students
- **Definition:** The count of unique student identity records recognized in the active dataset.
- **Formula:** 
  $$\text{Total Students} = \sum_{s \in \text{Students}} 1$$
- **Synthetic Ground Truth:** `145` students across Divisions A and B.

### 1.2 Total Curriculum Courses
- **Definition:** The count of distinct course codes registered in the curriculum catalog.
- **Formula:**
  $$\text{Total Courses} = \sum_{c \in \text{Courses}} 1$$
- **Synthetic Ground Truth:** `27` courses (including theory lectures, practical labs, and MDM electives).

### 1.3 Cohort Pass Rate
- **Definition:** The percentage of enrolled students who obtained a confirmed passing outcome (`PASS` or `PASSES`) across all registered curriculum courses.
- **Formula:**
  $$\text{Pass Rate (\%)} = \left( \frac{\text{Count of Confirmed Passed Students}}{\text{Total Enrolled Students}} \right) \times 100$$
- **Rounding:** Rounded to 1 decimal place.
- **Synthetic Ground Truth:**
  $$\frac{132}{145} \times 100 = 91.0345\% \approx 91.0\%$$

### 1.4 Needs Attention Count
- **Definition:** The number of unique students flagged by at least one explainable academic anomaly detection rule (Tier A deterministic checks or Tier C multivariate Isolation Forest patterns).
- **Formula:**
  $$\text{Needs Attention Count} = |\bigcup_{f \in \text{Findings}} \{ \text{student\_id}(f) \}|$$
- **Synthetic Ground Truth:** `8` distinct students (`PATEL ATHARV`, `SETHI RUDRA`, `PILLAI AYAAN`, `SHAIKH TANMAY`, `CHOPRA DHRUV`, `CHAVAN REYANSH`, `PANDEY ADVAIT`, `NAIR RUDRA`).
- **Visual Rule:** Amber accent when count > 0; neutral ink when 0.

---

## 2. Semester Grade Point Index (SGPI) Metrics

### 2.1 Average (Mean) SGPI
- **Definition:** Arithmetic mean of SGPI across all students who successfully passed and received an official numeric SGPI. Students with failed courses do not receive an SGPI under University of Mumbai guidelines and are strictly excluded from the calculation.
- **Formula:**
  $$\text{Average SGPI} = \frac{1}{N_{\text{passed}}} \sum_{s \in \text{Passed}} \text{SGPI}(s)$$
- **Numerator:** Sum of SGPIs for passed students ($1159.04$).
- **Denominator:** $N_{\text{passed}} = 132$.
- **Rounding:** Rounded to 1 decimal place.
- **Synthetic Ground Truth:** 
  $$\frac{1159.04}{132} = 8.7806 \approx 8.8$$

### 2.2 Median SGPI
- **Definition:** The 50th percentile SGPI value among passed students when ordered monotonically.
- **Formula:**
  $$\text{Median SGPI} = \text{Percentile}_{50}(\{ \text{SGPI}(s) \mid s \in \text{Passed} \})$$
- **Rounding:** Rounded to 1 decimal place.
- **Synthetic Ground Truth:** `8.92` $\approx$ `8.9`.

### 2.3 SGPI Distribution Histogram
- **Definition:** Frequency count of passed students categorized into 10 uniform 1.0-point SGPI intervals from 0.0 to 10.0.
- **Binning Intervals:**
  - $0 \le \text{SGPI} < 1$, $1 \le \text{SGPI} < 2$, ..., $8 \le \text{SGPI} < 9$
  - Final Bin: $9 \le \text{SGPI} \le 10.0$ (inclusive of maximum score 10.0)
- **Synthetic Ground Truth Distribution:**
  - `0-1`: 0
  - `1-2`: 0
  - `2-3`: 0
  - `3-4`: 0
  - `4-5`: 0
  - `5-6`: 0
  - `6-7`: 7 students (5.3%)
  - `7-8`: 20 students (15.2%)
  - `8-9`: 43 students (32.6%)
  - `9-10`: 62 students (47.0%)
  - **Sum of Bins:** $7 + 20 + 43 + 62 = 132$ (matches students with valid SGPI exactly).
- **Excluded Note:** Muted note explicitly indicates `13 students without SGPI (failed)`.

---

## 3. Results & Division Breakdown

### 3.1 Outcome Categories
- **Passed:** Confirmed passing outcome. Count: `132` (91.0%). Styled neutral ink.
- **Failed:** Confirmed failure outcome. Count: `13` (9.0%). Styled muted red.
- **Absent:** Fully absent outcome. Count: `0` (0.0%). Styled amber.

### 3.2 Division Pass Rate
- **Definition:** The percentage of students in a specific division who achieved a passing result, divided by the total number of students enrolled in that specific division.
- **Formula:**
  $$\text{Pass Rate}_{\text{div}} = \left( \frac{\text{Passed Students in Division}}{\text{Enrolled Students in Division}} \right) \times 100$$
- **Synthetic Ground Truth:**
  - **Division A:** $75 / 85 = 88.235\% \approx 88.2\%$
  - **Division B:** $57 / 60 = 95.000\% \approx 95.0\%$
  - **Gap:** $95.0\% - 88.2\% = 6.8$ percentage points.

---

## 4. Subject Performance & Hardest Subjects

### 4.1 Course Failure Rate
- **Definition:** The percentage of students failing a course relative to the total number of students enrolled in that specific course.
- **Formula:**
  $$\text{Course Failure Rate (\%)} = \left( \frac{\text{Confirmed Failures}}{\text{Enrolled in Course}} \right) \times 100$$
- **Failure-Rate Tier Color Rules (Design Principle A1):**
  - **Neutral Gray:** Failure rate $< 5.0\%$
  - **Amber Warning:** $5.0\% \le \text{Failure Rate} \le 15.0\%$
  - **Red Alert:** $\text{Failure Rate} > 15.0\%$

### 4.2 Top 5 Hardest Subjects on Synthetic Dataset
1. **PCEC12T (Theory of Computer Science):**
   - Enrolled: 145, Failures: 12, Rate: $8.3\%$ $\rightarrow$ **Amber** tier
2. **MDM01 (Data Management and Visualization):**
   - Enrolled: 145, Failures: 6, Rate: $4.1\%$ $\rightarrow$ **Neutral** tier
3. **PCEC13T (Database Management Systems):**
   - Enrolled: 145, Failures: 6, Rate: $4.1\%$ $\rightarrow$ **Neutral** tier
4. **PCEC14P (Computer Networks Lab):**
   - Enrolled: 145, Failures: 6, Rate: $4.1\%$ $\rightarrow$ **Neutral** tier
5. **PCEC14T (Computer Networks):**
   - Enrolled: 145, Failures: 6, Rate: $4.1\%$ $\rightarrow$ **Neutral** tier

---

## 5. Deterministic Highlights Generation

Highlights are generated server-side through deterministic evaluation of the active dataset without stochastic models or language generators:

1. **Top Failure Subject:**
   - Evaluated if the highest failure rate is $> 0\%$.
   - Template: `"{Course Title} has the highest failure rate: {rate}% ({count} students)."`
   - Output: `"Theory of Computer Science has the highest failure rate: 8.3% (12 students)."`
   - Target Link: `/subjects?search=PCEC12T`

2. **Division Performance Disparity:**
   - Evaluated if at least two divisions exist and the pass rate delta $\Delta \ge 1.0\%$.
   - Template: `"{Higher Division}'s pass rate is {delta} points higher than {Lower Division}'s."`
   - Output: `"Division B's pass rate is 6.8 points higher than Division A's."`
   - Target Link: `/explore?division=B`

3. **Multi-Subject Failures:**
   - Evaluated by querying reconciliation records for students with failing grades in $\ge 2$ courses.
   - Template: `"{Count} students failed two or more subjects."`
   - Output: `"9 students failed two or more subjects."`
   - Target Link: `/explore?multi_fails=true`

