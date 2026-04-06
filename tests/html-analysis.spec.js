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
