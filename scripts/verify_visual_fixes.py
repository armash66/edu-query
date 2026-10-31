import asyncio
import io
import pypdf
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # 1. Students Page
        print("Navigating to Students page...")
        await page.goto("http://localhost:5173/students", wait_until="networkidle")
        await page.wait_for_selector(".responsive-data-table", timeout=10000)
        await page.screenshot(path="audit_after/visual_qa/students_table_fixed.png")
        print("Captured audit_after/visual_qa/students_table_fixed.png")

        # 2. Print Roster Emulation
        print("Emulating print media on Students page...")
        await page.emulate_media(media="print")
        await page.screenshot(path="audit_after/visual_qa/students_print_roster_verified.png", full_page=False)
        print("Captured audit_after/visual_qa/students_print_roster_verified.png")

        # Restore screen media
        await page.emulate_media(media="screen")

        # 3. Follow-Ups Notices Tab
        print("Navigating to Follow-ups Notices tab...")
        await page.goto("http://localhost:5173/follow-ups?tab=notices", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="audit_after/visual_qa/followups_notices_verified.png")
        print("Captured audit_after/visual_qa/followups_notices_verified.png")

        # Click Check All Mails
        check_all_btn = page.locator('button:has-text("Check All Mails")')
        if await check_all_btn.count() > 0:
            await check_all_btn.click()
            await page.wait_for_timeout(500)
            await page.screenshot(path="audit_after/visual_qa/followups_all_mails_reviewed.png")
            print("Captured audit_after/visual_qa/followups_all_mails_reviewed.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
