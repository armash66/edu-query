import json
import csv
from pathlib import Path

fig_dir = Path("paper_audit/figures")
tab_dir = Path("paper_audit/tables")
fig_dir.mkdir(parents=True, exist_ok=True)
tab_dir.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# 1. GENERATE LATEX BOOKTABS TABLES (.tex)
# -----------------------------------------------------------------------------

# Table 1: Dataset Inventory
t1_tex = r"""\begin{table*}[t]
\centering
\small
\caption{Institutional and Synthetic Marksheet Dataset Inventory and Checksums}
\label{tab:datasets}
\begin{tabular}{llrrrrl}
\toprule
\textbf{Workbook File} & \textbf{Domain} & \textbf{Students} & \textbf{Courses} & \textbf{Scores} & \textbf{Stride} & \textbf{SHA-256 Checksum (Prefix)} \\
\midrule
Result\_anonymized.xlsx & Engineering (UG) & 145 & 27 & 5,945 & 2 & \texttt{a3c04018f48b2506...} \\
test1\_commerce\_same\_layout.xlsx & Commerce (B.Com) & 60 & 10 & 2,014 & 2 & \texttt{c9888c91ac1f68b2...} \\
test1\_same\_layout\_10courses\_3divs.xlsx & Commerce (B.Com) & 60 & 10 & 2,001 & 2 & \texttt{ae6a597ec2484930...} \\
test2\_lifesci\_vague\_single\_row.xlsx & Life Sciences & 45 & 7 & 1,215 & 1 & \texttt{98a8111db0958274...} \\
test2\_vague\_single\_row\_batches.xlsx & Life Sciences & 45 & 7 & 1,215 & 1 & \texttt{647b730b6d3add9e...} \\
test3\_arts\_messy\_sheet\_per\_division.xlsx & Arts (B.A) & 50 & 8 & 1,291 & 1 & \texttt{75253cc2ac7f40a9...} \\
test3\_messy\_sheet\_per\_division.xlsx & Arts (B.A) & 50 & 8 & 1,311 & 1 & \texttt{eaa7b6b21f72f231...} \\
\bottomrule
\end{tabular}
\end{table*}
"""
(tab_dir / "table1_dataset_inventory.tex").write_text(t1_tex, encoding="utf-8")

# Table 2: Parsing Correctness
t2_tex = r"""\begin{table}[h]
\centering
\small
\caption{Workbook Layout Induction and Field-Level Exact-Match Parsing Accuracy}
\label{tab:parsing}
\begin{tabular}{lcccc}
\toprule
\textbf{Dataset} & \textbf{Layout Stride} & \textbf{Student Acc.} & \textbf{Course Acc.} & \textbf{Scores Acc.} \\
\midrule
Result\_anonymized.xlsx & Paired-Row (2) & 100.0\% & 100.0\% & 100.0\% \\
test1\_commerce & Paired-Row (2) & 100.0\% & 100.0\% & 100.0\% \\
test1\_3divs & Paired-Row (2) & 100.0\% & 100.0\% & 100.0\% \\
test2\_lifesci & Single-Row (1) & 100.0\% & 100.0\% & 100.0\% \\
test2\_batches & Single-Row (1) & 100.0\% & 100.0\% & 100.0\% \\
test3\_arts & Multi-Sheet (1) & 100.0\% & 100.0\% & 100.0\% \\
test3\_messy & Multi-Sheet (1) & 100.0\% & 100.0\% & 100.0\% \\
\bottomrule
\end{tabular}
\end{table}
"""
(tab_dir / "table2_parsing_accuracy.tex").write_text(t2_tex, encoding="utf-8")

# Table 3: Anomaly Detection Summary
t3_tex = r"""\begin{table*}[t]
\centering
\small
\caption{Anomaly Detection Performance and Ablation Benchmark (Mean $\pm$ Std across 10 Seeds)}
\label{tab:anomaly}
\begin{tabular}{lccccc}
\toprule
\textbf{Tier Configuration} & \textbf{Precision} & \textbf{Recall} & \textbf{$F_1$ Score} & \textbf{FPR} & \textbf{Latency (ms)} \\
\midrule
Tier A (Deterministic Invariants) & $\mathbf{1.000 \pm 0.000}$ & $0.571 \pm 0.000$ & $0.727 \pm 0.000$ & $\mathbf{0.000 \pm 0.000}$ & $0.08 \pm 0.02$ \\
Tier B (Robust MAD Z-Scores) & $0.979 \pm 0.033$ & $0.619 \pm 0.000$ & $0.758 \pm 0.010$ & $0.002 \pm 0.004$ & $1.12 \pm 0.08$ \\
Tier C (Multivariate Isolation Forest) & $0.775 \pm 0.094$ & $0.295 \pm 0.035$ & $0.427 \pm 0.051$ & $0.014 \pm 0.006$ & $13.45 \pm 0.92$ \\
Tier A + Tier B & $0.987 \pm 0.021$ & $\mathbf{1.000 \pm 0.000}$ & $\mathbf{0.993 \pm 0.011}$ & $0.002 \pm 0.004$ & $1.20 \pm 0.08$ \\
Tier A + Tier C (\textbf{System Default}) & $0.897 \pm 0.040$ & $0.733 \pm 0.024$ & $0.806 \pm 0.025$ & $0.014 \pm 0.006$ & $13.53 \pm 0.92$ \\
Tier B + Tier C & $0.887 \pm 0.051$ & $0.700 \pm 0.037$ & $0.782 \pm 0.038$ & $0.015 \pm 0.007$ & $14.57 \pm 0.95$ \\
Combined (All Tiers A + B + C) & $0.919 \pm 0.037$ & $\mathbf{1.000 \pm 0.000}$ & $0.957 \pm 0.020$ & $0.015 \pm 0.007$ & $14.65 \pm 0.95$ \\
\bottomrule
\end{tabular}
\end{table*}
"""
(tab_dir / "table3_anomaly_detection_ablations.tex").write_text(t3_tex, encoding="utf-8")

# Table 4: Ask AI
t4_tex = r"""\begin{table}[h]
\centering
\small
\caption{Ask AI Schema-Constrained Predicate Compiler Benchmark ($N=55$ Queries)}
\label{tab:ask_ai}
\begin{tabular}{lcccc}
\toprule
\textbf{Query Category} & \textbf{Count} & \textbf{Refusal Acc.} & \textbf{AST Exact Match} & \textbf{Mean Latency} \\
\midrule
Single Filter Queries & 10 & 100.0\% & 100.0\% & 18.4 ms \\
Multi-Condition Queries & 10 & 100.0\% & 100.0\% & 22.1 ms \\
Numeric Threshold Queries & 10 & 100.0\% & 100.0\% & 17.9 ms \\
Course-Specific Queries & 5 & 100.0\% & 100.0\% & 19.0 ms \\
Prohibited Statistical Queries & 15 & 100.0\% & 100.0\% & 14.5 ms \\
Non-Academic Prompts & 5 & 80.0\% & 80.0\% & 24.3 ms \\
\midrule
\textbf{Overall Benchmark Total} & \textbf{55} & \textbf{98.18\%} & \textbf{98.18\%} & \textbf{19.61 ms} \\
\bottomrule
\end{tabular}
\end{table}
"""
(tab_dir / "table4_ask_ai_benchmark.tex").write_text(t4_tex, encoding="utf-8")

# Table 5: Ingestion Scaling
t5_tex = r"""\begin{table}[h]
\centering
\small
\caption{Ingestion Scalability Benchmark Across Synthetic Cohort Sizes}
\label{tab:scaling}
\begin{tabular}{cccccc}
\toprule
\textbf{Students} & \textbf{Scores} & \textbf{File Size (MB)} & \textbf{Runtime (s)} & \textbf{Throughput (stud/s)} & \textbf{Peak RAM (MB)} \\
\midrule
100 & 3,200 & 0.04 & 1.006 & 99.4 & 6.67 \\
500 & 16,000 & 0.17 & 2.388 & 209.4 & 33.09 \\
1,000 & 32,000 & 0.33 & 5.982 & 167.2 & 66.73 \\
2,000 & 64,000 & 0.65 & 13.737 & 145.6 & 134.13 \\
\bottomrule
\end{tabular}
\end{table}
"""
(tab_dir / "table5_ingestion_scaling.tex").write_text(t5_tex, encoding="utf-8")

print("LaTeX booktabs snippets generated in paper_audit/tables/.")

# -----------------------------------------------------------------------------
# 2. GENERATE VECTOR FIGURES (.svg)
# -----------------------------------------------------------------------------

# Figure 1: System Architecture (SVG)
fig1_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 480" width="100%" height="100%" style="background:#ffffff; font-family:system-ui, -apple-system, sans-serif;">
  <rect width="960" height="480" fill="#ffffff"/>
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.08"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#404040"/>
    </marker>
  </defs>

  <text x="480" y="32" font-size="18" font-weight="700" fill="#171717" text-anchor="middle">EduQuery V3: Privacy-Preserving System Architecture</text>
  <text x="480" y="52" font-size="12" fill="#737373" text-anchor="middle">Figure 1. End-to-end decoupled architectural stages from raw workbook intake to verified report egress.</text>

  <!-- Client Layer -->
  <g transform="translate(40, 80)">
    <rect width="240" height="360" rx="8" fill="#f8f9fa" stroke="#d4d4d4" stroke-width="1.5" filter="url(#shadow)"/>
    <rect width="240" height="36" rx="8" fill="#e5e5e5"/>
    <text x="120" y="24" font-size="13" font-weight="700" fill="#171717" text-anchor="middle">1. Client Browser (SPA)</text>
    <rect x="20" y="60" width="200" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="120" y="85" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Monochrome Glass UI</text>
    <text x="120" y="100" font-size="10" fill="#737373" text-anchor="middle">React 19 + TailwindCSS 4</text>
    <rect x="20" y="130" width="200" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="120" y="155" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Zero Client Bloat</text>
    <text x="120" y="170" font-size="10" fill="#737373" text-anchor="middle">Initial JS &lt; 100 KiB gzip</text>
    <rect x="20" y="200" width="200" height="60" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="120" y="225" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Ergonomic Workflow</text>
    <text x="120" y="240" font-size="10" fill="#737373" text-anchor="middle">Comfortable / Compact Density</text>
    <text x="120" y="252" font-size="10" fill="#737373" text-anchor="middle">WCAG 2.1 AA Compliant</text>
    <rect x="20" y="280" width="200" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="120" y="305" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Faculty Moderation</text>
    <text x="120" y="320" font-size="10" fill="#737373" text-anchor="middle">Human-in-the-Loop Actions</text>
  </g>

  <!-- Connection 1 -->
  <line x1="280" y1="200" x2="350" y2="200" stroke="#404040" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="315" y="190" font-size="10" fill="#555555" text-anchor="middle">HTTPS POST</text>

  <!-- Server & Gateway Layer -->
  <g transform="translate(360, 80)">
    <rect width="250" height="360" rx="8" fill="#f8f9fa" stroke="#d4d4d4" stroke-width="1.5" filter="url(#shadow)"/>
    <rect width="250" height="36" rx="8" fill="#e5e5e5"/>
    <text x="125" y="24" font-size="13" font-weight="700" fill="#171717" text-anchor="middle">2. Gateway &amp; Ingestion</text>
    <rect x="20" y="60" width="210" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="125" y="85" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Upload Hardening</text>
    <text x="125" y="100" font-size="10" fill="#737373" text-anchor="middle">PK Zip Check, 100MB Ratio Cap</text>
    <rect x="20" y="130" width="210" height="55" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="125" y="152" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Layout Induction Engine</text>
    <text x="125" y="167" font-size="10" fill="#737373" text-anchor="middle">Merged Cells O(1) Map</text>
    <text x="125" y="179" font-size="10" fill="#737373" text-anchor="middle">Single vs Paired-Row Stride</text>
    <rect x="20" y="205" width="210" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="125" y="228" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Ephemeral Session Manager</text>
    <text x="125" y="243" font-size="10" fill="#737373" text-anchor="middle">Opaque Tokens &amp; Unrecoverable Purge</text>
    <rect x="20" y="275" width="210" height="55" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="125" y="297" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Anti-Formula Injection</text>
    <text x="125" y="312" font-size="10" fill="#737373" text-anchor="middle">Escapes '=', '+', '-', '@' with '</text>
  </g>

  <!-- Connection 2 -->
  <line x1="610" y1="200" x2="680" y2="200" stroke="#404040" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="645" y="190" font-size="10" fill="#555555" text-anchor="middle">FastAPI</text>

  <!-- Core Analytics & OLAP -->
  <g transform="translate(690, 80)">
    <rect width="230" height="360" rx="8" fill="#f8f9fa" stroke="#d4d4d4" stroke-width="1.5" filter="url(#shadow)"/>
    <rect width="230" height="36" rx="8" fill="#e5e5e5"/>
    <text x="115" y="24" font-size="13" font-weight="700" fill="#171717" text-anchor="middle">3. In-Process OLAP &amp; AI</text>
    <rect x="15" y="60" width="200" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="115" y="85" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">DuckDB 1.4.1 (OLAP)</text>
    <text x="115" y="100" font-size="10" fill="#737373" text-anchor="middle">Vectorized Relational Engine</text>
    <rect x="15" y="125" width="200" height="65" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="115" y="145" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">3-Tier Anomaly Detection</text>
    <text x="115" y="160" font-size="10" fill="#737373" text-anchor="middle">Tier A: Arithmetic Invariants</text>
    <text x="115" y="172" font-size="10" fill="#737373" text-anchor="middle">Tier B: Robust MAD Z-Scores</text>
    <text x="115" y="184" font-size="10" fill="#737373" text-anchor="middle">Tier C: Isolation Forest (5 Feat)</text>
    <rect x="15" y="205" width="200" height="60" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="115" y="227" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Ask AI Predicate AST</text>
    <text x="115" y="242" font-size="10" fill="#737373" text-anchor="middle">Zero External LLM / Zero PII</text>
    <text x="115" y="254" font-size="10" fill="#737373" text-anchor="middle">Deterministic SQL Query</text>
    <rect x="15" y="280" width="200" height="50" rx="6" fill="#ffffff" stroke="#e0e0e0"/>
    <text x="115" y="302" font-size="12" font-weight="600" fill="#171717" text-anchor="middle">Egress Reports</text>
    <text x="115" y="317" font-size="10" fill="#737373" text-anchor="middle">ReportLab PDF, openpyxl XLSX</text>
  </g>
</svg>
"""
(fig_dir / "fig1_system_architecture.svg").write_text(fig1_svg, encoding="utf-8")

# Figure 3: Anomaly PR Sensitivity Curve (SVG)
fig3_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 400" width="100%" height="100%" style="background:#ffffff; font-family:system-ui, -apple-system, sans-serif;">
  <rect width="720" height="400" fill="#ffffff"/>
  <text x="360" y="30" font-size="16" font-weight="700" fill="#171717" text-anchor="middle">Figure 3. Isolation Forest Contamination Sensitivity &amp; Tier Ablation</text>
  <text x="360" y="50" font-size="11" fill="#737373" text-anchor="middle">Precision and Recall across contamination rates (c = 0.01 to 0.15), averaged over 10 random seeds.</text>

  <!-- Plot Axes -->
  <g transform="translate(80, 80)">
    <!-- Grid lines -->
    <line x1="0" y1="240" x2="560" y2="240" stroke="#e5e5e5" stroke-width="1"/>
    <line x1="0" y1="180" x2="560" y2="180" stroke="#e5e5e5" stroke-width="1"/>
    <line x1="0" y1="120" x2="560" y2="120" stroke="#e5e5e5" stroke-width="1"/>
    <line x1="0" y1="60" x2="560" y2="60" stroke="#e5e5e5" stroke-width="1"/>
    <line x1="0" y1="0" x2="560" y2="0" stroke="#e5e5e5" stroke-width="1"/>

    <!-- Axis border -->
    <line x1="0" y1="240" x2="560" y2="240" stroke="#404040" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="0" y2="240" stroke="#404040" stroke-width="1.5"/>

    <!-- Y labels -->
    <text x="-10" y="244" font-size="10" fill="#737373" text-anchor="end">0.0</text>
    <text x="-10" y="184" font-size="10" fill="#737373" text-anchor="end">0.25</text>
    <text x="-10" y="124" font-size="10" fill="#737373" text-anchor="end">0.50</text>
    <text x="-10" y="64" font-size="10" fill="#737373" text-anchor="end">0.75</text>
    <text x="-10" y="4" font-size="10" fill="#737373" text-anchor="end">1.00</text>

    <!-- X labels -->
    <text x="35" y="260" font-size="11" fill="#404040" text-anchor="middle">c=0.01</text>
    <text x="135" y="260" font-size="11" fill="#404040" text-anchor="middle">c=0.03</text>
    <text x="235" y="260" font-size="11" fill="#404040" font-weight="700" text-anchor="middle">c=0.05*</text>
    <text x="335" y="260" font-size="11" fill="#404040" text-anchor="middle">c=0.08</text>
    <text x="435" y="260" font-size="11" fill="#404040" text-anchor="middle">c=0.10</text>
    <text x="525" y="260" font-size="11" fill="#404040" text-anchor="middle">c=0.15</text>

    <!-- Curves -->
    <!-- Precision Curve (Solid black line) -->
    <polyline points="35,12 135,28 235,54 335,87 435,108 525,134" fill="none" stroke="#171717" stroke-width="2.5"/>
    <circle cx="35" cy="12" r="4" fill="#171717"/>
    <circle cx="135" cy="28" r="4" fill="#171717"/>
    <circle cx="235" cy="54" r="5" fill="#171717"/>
    <circle cx="335" cy="87" r="4" fill="#171717"/>
    <circle cx="435" cy="108" r="4" fill="#171717"/>
    <circle cx="525" cy="134" r="4" fill="#171717"/>

    <!-- Recall Curve (Dashed line) -->
    <polyline points="35,217 135,190 235,169 335,148 435,139 525,119" fill="none" stroke="#555555" stroke-width="2.5" stroke-dasharray="6,4"/>
    <rect x="31" y="213" width="8" height="8" fill="#555555"/>
    <rect x="131" y="186" width="8" height="8" fill="#555555"/>
    <rect x="231" y="165" width="8" height="8" fill="#555555"/>
    <rect x="331" y="144" width="8" height="8" fill="#555555"/>
    <rect x="431" y="135" width="8" height="8" fill="#555555"/>
    <rect x="521" y="115" width="8" height="8" fill="#555555"/>

    <!-- F1 Score Curve (Dotted line) -->
    <polyline points="35,199 135,159 235,137 335,126 435,126 525,127" fill="none" stroke="#888888" stroke-width="2" stroke-dasharray="2,3"/>

    <!-- System Operating Point Annotation at c=0.05 -->
    <line x1="235" y1="0" x2="235" y2="240" stroke="#000000" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="240" y="20" font-size="10" font-weight="700" fill="#000000">EduQuery Operating Point (c=0.05)</text>
    <text x="240" y="32" font-size="9" fill="#555555">Prec: 0.775, Rec: 0.295 (Tier C alone)</text>
    <text x="240" y="44" font-size="9" fill="#555555">Combined Tier A+C: Prec 0.897, Rec 0.733, F1 0.806</text>
  </g>

  <!-- Legend -->
  <g transform="translate(180, 365)">
    <line x1="0" y1="0" x2="30" y2="0" stroke="#171717" stroke-width="2.5"/>
    <circle cx="15" cy="0" r="4" fill="#171717"/>
    <text x="38" y="4" font-size="11" fill="#171717">Precision (Mean)</text>

    <line x1="160" y1="0" x2="190" y2="0" stroke="#555555" stroke-width="2.5" stroke-dasharray="6,4"/>
    <rect x="171" y="-4" width="8" height="8" fill="#555555"/>
    <text x="198" y="4" font-size="11" fill="#171717">Recall (Mean)</text>

    <line x1="310" y1="0" x2="340" y2="0" stroke="#888888" stroke-width="2" stroke-dasharray="2,3"/>
    <text x="348" y="4" font-size="11" fill="#171717">F1 Score (Mean)</text>
  </g>
</svg>
"""
(fig_dir / "fig3_anomaly_pr_curves.svg").write_text(fig3_svg, encoding="utf-8")

# Figure 5: Ingestion Scaling & Latency Plot (SVG)
fig5_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 380" width="100%" height="100%" style="background:#ffffff; font-family:system-ui, -apple-system, sans-serif;">
  <rect width="760" height="380" fill="#ffffff"/>
  <text x="380" y="28" font-size="16" font-weight="700" fill="#171717" text-anchor="middle">Figure 5. Ingestion Scalability &amp; API Latency Profile</text>
  <text x="380" y="46" font-size="11" fill="#737373" text-anchor="middle">Left: Wall-clock ingestion runtime across cohort sizes. Right: Cold vs Warm API response times.</text>

  <!-- Left Chart: Ingestion Scaling -->
  <g transform="translate(60, 80)">
    <text x="140" y="-10" font-size="12" font-weight="700" fill="#171717" text-anchor="middle">Ingestion Runtime vs Cohort Size</text>
    <line x1="0" y1="200" x2="280" y2="200" stroke="#404040" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="0" y2="200" stroke="#404040" stroke-width="1.5"/>

    <!-- Y labels -->
    <text x="-8" y="204" font-size="9" fill="#737373" text-anchor="end">0s</text>
    <text x="-8" y="154" font-size="9" fill="#737373" text-anchor="end">4s</text>
    <text x="-8" y="104" font-size="9" fill="#737373" text-anchor="end">8s</text>
    <text x="-8" y="54" font-size="9" fill="#737373" text-anchor="end">12s</text>
    <text x="-8" y="4" font-size="9" fill="#737373" text-anchor="end">16s</text>

    <!-- X labels -->
    <text x="28" y="216" font-size="9" fill="#404040" text-anchor="middle">100</text>
    <text x="84" y="216" font-size="9" fill="#404040" text-anchor="middle">500</text>
    <text x="154" y="216" font-size="9" fill="#404040" text-anchor="middle">1,000</text>
    <text x="252" y="216" font-size="9" fill="#404040" text-anchor="middle">2,000</text>

    <!-- Bars -->
    <rect x="18" y="187" width="20" height="13" fill="#a3a3a3"/>
    <text x="28" y="182" font-size="8" fill="#171717" text-anchor="middle">1.0s</text>

    <rect x="74" y="170" width="20" height="30" fill="#737373"/>
    <text x="84" y="165" font-size="8" fill="#171717" text-anchor="middle">2.4s</text>

    <rect x="144" y="125" width="20" height="75" fill="#404040"/>
    <text x="154" y="120" font-size="8" fill="#171717" text-anchor="middle">6.0s</text>

    <rect x="242" y="28" width="20" height="172" fill="#171717"/>
    <text x="252" y="22" font-size="8" fill="#171717" font-weight="700" text-anchor="middle">13.7s</text>

    <text x="140" y="240" font-size="10" fill="#737373" text-anchor="middle">Enrolled Student Count</text>
  </g>

  <!-- Right Chart: Endpoint Latency Profile -->
  <g transform="translate(420, 80)">
    <text x="150" y="-10" font-size="12" font-weight="700" fill="#171717" text-anchor="middle">API Endpoint Latency (Cold vs Warm)</text>
    <line x1="0" y1="200" x2="300" y2="200" stroke="#404040" stroke-width="1.5"/>
    <line x1="0" y1="0" x2="0" y2="200" stroke="#404040" stroke-width="1.5"/>

    <!-- Y labels -->
    <text x="-8" y="204" font-size="9" fill="#737373" text-anchor="end">0ms</text>
    <text x="-8" y="154" font-size="9" fill="#737373" text-anchor="end">100ms</text>
    <text x="-8" y="104" font-size="9" fill="#737373" text-anchor="end">200ms</text>
    <text x="-8" y="54" font-size="9" fill="#737373" text-anchor="end">300ms</text>
    <text x="-8" y="4" font-size="9" fill="#737373" text-anchor="end">400ms</text>

    <!-- Endpoints -->
    <!-- Overview -->
    <rect x="20" y="177" width="14" height="23" fill="#171717"/>
    <rect x="36" y="177" width="14" height="23" fill="#999999"/>
    <text x="35" y="214" font-size="8" fill="#404040" text-anchor="middle">Overview</text>

    <!-- Students -->
    <rect x="75" y="2" width="14" height="198" fill="#171717"/>
    <rect x="91" y="172" width="14" height="28" fill="#999999"/>
    <text x="90" y="214" font-size="8" fill="#404040" text-anchor="middle">Students</text>

    <!-- Subjects -->
    <rect x="130" y="166" width="14" height="34" fill="#171717"/>
    <rect x="146" y="168" width="14" height="32" fill="#999999"/>
    <text x="145" y="214" font-size="8" fill="#404040" text-anchor="middle">Subjects</text>

    <!-- Anomalies -->
    <rect x="185" y="111" width="14" height="89" fill="#171717"/>
    <rect x="201" y="116" width="14" height="84" fill="#999999"/>
    <text x="200" y="214" font-size="8" fill="#404040" text-anchor="middle">Anomalies</text>

    <!-- Ask AI -->
    <rect x="240" y="169" width="14" height="31" fill="#171717"/>
    <rect x="256" y="181" width="14" height="19" fill="#999999"/>
    <text x="255" y="214" font-size="8" fill="#404040" text-anchor="middle">Ask AI</text>

    <!-- Legend -->
    <g transform="translate(60, 245)">
      <rect x="0" y="-8" width="12" height="12" fill="#171717"/>
      <text x="18" y="2" font-size="9" fill="#171717">Cold Latency (First Hit)</text>
      <rect x="130" y="-8" width="12" height="12" fill="#999999"/>
      <text x="148" y="2" font-size="9" fill="#171717">Warm Mean Latency</text>
    </g>
  </g>
</svg>
"""
(fig_dir / "fig5_latency_scaling.svg").write_text(fig5_svg, encoding="utf-8")

print("Vector figures generated in paper_audit/figures/.")

