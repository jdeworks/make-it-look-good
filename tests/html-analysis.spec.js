// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';

function loadPreset(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'docs', 'presets', name, 'clean.html'), 'utf8');
}

async function analyzeHtml(page, html) {
  await page.goto(ANALYZER_URL);
  await page.click('[data-tab="tabHtml"]');
  await page.fill('#htmlInput', html);
  await page.click('#analyzeHtmlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 30000 });
}

async function getScore(page) {
  const text = await page.locator('.report-gauge svg text').first().textContent();
  return parseInt(text, 10);
}

// ── HTML Analysis ──

test.describe('HTML Analysis', () => {

  test('buttons preset produces valid scores', async ({ page }) => {
    await analyzeHtml(page, loadPreset('buttons'));
    const score = await getScore(page);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Category cards rendered
    const cards = await page.locator('.report-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('form preset produces report with findings', async ({ page }) => {
    await analyzeHtml(page, loadPreset('form'));
    const findings = await page.locator('.finding-header').count();
    expect(findings).toBeGreaterThan(0);
  });

  test('landing preset scores above 50', async ({ page }) => {
    await analyzeHtml(page, loadPreset('landing'));
    const score = await getScore(page);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  test('dashboard preset renders category cards', async ({ page }) => {
    await analyzeHtml(page, loadPreset('dashboard'));
    const cards = await page.locator('.report-card').count();
    expect(cards).toBeGreaterThanOrEqual(5);
  });
});

// ── Export & Import Round-Trip ──

test.describe('Export and Import', () => {

  test('export .milg and re-import produces same score', async ({ page }) => {
    await analyzeHtml(page, loadPreset('buttons'));
    const originalScore = await getScore(page);

    // Download .milg (compressed) or .json (fallback)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportJsonBtn'),
    ]);
    const exportPath = await download.path();
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/\.(milg|json)$/);

    // Re-import
    await page.click('#newAnalysisBtn');
    await page.click('[data-tab="tabImport"]');
    await page.locator('#importDropFile').setInputFiles(exportPath);
    await page.waitForSelector('.report-container.visible', { timeout: 30000 });

    const reimportedScore = await getScore(page);
    expect(reimportedScore).toBe(originalScore);
  });

  test('export Markdown contains expected sections', async ({ page }) => {
    await analyzeHtml(page, loadPreset('cards'));

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#markdownBtn'),
    ]);
    const mdContent = fs.readFileSync(await download.path(), 'utf8');

    expect(mdContent).toContain('Design Analysis');
    expect(mdContent).toContain('Contrast');
    expect(mdContent).toContain('Typography');
  });
});

// ── UI Controls ──

test.describe('UI Controls', () => {

  test('audience profile switch re-scores', async ({ page }) => {
    await analyzeHtml(page, loadPreset('form'));
    const originalScore = await getScore(page);

    await page.selectOption('#profileSelect', 'wcag_aaa');
    await page.waitForTimeout(300);

    const strictScore = await getScore(page);
    expect(strictScore).toBeLessThanOrEqual(originalScore);
  });

  test('new analysis button resets view', async ({ page }) => {
    await analyzeHtml(page, loadPreset('buttons'));
    await page.click('#newAnalysisBtn');
    await expect(page.locator('#inputSection')).toBeVisible();
    await expect(page.locator('#reportContainer')).not.toHaveClass(/visible/);
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.goto(ANALYZER_URL);
    const hasDarkBefore = await page.locator('body').evaluate(el => el.classList.contains('dark-ui'));
    await page.click('#darkBtn');
    const hasDarkAfter = await page.locator('body').evaluate(el => el.classList.contains('dark-ui'));
    expect(hasDarkBefore).not.toBe(hasDarkAfter);
  });

  test('help modal opens and closes', async ({ page }) => {
    await analyzeHtml(page, loadPreset('buttons'));
    await page.click('#helpBtn');
    await expect(page.locator('#helpModal')).toBeVisible();
    // Close via X button
    await page.locator('#helpModal button[aria-label="Close"]').click();
    await expect(page.locator('#helpModal')).toBeHidden();
  });

  test('ephemeral banner visible after analysis', async ({ page }) => {
    await analyzeHtml(page, loadPreset('buttons'));
    await expect(page.locator('#ephemeralBanner')).toBeVisible();
    await expect(page.locator('#ephemeralBanner')).toContainText('temporary');
  });
});

// ── Screenshot & Carousel Alignment ──

test.describe('Screenshot Pipeline', () => {

  // HTML with a nested carousel pattern (like fink-translate.com):
  // overflow:hidden container > intermediate wrapper > track[transform]
  // Also includes a fragment-only img src and an <a href="#n"> to test filtering
  const CAROUSEL_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Carousel Test</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 20px; background: #fff; }
  .carousel-container { overflow: hidden; width: 400px; position: relative; }
  .carousel-inner { position: relative; }
  .carousel-track-container { position: relative; }
  .carousel-track { display: flex; transform: translateX(-400px); transition: transform 0.5s ease; }
  .carousel-slide { min-width: 400px; padding: 20px; box-sizing: border-box; }
  .slide-1 { background: #f0f0f0; }
  .slide-2 { background: #e0e0ff; }
  .slide-3 { background: #ffe0e0; }
  h2 { color: #111; margin: 0 0 8px; }
  p { color: #333; }
</style></head><body>
  <h1>Carousel Test Page</h1>
  <a href="#n">Skip nav</a>
  <div class="carousel-container">
    <div class="carousel-inner">
      <div class="carousel-track-container">
        <div class="carousel-track">
          <div class="carousel-slide slide-1"><h2>Slide One</h2><p>First slide content here.</p></div>
          <div class="carousel-slide slide-2"><h2>Slide Two</h2><p>Second slide visible.</p></div>
          <div class="carousel-slide slide-3"><h2>Slide Three</h2><p>Third slide content.</p></div>
        </div>
      </div>
    </div>
  </div>
  <img src="#fragment" alt="fragment-only test">
  <p>Below the carousel.</p>
</body></html>`;

  async function analyzeWithScreenshots(page, html) {
    await page.goto(ANALYZER_URL);
    // Enable screenshot checkbox
    await page.check('#screenshotCheck');
    await page.click('[data-tab="tabHtml"]');
    await page.fill('#htmlInput', html);
    await page.click('#analyzeHtmlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 45000 });
  }

  test('carousel overflow:hidden containers get expanded for screenshots', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await analyzeWithScreenshots(page, CAROUSEL_HTML);

    const score = await getScore(page);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);

    // Verify two-pass capture: clean + expanded screenshots
    const cleanLog = consoleLogs.find(l => l.includes('Clean screenshot:'));
    expect(cleanLog).toBeTruthy();
    const expandedLog = consoleLogs.find(l => l.includes('Expanded screenshot:'));
    expect(expandedLog).toBeTruthy();

    // Verify region screenshot detection and capture
    const regionDetect = consoleLogs.find(l => l.includes('clipping regions'));
    expect(regionDetect).toBeTruthy();
    const regionDone = consoleLogs.find(l => l.includes('Region screenshots done:') || l.includes('Region screenshots: 0'));
    expect(regionDone).toBeTruthy();

    // Verify no %23 (encoded #) fetch errors
    const hashError = consoleLogs.find(l => l.includes('%23') && (l.includes('ERR_FAILED') || l.includes('404')));
    expect(hashError).toBeFalsy();
  });

  test('fragment-only img src is skipped during preload', async ({ page }) => {
    const consoleLogs = [];
    const consoleWarnings = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });

    await analyzeWithScreenshots(page, CAROUSEL_HTML);

    // Should NOT have a preload warning for fragment URLs
    const fragWarn = consoleWarnings.find(w => w.includes('#fragment') || w.includes('%23fragment'));
    expect(fragWarn).toBeFalsy();
  });
});

// ── Multiple Presets ──

test.describe('Preset Scoring', () => {
  const presets = ['hero', 'cards', 'stats-row', 'pricing', 'feature-grid'];

  for (const preset of presets) {
    test(`${preset} produces valid analysis`, async ({ page }) => {
      await analyzeHtml(page, loadPreset(preset));
      const score = await getScore(page);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      const findings = await page.locator('.finding-header').count();
      expect(findings).toBeGreaterThan(0);
    });
  }
});
