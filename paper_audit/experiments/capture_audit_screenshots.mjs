import { chromium } from '../../frontend/node_modules/playwright/index.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const BASE_URL = 'http://localhost:5173';
const OUT_DIR = path.resolve(ROOT_DIR, 'paper_audit', 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const routes = [
  { name: '01_overview', path: '/' },
  { name: '02_students_roster', path: '/students' },
  { name: '03_subject_catalog', path: '/subjects' },
  { name: '04_absent_students', path: '/absent-students' },
  { name: '05_followups_notices', path: '/follow-ups' },
  { name: '06_data_quality', path: '/data-quality' },
  { name: '07_reports_dossier', path: '/reports' },
  { name: '08_upload_layout', path: '/upload' },
];

const viewports = [
  { name: 'desktop_1440', width: 1440, height: 900 },
  { name: 'tablet_768', width: 768, height: 1024 },
  { name: 'mobile_390', width: 390, height: 844 },
];

const themes = ['light', 'dark'];

async function capture() {
  console.log('Capturing responsive audit screenshots across themes and viewports...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const theme of themes) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });
      const page = await context.newPage();

      await page.addInitScript((t) => {
        localStorage.setItem('eduquery-theme', t);
        localStorage.setItem('eduquery_theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }, theme);

      for (const r of routes) {
        const url = `${BASE_URL}${r.path}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 8000 });
          await page.waitForTimeout(500);
          const outName = `${r.name}_${vp.name}_${theme}.png`;
          const outPath = path.join(OUT_DIR, outName);
          await page.screenshot({ path: outPath, fullPage: false });
          console.log(`Saved: ${outName}`);
        } catch (err) {
          console.warn(`Failed ${r.name} on ${vp.name} (${theme}): ${err.message}`);
        }
      }
      await context.close();
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
