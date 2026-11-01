import sys
import os
import subprocess
import time

scripts = [
    ("Exp A: Parsing Correctness", "paper_audit/experiments/exp_a_parsing_correctness.py"),
    ("Exp B: Anomaly Detection", "paper_audit/experiments/exp_b_anomaly_detection.py"),
    ("Exp C: Verification Checks", "paper_audit/experiments/exp_c_verification_checks.py"),
    ("Exp D: Ask AI Benchmark", "paper_audit/experiments/exp_d_ask_ai_benchmark.py"),
    ("Exp E: HOD Brief Faithfulness", "paper_audit/experiments/exp_e_hod_brief_faithfulness.py"),
    ("Exp F: Privacy Test", "paper_audit/experiments/exp_f_privacy_test.py"),
    ("Exp G: Early Warning CV", "paper_audit/experiments/exp_g_early_warning_cv.py"),
    ("Exp H: Remedial Grouping", "paper_audit/experiments/exp_h_remedial_grouping.py"),
    ("Exp I: Scaling Benchmark", "paper_audit/experiments/exp_i_performance_scaling.py"),
]

print("=" * 80)
print("EDUQUERY V3: MASTER RESEARCH REPRODUCIBILITY EXECUTION")
print("=" * 80)

total_t0 = time.perf_counter()

for title, script_path in scripts:
    print(f"\n>>> Running {title} ({script_path}) ...")
    t0 = time.perf_counter()
    res = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
    elapsed = time.perf_counter() - t0
    if res.returncode == 0:
        print(f"    [SUCCESS] Finished in {elapsed:.2f}s")
    else:
        print(f"    [FAILED] Exit Code {res.returncode}")
        print(res.stderr)

total_elapsed = time.perf_counter() - total_t0
print("\n" + "=" * 80)
print(f"MASTER SUITE COMPLETE: Total Execution Time = {total_elapsed:.2f}s")
print("All experiment artifacts updated in paper_audit/experiments/.")
print("=" * 80)

