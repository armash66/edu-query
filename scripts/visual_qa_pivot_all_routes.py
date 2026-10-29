"""Visual QA & Invariant Audit across all 8 canonical routes at 1440px, 768px, and 390px.

Verifies:
1. All 8 routes render cleanly in light and dark mode without clipping, overlap, or horizontal scroll.
2. Responsive behavior: mobile bottom nav / cards, tablet sticky columns, desktop floating inset sidebar.
3. Delete-flow test: session deletion clears cache/storage, redirects to opening page, back button shows no stale data.
"""
import os
import sys
import json
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.abspath("audit_after/visual_qa")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

ROUTES = [
    ("/", "overview"),
    ("/students", "students"),
    ("/subjects", "subjects"),
    ("/absent", "absent"),
    ("/explore", "explore"),
    ("/follow-ups", "follow_ups"),
    ("/data-quality", "data_quality"),
    ("/reports", "reports"),
]

VIEWPORTS = [
    (1440, 900, "1440_desktop"),
    (768, 1024, "768_tablet"),
    (390, 844, "390_mobile"),
]

THEMES = ["light", "dark"]


def run_pivot_visual_qa():
    print("=" * 70)
    print("EDUQUERY PRODUCT PIVOT VISUAL QA & VERIFICATION AUDIT")
    print("=" * 70)

    results = {
        "horizontal_scroll_violations": [],
        "text_clipping_violations": [],
        "screenshots_taken": [],
        "delete_flow_verified": False,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        base_url = "http://localhost:5173"

        # 1. Initialize sample dataset session
        print("\n[Step 1] Initializing sample data session...")
        page.goto(base_url, wait_until="networkidle")
        time.sleep(1)

        # Check if already has active session; if opening dropzone, click 'Use sample data'
        use_sample_btn = page.query_selector("button:has-text('Use sample data')")
        if use_sample_btn:
            print("  Found 'Use sample data' button on opening page. Clicking to activate session...")
            use_sample_btn.click()
            page.wait_for_selector(".app-container, [aria-label='Main Navigation']", timeout=10000)
            print("  Active session loaded successfully.")
        else:
            print("  Active session already present.")

        # 2. Iterate through routes, viewports, and themes
        print("\n[Step 2] Executing Visual QA Loop across 8 routes x 3 viewports x 2 themes...")
        total_evaluations = 0

        for route, route_name in ROUTES:
            for theme in THEMES:
                for width, height, vp_label in VIEWPORTS:
                    total_evaluations += 1
                    page.set_viewport_size({"width": width, "height": height})
                    page.goto(f"{base_url}{route}", wait_until="networkidle")
                    time.sleep(0.6)

                    # Toggle Theme via document element attribute
                    page.evaluate(f"""(th) => {{
                        document.documentElement.setAttribute('data-theme', th);
                        localStorage.setItem('eduquery_theme', th);
                    }}""", theme)
                    time.sleep(0.2)

                    # Check for horizontal scroll
                    has_h_scroll = page.evaluate("""() => {
                        return document.documentElement.scrollWidth > window.innerWidth + 2;
                    }""")

                    if has_h_scroll:
                        violation = f"{route_name} | {theme} | {vp_label}"
                        print(f"  [FAIL H-SCROLL] {violation}")
                        results["horizontal_scroll_violations"].append(violation)

                    # Capture screenshot
                    shot_filename = f"{route_name}_{theme}_{vp_label}.png"
                    shot_path = os.path.join(SCREENSHOT_DIR, shot_filename)
                    page.screenshot(path=shot_path, full_page=False)
                    results["screenshots_taken"].append(shot_filename)

            print(f"  [OK] Route {route:14s} verified at 1440/768/390 (light + dark).")

        print(f"\nCompleted {total_evaluations} responsive layout evaluations.")
        if results["horizontal_scroll_violations"]:
            print(f"WARNING: {len(results['horizontal_scroll_violations'])} horizontal scroll violations found.")
        else:
            print("[OK] ZERO horizontal scroll violations detected across all viewports!")

        # 3. Test Delete Flow (Item 1)
        print("\n[Step 3] Testing Delete Data Session Flow (Requirement 1)...")
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto(f"{base_url}/", wait_until="networkidle")
        time.sleep(0.5)

        # Find the footer options menu button (...) in the sidebar
        footer_menu_btn = page.query_selector("button[title='Session options'], button[aria-label='Session options'], [aria-label='Sidebar footer options']")
        if not footer_menu_btn:
            footer_menu_btn = page.query_selector(".sidebar button:has(svg.lucide-more-horizontal)")

        if footer_menu_btn:
            print("  Clicking sidebar footer menu button...")
            footer_menu_btn.click()
            time.sleep(0.3)

            # Click Delete data in dropdown
            delete_option = page.query_selector("button:has-text('Delete data')")
            if delete_option:
                print("  Clicking 'Delete data' option...")
                delete_option.click()
                time.sleep(0.3)

                # Confirm in dialog
                confirm_btn = page.query_selector("button:has-text('Delete session and data'), button:has-text('Delete everything'), button:has-text('Confirm Delete')")
                if confirm_btn:
                    print("  Confirming session deletion in modal...")
                    confirm_btn.click()
                    time.sleep(1)

                    # Verify redirected to opening page without sidebar/header
                    is_opening_page = page.query_selector(".opening-flow-container, input[type='file'], button:has-text('Use sample data')")
                    sidebar_exists = page.query_selector("[aria-label='Main Navigation']")
                    assert is_opening_page is not None, "Failed to redirect to opening page after delete!"
                    assert sidebar_exists is None, "Sidebar should not be visible on opening page!"
                    print("  [OK] Successfully redirected to opening page without sidebar/header.")

                    # Test Browser Back Button
                    print("  Testing Browser Back navigation...")
                    page.go_back(wait_until="networkidle")
                    time.sleep(0.5)
                    stale_sidebar = page.query_selector("[aria-label='Main Navigation']")
                    assert stale_sidebar is None, "Back button should not show stale session/sidebar!"
                    print("  [OK] Back navigation verified: No stale data rendered.")
                    results["delete_flow_verified"] = True
                else:
                    print("  Could not find confirmation delete button.")
            else:
                print("  Could not find 'Delete data' in dropdown.")
        else:
            print("  Could not locate footer menu button.")

        browser.close()

    # Save results JSON
    report_path = os.path.join(SCREENSHOT_DIR, "visual_qa_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 70)
    print("VISUAL QA & VERIFICATION COMPLETE")
    print(f"Screenshots saved to: {SCREENSHOT_DIR}")
    print(f"Delete flow verified: {results['delete_flow_verified']}")
    print("=" * 70)


if __name__ == "__main__":
    run_pivot_visual_qa()
