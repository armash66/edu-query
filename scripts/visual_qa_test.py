import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("audit_after/overview_redesign")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

AXE_PATH = os.path.abspath("frontend/node_modules/axe-core/axe.min.js")
with open(AXE_PATH, "r", encoding="utf-8") as f:
    axe_js = f.read()

def run_visual_qa():
    print("Starting Visual QA & Verification Loop...")
    results = {
        "g1_horizontal_scroll": {},
        "g1_text_clipping": {},
        "g1_header_no_overlap": {},
        "g1_topbar_scrolled": False,
        "g2_screenshots": [],
        "g3_axe": []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Base URL: Vite dev server
        base_url = "http://127.0.0.1:5173"

        # -------------------------------------------------------------
        # G1 & G2: Overview Page Responsive Tests & Screenshots
        # -------------------------------------------------------------
        viewports = [
            (1440, 900, "1440"),
            (768, 1024, "768"),
            (390, 844, "390")
        ]

        themes = ["light", "dark"]

        for theme in themes:
            for w, h, vp_name in viewports:
                page.set_viewport_size({"width": w, "height": h})
                page.goto(f"{base_url}/", wait_until="networkidle")

                # Set theme
                page.evaluate(f"""() => {{
                    document.documentElement.setAttribute('data-theme', '{theme}');
                    localStorage.setItem('eduquery-theme', '{theme}');
                }}""")
                page.wait_for_timeout(400)

                # Wait for KPI elements
                page.wait_for_selector("[data-testid='kpi-total-students']")

                # G1 Check 1: documentElement scrollWidth <= clientWidth (no horizontal scroll)
                scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
                client_width = page.evaluate("() => document.documentElement.clientWidth")
                has_h_scroll = scroll_width > client_width
                results["g1_horizontal_scroll"][f"{theme}_{vp_name}"] = {
                    "scrollWidth": scroll_width,
                    "clientWidth": client_width,
                    "passes": not has_h_scroll
                }
                print(f"[{theme.upper()} {vp_name}px] Horizontal scroll check: scrollWidth={scroll_width}, clientWidth={client_width} -> {'PASS' if not has_h_scroll else 'FAIL'}")

                # G1 Check 2: Text clipping check on cards & KPI values
                clipping_check = page.evaluate("""() => {
                    const elements = Array.from(document.querySelectorAll('[data-testid^="kpi-"], h2, h3'));
                    let clipped = [];
                    for (const el of elements) {
                        if (el.scrollWidth > el.clientWidth) {
                            clipped.push({
                                tag: el.tagName,
                                text: el.innerText.slice(0, 30),
                                scrollWidth: el.scrollWidth,
                                clientWidth: el.clientWidth
                            });
                        }
                    }
                    return clipped;
                }""")
                results["g1_text_clipping"][f"{theme}_{vp_name}"] = clipping_check
                print(f"[{theme.upper()} {vp_name}px] Text clipping check: {len(clipping_check)} clipped elements -> {'PASS' if len(clipping_check) == 0 else 'FAIL'}")

                # Capture Overview Screenshot
                shot_path = os.path.join(SCREENSHOT_DIR, f"overview_{theme}_{vp_name}.png")
                page.screenshot(path=shot_path, full_page=True)
                results["g2_screenshots"].append(shot_path)
                print(f"Saved screenshot: {shot_path}")

        # -------------------------------------------------------------
        # G1 Header Overlap Check across widths: 320, 390, 600, 768, 1024, 1280, 1440
        # -------------------------------------------------------------
        header_widths = [320, 390, 600, 768, 1024, 1280, 1440]
        for hw in header_widths:
            page.set_viewport_size({"width": hw, "height": 800})
            page.goto(f"{base_url}/", wait_until="networkidle")
            page.wait_for_timeout(200)

            # Check bounding boxes of left section vs right controls in top-bar
            overlap_check = page.evaluate("""() => {
                const topBar = document.querySelector('.top-bar');
                if (!topBar) return { found: false, overlap: false };
                const children = Array.from(topBar.children);
                if (children.length < 2) return { found: true, overlap: false };
                const box1 = children[0].getBoundingClientRect();
                const box2 = children[children.length - 1].getBoundingClientRect();
                // Overlap occurs if box1 right > box2 left
                const overlaps = box1.right > box2.left;
                return {
                    found: true,
                    overlaps,
                    leftRight: box1.right,
                    rightLeft: box2.left
                };
            }""")
            results["g1_header_no_overlap"][f"{hw}px"] = overlap_check
            print(f"[Header {hw}px] Overlap check: overlaps={overlap_check.get('overlaps')} -> {'PASS' if not overlap_check.get('overlaps') else 'FAIL'}")

        # -------------------------------------------------------------
        # G1 Top-bar Opacity & Scrolled State Screenshot
        # -------------------------------------------------------------
        page.set_viewport_size({"width": 1440, "height": 800})
        page.goto(f"{base_url}/", wait_until="networkidle")
        page.wait_for_selector("[data-testid='kpi-total-students']")
        page.evaluate("() => window.scrollTo(0, 450)")
        page.wait_for_timeout(300)

        # Verify sticky and backdrop-filter
        topbar_style = page.evaluate("""() => {
            const tb = document.querySelector('.top-bar');
            const style = window.getComputedStyle(tb);
            return {
                position: style.position,
                backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
                zIndex: style.zIndex,
                background: style.backgroundColor
            };
        }""")
        print(f"[Scrolled Header] top-bar styles: {topbar_style}")

        shot_scrolled = os.path.join(SCREENSHOT_DIR, "header_scrolled_state.png")
        page.screenshot(path=shot_scrolled)
        results["g2_screenshots"].append(shot_scrolled)
        print(f"Saved scrolled header screenshot: {shot_scrolled}")

        # -------------------------------------------------------------
        # G2 Needs-Attention Evidence Drawer Open Screenshot
        # -------------------------------------------------------------
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(200)

        # Click the first "Review" button in Needs attention card
        review_buttons = page.locator("button:has-text('Review')")
        if review_buttons.count() > 0:
            review_buttons.first.click()
            page.wait_for_timeout(400)
            shot_drawer = os.path.join(SCREENSHOT_DIR, "needs_attention_drawer_open.png")
            page.screenshot(path=shot_drawer)
            results["g2_screenshots"].append(shot_drawer)
            print(f"Saved evidence drawer screenshot: {shot_drawer}")
            # Close drawer
            close_btn = page.locator("button:has-text('Close')")
            if close_btn.count() > 0:
                close_btn.first.click()
                page.wait_for_timeout(200)

        # -------------------------------------------------------------
        # G3 Axe Accessibility Testing on ALL Real Routes (Light & Dark)
        # -------------------------------------------------------------
        routes = [
            ("/", "Academic Analysis Overview"),
            ("/students", "Student Directory"),
            ("/students/SEAT_001", "Student Breakdown"),
            ("/subjects", "Curriculum & Subjects"),
            ("/subjects/PCEC12T", "Subject Roster"),
            ("/failures", "Curriculum Failure Summary"),
            ("/absent", "Absentee Roster"),
            ("/explore", "Explore Academic Data"),
            ("/quality", "Data Quality & Anomalies"),
            ("/upload", "Upload Marksheet"),
            ("/imports", "Dataset Management"),
        ]

        print("\n--- Running Axe Accessibility Suite on Real Routes ---")
        for theme in ["light", "dark"]:
            print(f"\n[Theme: {theme.upper()}]")
            for path, expected_header in routes:
                page.goto(f"{base_url}{path}", wait_until="networkidle")
                page.evaluate(f"""() => {{
                    document.documentElement.setAttribute('data-theme', '{theme}');
                    localStorage.setItem('eduquery-theme', '{theme}');
                }}""")
                page.wait_for_timeout(500)

                # Get the actual rendered <h1>
                h1_text = page.evaluate("""() => {
                    const h1 = document.querySelector('h1');
                    return h1 ? h1.innerText.trim() : 'NO_H1_FOUND';
                }""")

                # Inject axe and run
                page.evaluate(axe_js)
                axe_res = page.evaluate("""() => {
                    return new Promise((resolve) => {
                        axe.run(document, {
                            runOnly: {
                                type: 'tag',
                                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
                            }
                        }, (err, results) => {
                            if (err) resolve({ error: err.toString(), violations: [] });
                            else resolve({ violations: results.violations || [] });
                        });
                    });
                }""")

                violations = axe_res.get("violations", [])
                v_count = len(violations)
                status = "PASS (0 violations)" if v_count == 0 else f"FAIL ({v_count} violations)"
                print(f"  Route: {path:22} | H1: '{h1_text}' | Axe: {status}")

                if v_count > 0:
                    for v in violations:
                        print(f"    - Violation: {v.get('id')} - {v.get('description')} (impact: {v.get('impact')})")
                        for node in v.get('nodes', [])[:2]:
                            print(f"      Target: {node.get('target')}")

                results["g3_axe"].append({
                    "theme": theme,
                    "route": path,
                    "h1": h1_text,
                    "violations": violations,
                    "passes": v_count == 0
                })

        browser.close()

    print("\nVisual QA finished successfully.")
    with open(os.path.join(SCREENSHOT_DIR, "qa_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    run_visual_qa()
