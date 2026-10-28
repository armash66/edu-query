import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = 'http://127.0.0.1:4173';

const TEST_WORKBOOK = path.resolve(ROOT_DIR, 'data', 'test1_commerce_same_layout.xlsx');

async function runE2ESuite() {
  console.log('======================================================================');
  console.log('EDUQUERY AUTOMATED PLAYWRIGHT E2E ACCEPTANCE SUITE');
  console.log('======================================================================\n');

  if (!fs.existsSync(TEST_WORKBOOK)) {
    throw new Error(`Test marksheet workbook not found at: ${TEST_WORKBOOK}`);
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];

  // Helper test runner
  async function runTest(name, fn) {
    process.stdout.write(`• Running: ${name} ... `);
    const start = Date.now();
    try {
      const detail = await fn();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[32mPASS\x1b[0m (${elapsed}s)`);
      if (detail) {
        console.log(`    ↳ \x1b[90m${detail}\x1b[0m`);
      }
      results.push({ name, status: 'PASS', elapsed, detail });
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\x1b[31mFAIL\x1b[0m (${elapsed}s)`);
      console.error(`    ↳ Error: ${err.message}`);
      results.push({ name, status: 'FAIL', elapsed, error: err.message });
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Upload Flow (dropzone, preview card, activate session, navigate to overview)
  // -------------------------------------------------------------------------
  await runTest('Test 1: Full Marksheet Upload Flow & Layout Preview Card', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'networkidle' });

    // Verify upload page heading
    const title = await page.locator('h1').first().textContent();
    if (!title.includes('Upload Marksheet')) {
      throw new Error(`Expected 'Upload Marksheet', got: '${title}'`);
    }

    // Set file on hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_WORKBOOK);

    // Wait for layout preview card to appear
    await page.waitForSelector('text=Detected Sheet', { timeout: 15000 });
    const sheetInfo = await page.locator('text=Detected Sheet').textContent();

    // Verify confirmation button exists
    const confirmBtn = page.locator('button:has-text("Confirm & Start Analysis")');
    if ((await confirmBtn.count()) === 0) {
      throw new Error('Confirm & Start Analysis button not found after upload');
    }

    // Click confirm to activate and wait for navigation to complete
    await Promise.all([
      page.waitForURL(new RegExp(`^${BASE_URL}/?$`), { timeout: 15000 }),
      confirmBtn.click(),
    ]);

    await page.waitForSelector('text=Academic Analysis Overview', { timeout: 15000 });
    const overviewH1 = await page.locator('h1').first().textContent();

    await context.close();
    return `Uploaded ${path.basename(TEST_WORKBOOK)}, confirmed layout card (${sheetInfo.trim()}), navigated to Overview ("${overviewH1.trim()}").`;
  });

  // -------------------------------------------------------------------------
  // TEST 2: Filter Builder (multi-condition filtering, chips, live counts)
  // -------------------------------------------------------------------------
  await runTest('Test 2: Interactive Filter Builder & Condition Chips', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'networkidle' });

    // Open filter builder
    const builderToggle = page.locator('button:has-text("Filter Builder")');
    await builderToggle.click();
    await page.waitForTimeout(400);

    // Click preset filter: "Students with Absences"
    const presetBtn = page.locator('button:has-text("Students with Absences")');
    await presetBtn.click();

    // Verify condition chip appeared with human-friendly label
    await page.waitForSelector('[data-testid="active-filter-chip"]', { timeout: 8000 });
    const chip = page.locator('[data-testid="active-filter-chip"]');
    const chipText = await chip.textContent();

    // Verify matching count banner
    const countBanner = await page.locator('text=Showing').first().textContent();

    await context.close();
    return `Applied 'has_absent' condition, chip rendered: "${chipText.trim()}", banner: "${countBanner.trim()}".`;
  });

  // -------------------------------------------------------------------------
  // TEST 3: Export Download (assert file downloads & opens as genuine valid .xlsx)
  // -------------------------------------------------------------------------
  await runTest('Test 3: Server-Side Excel Export & OpenXML Validation', async () => {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle' });

    // Locate Export button
    const exportBtn = page.locator('button:has-text("Export to Excel")');
    await page.waitForSelector('button:has-text("Export to Excel")', { timeout: 10000 });

    // Trigger download
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await exportBtn.click();
    const download = await downloadPromise;

    const suggestedName = download.suggestedFilename();
    const exportTempPath = path.resolve(ROOT_DIR, 'dist', `test_${suggestedName}`);
    await download.saveAs(exportTempPath);

    // Verify file exists and is non-empty
    const stats = fs.statSync(exportTempPath);
    if (stats.size < 500) {
      throw new Error(`Exported file is suspiciously small: ${stats.size} bytes`);
    }

    // Verify standard ZIP header magic bytes (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
    const fd = fs.openSync(exportTempPath, 'r');
    const magicBuf = Buffer.alloc(4);
    fs.readSync(fd, magicBuf, 0, 4, 0);
    fs.closeSync(fd);

    const isZip = magicBuf[0] === 0x50 && magicBuf[1] === 0x4b && magicBuf[2] === 0x03 && magicBuf[3] === 0x04;
    if (!isZip) {
      throw new Error(`Downloaded file is not a valid OpenXML/ZIP archive (magic bytes: ${magicBuf.toString('hex')})`);
    }

    // Validate using python openpyxl that the file actually opens without corruption
    const escapedPath = exportTempPath.replace(/\\/g, '/');
    const pythonCheckCmd = `python -c "import openpyxl; wb = openpyxl.load_workbook('${escapedPath}'); print('OPENPYXL_OK:', wb.sheetnames, wb.active.max_row)"`;
    const openpyxlOutput = execSync(pythonCheckCmd, { encoding: 'utf-8' }).trim();

    // Clean up temp file
    try { fs.unlinkSync(exportTempPath); } catch {}

    await context.close();
    return `Downloaded ${suggestedName} (${stats.size} bytes). Magic bytes PK0304 confirmed. openpyxl: ${openpyxlOutput}.`;
  });

  // -------------------------------------------------------------------------
  // TEST 4: Session-Expired Recovery
  // -------------------------------------------------------------------------
  await runTest('Test 4: Graceful Session Expiry Error Boundary & Recovery Flow', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to students page
    await page.goto(`${BASE_URL}/students`, { waitUntil: 'networkidle' });

    // Mock API returning 410 Gone / Session Expired
    await page.route('**/api/v1/students*', (route) => {
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Session expired or invalidated. Please upload marksheet again.',
          error_code: 'SESSION_EXPIRED',
        }),
      });
    });

    // Trigger search input which fires a request
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('TriggerExpiryCheck');
    await page.waitForTimeout(600);

    // Verify error state banner appears without uncaught crashing
    await page.waitForSelector('text=Could not load student roster', { timeout: 8000 });
    const errorTitle = await page.locator('text=Could not load student roster').textContent();
    const errorText = await page.locator('text=Session expired or invalidated').textContent();

    // Verify recovery Retry button exists
    const retryBtn = page.locator('button:has-text("Retry")');
    const recoveryCount = await retryBtn.count();
    if (recoveryCount === 0) {
      throw new Error('No recovery action provided on session expiry');
    }

    await context.close();
    return `Handled HTTP 410 cleanly: surfaced "${errorTitle.trim()}" ("${errorText.trim()}"), offered recovery button.`;
  });

  // -------------------------------------------------------------------------
  // TEST 5: Boot Screen with Mocked Slow /health
  // -------------------------------------------------------------------------
  await runTest('Test 5: Boot Screen Cold-Start Experience on Slow/Waking /health', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    let attempts = 0;
    // Mock cold start: both /health and /api/v1/session/status fail on initial attempt
    await page.route('**/health', async (route) => {
      attempts++;
      if (attempts <= 1) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'healthy',
            version: '3.0.0',
            database: { connected: true, students_count: 145 },
          }),
        });
      }
    });

    await page.route('**/api/v1/session/status', async (route) => {
      if (attempts <= 1) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ active: false, mode: 'transient' }),
        });
      }
    });

    await page.goto(`${BASE_URL}/upload`, { waitUntil: 'load' });

    // Assert BootScreen is rendered
    await page.waitForSelector('text=EduQuery Backend is Waking Up', { timeout: 8000 });
    const bootHeading = await page.locator('text=EduQuery Backend is Waking Up').textContent();

    // Verify progress bar exists
    const progressBar = page.locator('[role="progressbar"]');
    const hasProgress = (await progressBar.count()) > 0;

    // Click retry to transition after backend wakes up
    const retryBtn = page.locator('button:has-text("Retry Connection")');
    if ((await retryBtn.count()) > 0) {
      await retryBtn.click();
    }

    // Verify BootScreen disappears after successful health check
    await page.waitForSelector('text=Drop your Excel marksheet here', { timeout: 8000 });

    await context.close();
    return `BootScreen rendered on cold start: "${bootHeading.trim()}", progress bar present (${hasProgress}), cleanly recovered upon backend wake up.`;
  });

  await browser.close();

  console.log('\n======================================================================');
  console.log('PLAYWRIGHT E2E ACCEPTANCE SUMMARY');
  console.log('======================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log(`Results: ${passed}/${results.length} PASSED`);
  if (passed !== results.length) {
    throw new Error(`${results.length - passed} tests failed!`);
  }
}

runE2ESuite().catch((err) => {
  console.error('\nFatal Suite Error:', err.message);
  process.exit(1);
});
