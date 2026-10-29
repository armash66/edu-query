import duckdb

con = duckdb.connect("data/eduquery.duckdb", read_only=True)

q = """
SELECT 
    s.student_id,
    s.seat_no,
    s.name,
    CASE WHEN UPPER(s.result) LIKE '%FAIL%' THEN 1 ELSE 0 END as actual_failed,
    ROUND(AVG(CASE WHEN sc.component = 'MSE' AND sc.value IS NOT NULL THEN sc.value END), 1) as avg_mse,
    ROUND(AVG(CASE WHEN sc.component = 'ISA' AND sc.value IS NOT NULL THEN sc.value END), 1) as avg_isa,
    COUNT(CASE WHEN sc.flag = 'AB' AND sc.component IN ('ISA', 'MSE') THEN 1 END) as internal_absent_count
FROM students s
LEFT JOIN scores sc ON s.student_id = sc.student_id
GROUP BY s.student_id, s.seat_no, s.name, s.result
"""

df = con.execute(q).fetchall()
print(f"Total students evaluated: {len(df)}")

for threshold in [8.0, 10.0, 11.0, 12.0]:
    tp = sum(1 for r in df if r[3] == 1 and ((r[4] is not None and r[4] < threshold) or r[6] > 0))
    fp = sum(1 for r in df if r[3] == 0 and ((r[4] is not None and r[4] < threshold) or r[6] > 0))
    fn = sum(1 for r in df if r[3] == 1 and not ((r[4] is not None and r[4] < threshold) or r[6] > 0))
    tn = sum(1 for r in df if r[3] == 0 and not ((r[4] is not None and r[4] < threshold) or r[6] > 0))
    prec = tp / (tp + fp) if (tp + fp) else 0
    rec = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0
    print(f"Threshold MSE < {threshold:4.1f}: TP={tp:2d}/13, FP={fp:2d}, FN={fn:2d}, TN={tn:3d} | Prec={prec*100:5.1f}%, Rec={rec*100:5.1f}%, F1={f1*100:5.1f}%")
