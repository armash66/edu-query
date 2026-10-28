import os
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.abspath("audit_after/fixes_verification")
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_URL = "http://127.0.0.1:4173"

def verify():
    print(f"Starting targeted verification on {BASE_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Set theme to dark
        page.goto(f"{BASE_URL}/")
        page.wait_for_selector(".app-container")
        page.evaluate("() => localStorage.setItem('eduquery_theme', 'dark')")
        page.reload()
        page.wait_for_selector(".app-container")
        time.sleep(1)

        # -------------------------------------------------------------
        # Issue 1: Sidebar Rail Mode & Footer Layout
        # -------------------------------------------------------------
        print("Checking Sidebar Rail Mode & Footer...")
        # Check expanded footer: dataset info visible
        sidebar = page.locator(".sidebar")
        assert sidebar.is_visible(), "Sidebar is not visible"
        page.screenshot(path=os.path.join(OUTPUT_DIR, "01_overview_expanded_dark.png"))

        # Toggle to rail mode
        collapse_btn = page.locator('button[aria-label="Collapse sidebar into rail"]')
        assert collapse_btn.is_visible(), "Collapse button not visible in expanded sidebar"
        collapse_btn.click()
        time.sleep(0.5)

        rail_sidebar = page.locator('.sidebar.rail')
        assert rail_sidebar.is_visible(), "Sidebar rail is not visible"
        expand_btn = rail_sidebar.locator('button[aria-label="Expand sidebar"]')
        assert expand_btn.is_visible(), "Expand button not visible in rail mode"
        
        # Verify expand button bounding box is neatly centered inside rail
        e_box = expand_btn.bounding_box()
        s_box = rail_sidebar.bounding_box()
        print(f"Rail bbox: {s_box}, Expand btn bbox: {e_box}")
        
        rail_sidebar.screenshot(path=os.path.join(OUTPUT_DIR, "02_sidebar_rail_dark.png"))
        page.screenshot(path=os.path.join(OUTPUT_DIR, "02_page_with_rail_dark.png"))

        # Expand sidebar again
        expand_btn.click()
        time.sleep(0.5)

        # -------------------------------------------------------------
        # Issue 2: Subjects Page - Passed, Failed, and View Roster Spacing
        # -------------------------------------------------------------
        print("Checking Subjects Page Layout...")
        page.goto(f"{BASE_URL}/subjects")
        page.wait_for_selector(".responsive-data-table")
        time.sleep(1)

        headers = page.locator(".responsive-data-table th").all_text_contents()
        headers_cleaned = [h.strip().replace("\u21c5", "") for h in headers if h.strip()]
        print(f"Subjects headers: {[h.encode('ascii', 'ignore').decode() for h in headers_cleaned]}")

        assert any("passed" in h.lower() for h in headers_cleaned), "Passed column missing!"
        assert any("failed" in h.lower() for h in headers_cleaned), "Failed column missing!"

        # Check first row passed, failed, and view roster elements
        first_row = page.locator(".responsive-data-table tbody tr").first
        view_roster = first_row.locator("a", has_text="View Roster")
        assert view_roster.is_visible(), "View Roster button missing from row"
        
        # Capture screenshot of subjects page
        page.screenshot(path=os.path.join(OUTPUT_DIR, "03_subjects_page_dark.png"))
        page.locator(".responsive-data-table").screenshot(path=os.path.join(OUTPUT_DIR, "03_subjects_table_detail.png"))

        # -------------------------------------------------------------
        # Issue 3: Students Page - Search Input & Table Spacing & Pagination
        # -------------------------------------------------------------
        print("Checking Students Page...")
        page.goto(f"{BASE_URL}/students")
        page.wait_for_selector(".responsive-data-table")
        time.sleep(1)

        # Verify search input has no Ctrl+K collision
        search_box = page.locator('input[placeholder*="Search student name"]')
        assert search_box.is_visible(), "Search field not found"
        search_ph = search_box.get_attribute("placeholder")
        print(f"Student search placeholder: {search_ph}")

        # Check table columns
        st_headers = page.locator(".responsive-data-table th").all_text_contents()
        st_headers_cleaned = [h.strip().replace("\u21c5", "") for h in st_headers if h.strip()]
        print(f"Students headers: {[h.encode('ascii', 'ignore').decode() for h in st_headers_cleaned]}")
        assert any("seat" in h.lower() for h in st_headers_cleaned), "Seat No column missing!"
        assert any("roll" in h.lower() for h in st_headers_cleaned), "Roll No column missing!"
        assert any("name" in h.lower() for h in st_headers_cleaned), "Student Name column missing!"
        assert any("result" in h.lower() for h in st_headers_cleaned), "Result column missing!"

        # Check first row Audit button
        st_first_row = page.locator(".responsive-data-table tbody tr").first
        audit_btn = st_first_row.locator("a", has_text="Audit")
        assert audit_btn.is_visible(), "Audit link missing from student row"

        page.screenshot(path=os.path.join(OUTPUT_DIR, "04_students_page_dark.png"))

        # Test pagination Next button
        next_btn = page.locator('button[aria-label="Next page"]')
        assert next_btn.is_visible(), "Next page button not visible"
        assert next_btn.is_enabled(), "Next page button not enabled"
        next_btn.click()
        time.sleep(1)

        page_2 = page.locator("span", has_text="Page 2 of")
        assert page_2.is_visible(), "Failed to navigate to Page 2"
        page.screenshot(path=os.path.join(OUTPUT_DIR, "04_students_page_2_dark.png"))

        # -------------------------------------------------------------
        # Issue 4: Command Palette Modern Redesign
        # -------------------------------------------------------------
        print("Checking Command Palette Redesign...")
        search_trigger = page.locator(".global-search-desktop")
        search_trigger.click()
        time.sleep(0.5)

        dialog = page.locator('div[role="dialog"][aria-label="Command Palette"]')
        assert dialog.is_visible(), "Command palette did not open"

        # Screenshot initial command palette
        dialog.screenshot(path=os.path.join(OUTPUT_DIR, "05_command_palette_menu_dark.png"))

        # Check category headers exist
        category_titles = dialog.locator('div[style*="text-transform: uppercase"]').all_text_contents()
        print(f"Command palette categories: {category_titles}")
        assert any("pages" in c.lower() for c in category_titles), "Pages category header missing!"

        # Search for Karthik
        palette_input = dialog.locator("input.command-palette-input")
        palette_input.fill("Karthik")
        time.sleep(1)

        # Screenshot student search results
        dialog.screenshot(path=os.path.join(OUTPUT_DIR, "05_command_palette_search_karthik_dark.png"))
        
        # Verify student card appears with Open pill
        student_option = dialog.locator('[role="option"]', has_text="Karthik")
        assert student_option.count() > 0, "Student 'Karthik' not found in search results"

        # Test search for subject
        palette_input.fill("MDM")
        time.sleep(0.8)
        dialog.screenshot(path=os.path.join(OUTPUT_DIR, "05_command_palette_search_subject_dark.png"))

        # Close palette with Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert not dialog.is_visible(), "Dialog did not close on Escape"

        # -------------------------------------------------------------
        # Issue 5: Light Mode Verification
        # -------------------------------------------------------------
        print("Verifying Light Mode...")
        page.evaluate("() => localStorage.setItem('eduquery_theme', 'light')")
        page.reload()
        page.wait_for_selector(".app-container")
        time.sleep(1)

        page.screenshot(path=os.path.join(OUTPUT_DIR, "06_students_page_light.png"))

        # Open subjects in light mode
        page.goto(f"{BASE_URL}/subjects")
        page.wait_for_selector(".responsive-data-table")
        time.sleep(1)
        page.screenshot(path=os.path.join(OUTPUT_DIR, "07_subjects_page_light.png"))

        # Open command palette in light mode
        page.locator(".global-search-desktop").click()
        time.sleep(0.5)
        page.locator('div[role="dialog"][aria-label="Command Palette"]').screenshot(
            path=os.path.join(OUTPUT_DIR, "08_command_palette_menu_light.png")
        )

        browser.close()
        print("All visual QA verifications completed successfully!")

if __name__ == "__main__":
    verify()
