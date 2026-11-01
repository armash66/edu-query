import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
import numpy as np
from scripts.evaluate_anomaly_detection import (
    generate_synthetic_cohort,
    evaluate_deterministic_baseline,
    evaluate_robust_statistical_baseline,
    evaluate_isolation_forest,
    compute_metrics,
)

seeds = [42, 101, 202, 303, 404, 505, 606, 707, 808, 909]
methods_keys = [
    "Tier A (Deterministic)",
    "Tier B (Robust MAD)",
    "Tier C (Isolation Forest)",
    "Tier A + Tier B",
    "Tier A + Tier C (System Default)",
    "Tier B + Tier C",
    "Combined (All Tiers)",
]

all_runs = []
summary_stats = {m: {"prec": [], "rec": [], "f1": [], "fpr": [], "time": []} for m in methods_keys}
confusion_matrices = {m: {"tp": 0, "fp": 0, "tn": 0, "fn": 0} for m in methods_keys}
error_type_detection = {
    "arithmetic_mismatch": {m: 0 for m in methods_keys},
    "boundary_violation": {m: 0 for m in methods_keys},
    "isolated_collapse": {m: 0 for m in methods_keys},
    "structural_bimodal": {m: 0 for m in methods_keys},
}
total_anomalies_by_type = {"arithmetic_mismatch": 0, "boundary_violation": 0, "isolated_collapse": 0, "structural_bimodal": 0}

for seed in seeds:
    cohort, y_true = generate_synthetic_cohort(num_students=150, seed=seed)
    
    # Track anomaly types
    for s, yt in zip(cohort, y_true):
        if yt == 1:
            total_anomalies_by_type[s["anomaly_type"]] += 1

    # Tier A
    t0 = time.perf_counter()
    pred_a = evaluate_deterministic_baseline(cohort)
    time_a = (time.perf_counter() - t0) * 1000.0

    # Tier B
    t0 = time.perf_counter()
    pred_b = evaluate_robust_statistical_baseline(cohort)
    time_b = (time.perf_counter() - t0) * 1000.0

    # Tier C
    t0 = time.perf_counter()
    pred_c = evaluate_isolation_forest(cohort, contamination=0.05, seed=seed)
    time_c = (time.perf_counter() - t0) * 1000.0

    # Combinations (Logical OR)
    pred_ab = [1 if (a or b) else 0 for a, b in zip(pred_a, pred_b)]
    pred_ac = [1 if (a or c) else 0 for a, c in zip(pred_a, pred_c)]
    pred_bc = [1 if (b or c) else 0 for b, c in zip(pred_b, pred_c)]
    pred_all = [1 if (a or b or c) else 0 for a, b, c in zip(pred_a, pred_b, pred_c)]

    preds_map = {
        "Tier A (Deterministic)": (pred_a, time_a),
        "Tier B (Robust MAD)": (pred_b, time_b),
        "Tier C (Isolation Forest)": (pred_c, time_c),
        "Tier A + Tier B": (pred_ab, time_a + time_b),
        "Tier A + Tier C (System Default)": (pred_ac, time_a + time_c),
        "Tier B + Tier C": (pred_bc, time_b + time_c),
        "Combined (All Tiers)": (pred_all, time_a + time_b + time_c),
    }

    for m_name, (pred, rtime) in preds_map.items():
        m = compute_metrics(y_true, pred, rtime)
        f1 = round(2 * (m["precision"] * m["recall"]) / (m["precision"] + m["recall"]), 3) if (m["precision"] + m["recall"]) > 0 else 0.0
        
        summary_stats[m_name]["prec"].append(m["precision"])
        summary_stats[m_name]["rec"].append(m["recall"])
        summary_stats[m_name]["f1"].append(f1)
        summary_stats[m_name]["fpr"].append(m["fpr"])
        summary_stats[m_name]["time"].append(m["runtime_ms"])

        confusion_matrices[m_name]["tp"] += m["tp"]
        confusion_matrices[m_name]["fp"] += m["fp"]
        confusion_matrices[m_name]["tn"] += m["tn"]
        confusion_matrices[m_name]["fn"] += m["fn"]

        # Track per-type detection
        for s, yt, p in zip(cohort, y_true, pred):
            if yt == 1 and p == 1:
                error_type_detection[s["anomaly_type"]][m_name] += 1

        all_runs.append({
            "seed": seed,
            "method": m_name,
            "tp": m["tp"],
            "fp": m["fp"],
            "tn": m["tn"],
            "fn": m["fn"],
            "precision": m["precision"],
            "recall": m["recall"],
            "f1": f1,
            "fpr": m["fpr"],
            "runtime_ms": m["runtime_ms"],
        })

# Aggregate mean and standard deviation
final_table = []
for m_name in methods_keys:
    st = summary_stats[m_name]
    final_table.append({
        "method": m_name,
        "precision_mean": round(float(np.mean(st["prec"])), 3),
        "precision_std": round(float(np.std(st["prec"])), 3),
        "recall_mean": round(float(np.mean(st["rec"])), 3),
        "recall_std": round(float(np.std(st["rec"])), 3),
        "f1_mean": round(float(np.mean(st["f1"])), 3),
        "f1_std": round(float(np.std(st["f1"])), 3),
        "fpr_mean": round(float(np.mean(st["fpr"])), 3),
        "fpr_std": round(float(np.std(st["fpr"])), 3),
        "runtime_ms_mean": round(float(np.mean(st["time"])), 2),
        "runtime_ms_std": round(float(np.std(st["time"])), 2),
    })

# Write CSV
with open("paper_audit/experiments/exp_b_anomaly_detection_summary.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(final_table[0].keys()))
    writer.writeheader()
    writer.writerows(final_table)

with open("paper_audit/experiments/exp_b_all_runs.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(all_runs[0].keys()))
    writer.writeheader()
    writer.writerows(all_runs)

# Contamination Sensitivity across 10 seeds
c_rates = [0.01, 0.03, 0.05, 0.08, 0.10, 0.15]
sensitivity_results = []

for c_rate in c_rates:
    precs, recs, f1s, fps = [], [], [], []
    for seed in seeds:
        cohort, y_true = generate_synthetic_cohort(num_students=150, seed=seed)
        pred = evaluate_isolation_forest(cohort, contamination=c_rate, seed=seed)
        m = compute_metrics(y_true, pred, 0.0)
        f1 = round(2 * (m["precision"] * m["recall"]) / (m["precision"] + m["recall"]), 3) if (m["precision"] + m["recall"]) > 0 else 0.0
        precs.append(m["precision"])
        recs.append(m["recall"])
        f1s.append(f1)
        fps.append(m["fp"])

    sensitivity_results.append({
        "contamination": c_rate,
        "precision_mean": round(float(np.mean(precs)), 3),
        "precision_std": round(float(np.std(precs)), 3),
        "recall_mean": round(float(np.mean(recs)), 3),
        "recall_std": round(float(np.std(recs)), 3),
        "f1_mean": round(float(np.mean(f1s)), 3),
        "f1_std": round(float(np.std(f1s)), 3),
        "fp_count_mean": round(float(np.mean(fps)), 1),
    })

with open("paper_audit/experiments/exp_b_contamination_sensitivity.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(sensitivity_results[0].keys()))
    writer.writeheader()
    writer.writerows(sensitivity_results)

# Normalized detection rate per anomaly type
type_detection_rate = {}
for atype, counts in error_type_detection.items():
    tot = total_anomalies_by_type[atype]
    type_detection_rate[atype] = {m: round(counts[m] / tot * 100, 1) for m in methods_keys}

with open("paper_audit/experiments/exp_b_type_detection_rates.json", "w", encoding="utf-8") as f:
    json.dump({
        "total_anomalies_evaluated": total_anomalies_by_type,
        "detection_rates_percent": type_detection_rate,
        "confusion_matrices_aggregated": confusion_matrices
    }, f, indent=2)

print("Experiment B Complete. Summary across 10 random seeds:")
for row in final_table:
    print(f"{row['method']:<32} | Prec: {row['precision_mean']}±{row['precision_std']} | Rec: {row['recall_mean']}±{row['recall_std']} | F1: {row['f1_mean']}±{row['f1_std']} | FPR: {row['fpr_mean']}±{row['fpr_std']}")

