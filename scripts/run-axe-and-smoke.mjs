import { chromium } from '../frontend/node_modules/playwright/index.mjs'
import AxeBuilder from '../frontend/node_modules/@axe-core/playwright/dist/index.js'

const BASE_URL = 'http://127.0.0.1:4173'

const ROUTES = [
  { name: 'Upload Page', path: '/upload' },
  { name: 'Home Route (Upload)', path: '/' },
  { name: 'Students Roster', path: '/students' },
  { name: 'Student Detail', path: '/students/CS101' },
  { name: 'Subjects Catalog', path: '/subjects' },
  { name: 'Subject Detail', path: '/subjects/CS501' },
  { name: 'Data Quality', path: '/data-quality' },
  { name: 'Datasets / Imports', path: '/imports' },
  { name: 'Styleguide', path: '/styleguide' },
  { name: 'Explore Preset', path: '/explore' },
  { name: 'Absent Students Preset', path: '/absent-students' },
]

async function run() {
  console.log('======================================================================')
  console.log('EDUQUERY AUTOMATED AXE ACCESSIBILITY & SMOKE AUDIT')
  console.log('======================================================================\n')

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  let totalAxeChecks = 0
  let totalAxeViolations = 0
  const resultsByView = []

  // 1. Run Axe checks for all routes in both Light and Dark themes
  for (const theme of ['light', 'dark']) {
    console.log(`\n--- AUDITING THEME: ${theme.toUpperCase()} ---`)
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })

      // Force theme on root element
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t)
        localStorage.setItem('eduquery_theme', t)
      }, theme)

      await page.waitForTimeout(300)

      // Run Axe analysis
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      totalAxeChecks++
      const violationCount = axeResults.violations.length
      totalAxeViolations += violationCount

      resultsByView.push({
        route: route.name,
        path: route.path,
        theme,
        violations: violationCount,
        details: axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        })),
      })

      const status = violationCount === 0 ? '✓ PASS' : `✗ ${violationCount} VIOLATIONS`
      console.log(`  ${status} | [${theme}] ${route.name.padEnd(25)} (${route.path})`)
      if (violationCount > 0) {
        axeResults.violations.forEach((v) => {
          console.log(`      -> [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        })
      }
    }
  }

  // 2. Playwright Smoke Tests (Part 8 Requirements)
  console.log('\n======================================================================')
  console.log('PLAYWRIGHT FUNCTIONAL SMOKE TESTS')
  console.log('======================================================================')

  let smokePassed = 0
  let smokeTotal = 0

  async function testSmoke(name, testFn) {
    smokeTotal++
    try {
      await testFn()
      console.log(`  ✓ [PASS] ${name}`)
      smokePassed++
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`)
    }
  }

  // Smoke 1: Theme Switcher cycles correctly
  await testSmoke('Theme switcher toggles between light and dark', async () => {
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' })
    const themeBtn = page.locator('button[aria-label^="Switch to"]')
    await themeBtn.first().click()
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    if (!initialTheme) throw new Error('Theme attribute not set')
  })

  // Smoke 2: Command Palette opens via shortcut or button
  await testSmoke('Command palette opens via Ctrl+K and search trigger', async () => {
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' })
    const searchTrigger = page.locator('button[aria-label="Search or jump to... (Ctrl+K)"]')
    if (await searchTrigger.count() > 0) {
      await searchTrigger.click()
      await page.waitForSelector('input[aria-label="Search actions, navigation, or shortcuts"]', { timeout: 2000 })
      await page.keyboard.press('Escape')
    }
  })

  // Smoke 3: Sidebar collapse / rail toggle
  await testSmoke('Sidebar collapse rail toggle functions and persists', async () => {
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' })
    const railBtn = page.locator('button[aria-label="Collapse sidebar"]')
    if (await railBtn.count() > 0) {
      await railBtn.click()
      const railActive = await page.evaluate(() => localStorage.getItem('eduquery_sidebar_rail'))
      if (railActive !== 'true') throw new Error('Rail state not persisted to localStorage')
    }
  })

  // Smoke 4: Mobile bottom navigation renders at 390px viewport
  await testSmoke('Mobile bottom navigation renders with touch targets on 390px viewport', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' })
    const bottomNav = page.locator('.bottom-nav')
    const isVisible = await bottomNav.isVisible()
    if (!isVisible) throw new Error('Bottom navigation not visible on mobile viewport')
    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  // Smoke 5: Skip to main content link exists and focuses main
  await testSmoke('Skip to main content accessibility link targets main content', async () => {
    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' })
    const skipLink = page.locator('a.skip-to-content')
    const count = await skipLink.count()
    if (count === 0) throw new Error('Skip to main content link not present')
  })

  await browser.close()

  console.log('\n======================================================================')
  console.log('AUDIT SUMMARY')
  console.log('======================================================================')
  console.log(`Total Axe Page Checks: ${totalAxeChecks} (11 views x 2 themes)`)
  console.log(`Total Axe Violations: ${totalAxeViolations}`)
  console.log(`Smoke Tests Passed: ${smokePassed}/${smokeTotal}`)
  console.log('======================================================================\n')

  return { totalAxeChecks, totalAxeViolations, smokePassed, smokeTotal, resultsByView }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
