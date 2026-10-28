import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import AxeBuilder from '../frontend/node_modules/@axe-core/playwright/dist/index.js';

const BASE_URL = 'http://127.0.0.1:4173';

const routes = [
  { path: '/upload', name: 'Upload Page' },
  { path: '/', name: 'Academic Overview' },
  { path: '/students', name: 'Student Directory' },
  { path: '/students/224906', name: 'Student Detail (Real ID 224906)' },
  { path: '/subjects', name: 'Curriculum & Subjects Catalog' },
  { path: '/subjects/MDM01', name: 'Subject Detail (Real Course MDM01)' },
  { path: '/failures', name: 'Curriculum Failure Summary' },
  { path: '/explore', name: 'Interactive Investigation Engine' },
  { path: '/absent-students', name: 'Absentee Roster' },
  { path: '/data-quality', name: 'Data Quality & Invariants' },
  { path: '/imports', name: 'Dataset Management & Version Control' },
  { path: '/styleguide', name: 'Monochrome Glass Design System Styleguide' },
];

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== Running Axe for Theme: ${theme.toUpperCase()} ===`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
    });

    const page = await context.newPage();

    // Set theme in localStorage
    await page.addInitScript((t) => {
      localStorage.setItem('eduquery-theme', t);
      document.documentElement.setAttribute('data-theme', t);
    }, theme);

    for (const r of routes) {
      const url = `${BASE_URL}${r.path}`;
      await page.goto(url, { waitUntil: 'networkidle' });

      // Wait a moment for dynamic rendering
      await page.waitForTimeout(500);

      // Get rendered h1
      let h1Text = 'NO H1 FOUND';
      try {
        const h1El = await page.waitForSelector('h1', { timeout: 3000 });
        if (h1El) {
          h1Text = (await h1El.textContent() || '').trim();
        }
      } catch (err) {
        h1Text = `ERROR: ${err.message}`;
      }

      // Run Axe analysis
      try {
        const axeResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const violations = axeResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
          targets: v.nodes.map(n => n.target).flat(),
        }));

        results.push({
          theme,
          path: r.path,
          name: r.name,
          h1: h1Text,
          violationCount: violations.length,
          violations,
        });

        console.log(`[${theme.toUpperCase()}] ${r.path} -> <h1>: "${h1Text}" | Violations: ${violations.length}`);
        if (violations.length > 0) {
          console.log(`   Violations details:`, JSON.stringify(violations, null, 2));
        }
      } catch (axeErr) {
        console.error(`[${theme.toUpperCase()}] ${r.path} Axe failed:`, axeErr.message);
        results.push({
          theme,
          path: r.path,
          name: r.name,
          h1: h1Text,
          violationCount: -1,
          error: axeErr.message,
        });
      }
    }
    await context.close();
  }

  await browser.close();
  console.log('\n=== Summary ===');
  let totalViolations = 0;
  for (const res of results) {
    if (res.violationCount > 0) totalViolations += res.violationCount;
  }
  console.log(`Total checks: ${results.length}, Total violations: ${totalViolations}`);
  return results;
}

run().catch(console.error);
