import os
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.abspath("audit_after/fixes_verification")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def verify():
    print("Starting targeted verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Set theme to dark first (since user screenshots were in dark mode)
        page.goto("http://127.0.0.1:5173/")
        page.wait_for_selector(".app-container")
        page.evaluate("() => localStorage.setItem('eduquery_theme', 'dark')")
        page.reload()
        page.wait_for_selector(".app-container")
        time.sleep(1)

        # -------------------------------------------------------------
        # Issue 1: Sidebar Rail Mode (Image 1 & 4)
        # -------------------------------------------------------------
        print("Checking Sidebar Rail Mode...")
        # Toggle rail mode
        rail_btn = page.locator('button[aria-label="Collapse sidebar into rail"]')
        if rail_btn.is_visible():
            rail_btn.click()
            time.sleep(0.5)

        # Ensure sidebar has .rail class
        sidebar = page.locator('.sidebar.rail')
        assert sidebar.is_visible(), "Sidebar rail is not visible"

        # Check footer buttons in rail mode
        theme_btn = sidebar.locator('button[aria-label^="Theme:"]')
        expand_btn = sidebar.locator('button[aria-label="Expand sidebar"]')
        
        t_box = theme_btn.bounding_box()
        e_box = expand_btn.bounding_box()
        print(f"Theme button bbox: {t_box}")
        print(f"Expand button bbox: {e_box}")

        # Check that they do NOT overlap vertically or horizontally
        # Vertically stacked: e_box.y should be >= t_box.y + t_box.height
        is_overlapping = not (
            t_box["x"] + t_box["width"] <= e_box["x"] or
            e_box["x"] + e_box["width"] <= t_box["x"] or
            t_box["y"] + t_box["height"] <= e_box["y"] or
            e_box["y"] + e_box["height"] <= t_box["y"]
        )
        print(f"Are rail footer buttons overlapping? {is_overlapping}")
        assert not is_overlapping, "Rail footer buttons are overlapping!"

        # Screenshot sidebar rail in dark mode
        sidebar.screenshot(path=os.path.join(OUTPUT_DIR, "sidebar_rail_dark.png"))
        page.screenshot(path=os.path.join(OUTPUT_DIR, "page_with_rail_dark.png"))

        # Switch back to expanded sidebar
        expand_btn.click()
        time.sleep(0.5)

        # -------------------------------------------------------------
        # Issue 2: Subjects Page - Passed and Failed columns (Image 2)
        # -------------------------------------------------------------
        print("Checking Subjects Page Columns...")
        page.goto("http://127.0.0.1:5173/subjects")
        page.wait_for_selector(".responsive-data-table")
        time.sleep(1)

        # Verify headers in table
        headers = page.locator(".responsive-data-table th").all_text_contents()
        headers_cleaned = [h.strip().replace("\u21c5", "") for h in headers if h.strip()]
        print(f"Subjects table headers: {[h.encode('ascii', 'ignore').decode() for h in headers_cleaned]}")

        assert any("passed" in h.lower() for h in headers_cleaned), "Passed column missing from subjects table!"
        assert any("failed" in h.lower() for h in headers_cleaned), "Failed column missing from subjects table!"

        # Screenshot subjects table
        page.locator(".responsive-data-table").screenshot(path=os.path.join(OUTPUT_DIR, "subjects_table_with_passed_failed.png"))

        # -------------------------------------------------------------
        # Issue 3: Students Page - Continuation of records / pagination (Image 3)
        # -------------------------------------------------------------
        print("Checking Students Page Continuation...")
        page.goto("http://127.0.0.1:5173/students")
        page.wait_for_selector(".responsive-data-table")
        time.sleep(1)

        # Check pagination footer presence and text
        pagination_footer = page.locator(".glass-2 div", has_text="Showing")
        assert pagination_footer.count() > 0, "Pagination footer not found!"
        footer_text = pagination_footer.first.text_content()
        print(f"Pagination footer text: {footer_text}")
        assert "records" in footer_text.lower(), "Records count missing from pagination footer"

        # Check page count
        page_indicator = page.locator("span", has_text="Page 1 of")
        assert page_indicator.is_visible(), "Page indicator not visible"
        print(f"Page indicator: {page_indicator.text_content()}")

        # Check Next button and click it to test continuation of records
        next_btn = page.locator('button[aria-label="Next page"]')
        assert next_btn.is_visible(), "Next page button not visible"
        assert next_btn.is_enabled(), "Next page button should be enabled when multiple pages exist"
        
        # Capture page 1 screenshot
        page.screenshot(path=os.path.join(OUTPUT_DIR, "students_page_1_with_pagination.png"))

        next_btn.click()
        time.sleep(1)
        page_2_indicator = page.locator("span", has_text="Page 2 of")
        assert page_2_indicator.is_visible(), "Failed to navigate to Page 2 of students!"
        print(f"Successfully navigated to Page 2: {page_2_indicator.text_content()}")

        # Capture page 2 screenshot showing continuation
        page.screenshot(path=os.path.join(OUTPUT_DIR, "students_page_2_continuation.png"))

        # -------------------------------------------------------------
        # Issue 4: Command Palette / Search Menu (Image 5)
        # -------------------------------------------------------------
        print("Checking Command Palette / Search Menu...")
        # Click search trigger in top bar
        search_trigger = page.locator(".global-search-desktop")
        search_trigger.click()
        time.sleep(0.5)

        dialog = page.locator('div[role="dialog"][aria-label="Command Palette"]')
        assert dialog.is_visible(), "Command palette dialog did not open"

        # Screenshot initial command palette menu
        dialog.screenshot(path=os.path.join(OUTPUT_DIR, "command_palette_menu_initial.png"))

        # Check search input
        search_input = dialog.locator("input.command-palette-input")
        assert search_input.is_visible(), "Search input with command-palette-input class not visible"

        # Type student search query
        search_input.fill("Karthik")
        time.sleep(1)

        # Check if student result appeared
        dialog.screenshot(path=os.path.join(OUTPUT_DIR, "command_palette_student_search.png"))
        results_text = dialog.locator('ul[role="listbox"]').text_content()
        print(f"Search results for 'Karthik': {results_text[:100]}...")
        assert "karthik" in results_text.lower(), "Student search did not return matching student result!"

        # Close palette with Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert not dialog.is_visible(), "Dialog did not close on Escape"

        # Now test in Light Mode
        print("Switching to Light Mode to verify theme...")
        page.evaluate("() => localStorage.setItem('eduquery_theme', 'light')")
        page.reload()
        page.wait_for_selector(".app-container")
        time.sleep(1)

        # Re-check rail in light mode
        page.locator('button[aria-label="Collapse sidebar into rail"]').click()
        time.sleep(0.5)
        page.locator('.sidebar.rail').screenshot(path=os.path.join(OUTPUT_DIR, "sidebar_rail_light.png"))

        browser.close()
        print("Targeted verification completed successfully!")

if __name__ == "__main__":
    verify()
