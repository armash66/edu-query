import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
import numpy as np
from pathlib import Path
from app.core.ingest import ingest

con, _ = ingest(Path("data/Result_anonymized.xlsx"), db_path=":memory:")

# Extract failed students per subject (Tutees) and top students per subject (Tutors)
subject_query = """
SELECT 
    r.course_code,
    r.student_id,
    s.name,
    s.division,
    r.computed_total as score,
    r.grade,
    CASE WHEN (UPPER(TRIM(r.grade)) IN ('F', 'FAIL') OR UPPER(r.flags) LIKE '%F%') THEN 'tutee'
         WHEN r.computed_total >= 70.0 THEN 'tutor'
         ELSE 'peer' END as role
FROM reconciliation r
JOIN students s ON r.student_id = s.student_id
WHERE r.computed_total IS NOT NULL
ORDER BY r.course_code, r.computed_total DESC
"""

rows = con.execute(subject_query).fetchall()

# Focus on subjects with >= 3 failed students to test multi-student grouping
subjects_map = {}
for ccode, sid, name, div, score, grade, role in rows:
    subjects_map.setdefault(ccode, []).append({
        "student_id": sid,
        "name": name,
        "division": div,
        "score": float(score),
        "grade": grade,
        "role": role
    })

eval_subjects = [c for c, students in subjects_map.items() if sum(1 for s in students if s["role"] == "tutee") >= 2]
print(f"Evaluating remedial pairing on {len(eval_subjects)} subjects with backlogs: {eval_subjects}")

# Constraints:
# 1. Max group size = 4 tutees per tutor
# 2. Division match preferred (+10 quality bonus)
# 3. Tutor must have score >= 70.0

def run_remedial_matching_heuristic(tutors, tutees, max_group=4):
    """Priority bipartite matching: match by same division first, then highest tutor score."""
    tutees_left = list(tutees)
    groups = {t["student_id"]: {"tutor": t, "tutees": [], "same_div_count": 0} for t in tutors}
    
    # Pass 1: Same division matching
    for t in tutors:
        t_id = t["student_id"]
        t_div = t["division"]
        matches = [s for s in tutees_left if s["division"] == t_div]
        for m in matches[:max_group]:
            groups[t_id]["tutees"].append(m)
            groups[t_id]["same_div_count"] += 1
            tutees_left.remove(m)
            if len(groups[t_id]["tutees"]) >= max_group:
                break
    
    # Pass 2: Remaining tutees assigned to tutors with remaining capacity
    for t in tutors:
        t_id = t["student_id"]
        while len(groups[t_id]["tutees"]) < max_group and tutees_left:
            m = tutees_left.pop(0)
            groups[t_id]["tutees"].append(m)

    return groups, tutees_left

def run_greedy_matching(tutors, tutees, max_group=4):
    """Greedy: Assign each tutee sequentially to the highest-scoring tutor with capacity."""
    tutees_left = list(tutees)
    sorted_tutors = sorted(tutors, key=lambda x: x["score"], reverse=True)
    groups = {t["student_id"]: {"tutor": t, "tutees": [], "same_div_count": 0} for t in sorted_tutors}
    
    for m in tutees:
        assigned = False
        for t in sorted_tutors:
            t_id = t["student_id"]
            if len(groups[t_id]["tutees"]) < max_group:
                groups[t_id]["tutees"].append(m)
                if m["division"] == t["division"]:
                    groups[t_id]["same_div_count"] += 1
                tutees_left.remove(m)
                assigned = True
                break
    return groups, tutees_left

def run_random_matching(tutors, tutees, seed=42, max_group=4):
    """Random baseline: Randomly assign tutees to available tutors."""
    rng = np.random.default_rng(seed)
    shuffled_tutees = list(tutees)
    rng.shuffle(shuffled_tutees)
    shuffled_tutors = list(tutors)
    rng.shuffle(shuffled_tutors)
    
    groups = {t["student_id"]: {"tutor": t, "tutees": [], "same_div_count": 0} for t in shuffled_tutors}
    tutees_left = list(shuffled_tutees)
    
    for m in shuffled_tutees:
        for t in shuffled_tutors:
            t_id = t["student_id"]
            if len(groups[t_id]["tutees"]) < max_group:
                groups[t_id]["tutees"].append(m)
                if m["division"] == t["division"]:
                    groups[t_id]["same_div_count"] += 1
                tutees_left.remove(m)
                break
    return groups, tutees_left

# Evaluate across all eligible subjects
methods_results = {
    "EduQuery Division-Aware Matching": {"same_div": [], "quality_gap": [], "orphans": [], "runtime_ms": []},
    "Greedy Highest-Score Matching": {"same_div": [], "quality_gap": [], "orphans": [], "runtime_ms": []},
    "Random Baseline (10 Seeds)": {"same_div": [], "quality_gap": [], "orphans": [], "runtime_ms": []},
}

for ccode in eval_subjects:
    tutors = [s for s in subjects_map[ccode] if s["role"] == "tutor"]
    tutees = [s for s in subjects_map[ccode] if s["role"] == "tutee"]
    if not tutors or not tutees:
        continue

    # 1. EduQuery Heuristic
    t0 = time.perf_counter()
    g_edu, orph_edu = run_remedial_matching_heuristic(tutors, tutees)
    time_edu = (time.perf_counter() - t0) * 1000.0
    
    assigned_tutees_edu = [item for g in g_edu.values() for item in g["tutees"]]
    same_div_rate_edu = (sum(g["same_div_count"] for g in g_edu.values()) / len(assigned_tutees_edu) * 100) if assigned_tutees_edu else 0.0
    qual_gap_edu = np.mean([g["tutor"]["score"] - s["score"] for g in g_edu.values() for s in g["tutees"]]) if assigned_tutees_edu else 0.0

    methods_results["EduQuery Division-Aware Matching"]["same_div"].append(same_div_rate_edu)
    methods_results["EduQuery Division-Aware Matching"]["quality_gap"].append(qual_gap_edu)
    methods_results["EduQuery Division-Aware Matching"]["orphans"].append(len(orph_edu))
    methods_results["EduQuery Division-Aware Matching"]["runtime_ms"].append(time_edu)

    # 2. Greedy
    t0 = time.perf_counter()
    g_grd, orph_grd = run_greedy_matching(tutors, tutees)
    time_grd = (time.perf_counter() - t0) * 1000.0

    assigned_tutees_grd = [item for g in g_grd.values() for item in g["tutees"]]
    same_div_rate_grd = (sum(g["same_div_count"] for g in g_grd.values()) / len(assigned_tutees_grd) * 100) if assigned_tutees_grd else 0.0
    qual_gap_grd = np.mean([g["tutor"]["score"] - s["score"] for g in g_grd.values() for s in g["tutees"]]) if assigned_tutees_grd else 0.0

    methods_results["Greedy Highest-Score Matching"]["same_div"].append(same_div_rate_grd)
    methods_results["Greedy Highest-Score Matching"]["quality_gap"].append(qual_gap_grd)
    methods_results["Greedy Highest-Score Matching"]["orphans"].append(len(orph_grd))
    methods_results["Greedy Highest-Score Matching"]["runtime_ms"].append(time_grd)

    # 3. Random Baseline (10 seeds)
    rand_divs, rand_gaps, rand_orphs, rand_times = [], [], [], []
    for s_idx in range(10):
        t0 = time.perf_counter()
        g_rnd, orph_rnd = run_random_matching(tutors, tutees, seed=s_idx*10 + 42)
        time_rnd = (time.perf_counter() - t0) * 1000.0
        assigned_rnd = [item for g in g_rnd.values() for item in g["tutees"]]
        
        sdiv = (sum(g["same_div_count"] for g in g_rnd.values()) / len(assigned_rnd) * 100) if assigned_rnd else 0.0
        qgap = np.mean([g["tutor"]["score"] - s["score"] for g in g_rnd.values() for s in g["tutees"]]) if assigned_rnd else 0.0
        rand_divs.append(sdiv)
        rand_gaps.append(qgap)
        rand_orphs.append(len(orph_rnd))
        rand_times.append(time_rnd)

    methods_results["Random Baseline (10 Seeds)"]["same_div"].append(float(np.mean(rand_divs)))
    methods_results["Random Baseline (10 Seeds)"]["quality_gap"].append(float(np.mean(rand_gaps)))
    methods_results["Random Baseline (10 Seeds)"]["orphans"].append(float(np.mean(rand_orphs)))
    methods_results["Random Baseline (10 Seeds)"]["runtime_ms"].append(float(np.mean(rand_times)))

final_table = []
for m_name, metrics in methods_results.items():
    final_table.append({
        "method": m_name,
        "division_coherence_pct": round(float(np.mean(metrics["same_div"])), 2),
        "mean_quality_score_diff": round(float(np.mean(metrics["quality_gap"])), 2),
        "mean_orphan_tutees": round(float(np.mean(metrics["orphans"])), 2),
        "mean_runtime_ms": round(float(np.mean(metrics["runtime_ms"])), 3),
    })

with open("paper_audit/experiments/exp_h_remedial_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(final_table[0].keys()))
    writer.writeheader()
    writer.writerows(final_table)

with open("paper_audit/experiments/exp_h_remedial_results.json", "w", encoding="utf-8") as f:
    json.dump(final_table, f, indent=2)

print("Experiment H (Remedial Grouping Benchmark) Complete:")
for r in final_table:
    print(f"{r['method']:<35} | Same-Div Coherence: {r['division_coherence_pct']}% | Quality Score Diff: +{r['mean_quality_score_diff']} | Orphan Tutees: {r['mean_orphan_tutees']} | Time: {r['mean_runtime_ms']} ms")

