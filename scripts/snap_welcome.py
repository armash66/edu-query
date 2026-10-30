import asyncio
import os
from playwright.async_api import async_playwright

async def snap():
    os.makedirs('audit_after/visual_qa', exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width, name in [(1440, '1440_desktop'), (768, '768_tablet'), (390, '390_mobile')]:
            for theme in ['dark', 'light']:
                context = await browser.new_context(viewport={'width': width, 'height': 900})
                page = await context.new_page()
                await page.goto('http://localhost:5173/upload', wait_until='networkidle')
                await page.evaluate(f"document.documentElement.setAttribute('data-theme', '{theme}')")
                await page.wait_for_timeout(400)
                path = f'audit_after/visual_qa/welcome_{theme}_{name}.png'
                await page.screenshot(path=path, full_page=True)
                scroll_width = await page.evaluate('document.documentElement.scrollWidth')
                client_width = await page.evaluate('document.documentElement.clientWidth')
                has_overflow = scroll_width > client_width
                print(f"{theme} {name}: scrollWidth={scroll_width}, clientWidth={client_width}, overflow={has_overflow}")
                await context.close()
        await browser.close()

if __name__ == '__main__':
    asyncio.run(snap())

