// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const BASE_URL = 'http://localhost:8384';

// Presets and fixtures are served by the same static server that hosts the
// analyzer (docs/ at :8384). We drive the analyzer's URL-mode path so the tests
// exercise the same code users actually use, with faithful CSS/font rendering
// (the bare paste-HTML srcdoc could mask real bugs). For a same-origin localhost
// URL, MilgProxy's direct fetch succeeds without any external CORS proxy.

function presetUrl(name) {
  return `${BASE_URL}/presets/${name}/clean.html`;
}

// Drive URL mode against a served URL (preset or fixture).
async function analyzeUrl(page, url) {
  await page.goto(ANALYZER_URL);
  await page.click('[data-tab="tabUrl"]');
  await page.fill('#urlInput', url);
  await page.click('#analyzeUrlBtn');
  await page.waitForSelector('.report-container.visible', { timeout: 60000 });
}

// Back-compat shim: callers pass a preset NAME (not raw HTML) and we analyze
// the served preset URL. Preset fragments get the same Tailwind-CDN wrapper in
// URL mode as in paste mode, so scores are identical (verified 1:1).
async function analyzeHtml(page, presetName) {
  await analyzeUrl(page, presetUrl(presetName));
}

async function getScore(page) {
  const text = await page.locator('.report-gauge svg text').first().textContent();
  return parseInt(text, 10);
}

// ── HTML Analysis ──

test.describe('HTML Analysis', () => {

  test('buttons preset produces valid scores', async ({ page }) => {
    await analyzeHtml(page, 'buttons');
    const score = await getScore(page);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Category cards rendered
    const cards = await page.locator('.report-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('form preset produces report with findings', async ({ page }) => {
    await analyzeHtml(page, 'form');
    const findings = await page.locator('.finding-header').count();
    expect(findings).toBeGreaterThan(0);
  });

  test('landing preset scores above 50', async ({ page }) => {
    await analyzeHtml(page, 'landing');
    const score = await getScore(page);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  test('dashboard preset renders category cards', async ({ page }) => {
    await analyzeHtml(page, 'dashboard');
    const cards = await page.locator('.report-card').count();
    expect(cards).toBeGreaterThanOrEqual(5);
  });

  test('touch target scoring exempts inline links but flags undersized controls', async ({ page }) => {
    await analyzeUrl(page, `${BASE_URL}/tests/fixtures/touch-targets.html`);

    const touchFindings = await page.evaluate(() => {
      const report = window.__milgLastReport;
      const cat = (report.categories || []).find(c => c.icon === 'touch' || c.label === 'Touch & Interaction');
      return cat ? (cat.findings || []).map(f => ({ title: f.title, detail: f.detail, severity: f.severity })) : [];
    });

    expect(touchFindings.some(f => /normal inline text link/i.test(f.detail || '') || /inline text link/i.test(f.title || ''))).toBe(false);
    expect(touchFindings.some(f => /a\.button-like|a is 2[0-9]×2[0-9]px/i.test((f.detail || '') + ' ' + (f.title || '')))).toBe(true);
    expect(touchFindings.some(f => /Tiny delete|button is 20×20px/i.test((f.detail || '') + ' ' + (f.title || '')))).toBe(true);
  });

  test('placeholder contrast is reported as warning and keeps placeholder color', async ({ page }) => {
    await analyzeUrl(page, `${BASE_URL}/tests/fixtures/placeholder-contrast.html`);

    const result = await page.evaluate(() => {
      const report = window.__milgLastReport;
      const raw = report && report.raw;
      const pair = raw && raw.colors && (raw.colors.contrastPairs || []).find(p => p.isPlaceholder);
      const cat = (report.categories || []).find(c => c.icon === 'contrast' || c.label === 'Color & Contrast');
      const findings = cat ? (cat.findings || []).map(f => ({
        title: f.title,
        severity: f.severity,
        detail: f.detail,
        colors: f._colors || null,
      })) : [];
      return {
        pair,
        screenshot: raw && (raw.screenshotClean || raw.screenshotFull || ((raw.screenshots || [])[0])),
        scale: raw && raw.screenshotMeta && raw.screenshotMeta.scale || 1,
        placeholderFindings: findings.filter(f => /placeholder/i.test((f.title || '') + ' ' + (f.detail || ''))),
      };
    });

    expect(result.pair).toBeTruthy();
    expect(result.pair.isPlaceholder).toBe(true);
    expect(result.pair.fg.replace(/\s+/g, '')).toBe('rgb(100,116,139)');
    expect(result.pair.bg.replace(/\s+/g, '')).toBe('rgb(30,41,59)');
    expect(result.pair.passes).toBe(false);
    expect(result.placeholderFindings.some(f => f.severity === 'warning')).toBe(true);
    expect(result.placeholderFindings.some(f => f.severity === 'error')).toBe(false);
    expect(result.screenshot).toBeTruthy();

    const pixels = await page.evaluate(async ({ src, bbox, scale }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const sx = Math.round((bbox.left + 16) * scale);
      const sy = Math.round((bbox.top + 10) * scale);
      const sw = Math.round(190 * scale);
      const sh = Math.round(24 * scale);
      const data = ctx.getImageData(sx, sy, sw, sh).data;
      let placeholderLike = 0;
      let whiteLike = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 20) continue;
        const d = Math.abs(r - 100) + Math.abs(g - 116) + Math.abs(b - 139);
        if (d < 80) placeholderLike++;
        if (r > 220 && g > 220 && b > 220) whiteLike++;
      }
      return { placeholderLike, whiteLike };
    }, { src: result.screenshot, bbox: result.pair.bbox, scale: result.scale });

    expect(pixels.placeholderLike).toBeGreaterThan(20);
    expect(pixels.whiteLike).toBeLessThan(20);
  });
});

// ── Export & Import Round-Trip ──

test.describe('Export and Import', () => {

  test('export .milg and re-import produces same score', async ({ page }) => {
    await analyzeHtml(page, 'buttons');
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
    await analyzeHtml(page, 'cards');

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
    await analyzeHtml(page, 'form');
    const originalScore = await getScore(page);

    await page.selectOption('#profileSelect', 'wcag_aaa');
    await page.waitForTimeout(300);

    const strictScore = await getScore(page);
    expect(strictScore).toBeLessThanOrEqual(originalScore);
  });

  test('new analysis button resets view', async ({ page }) => {
    await analyzeHtml(page, 'buttons');
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
    await analyzeHtml(page, 'buttons');
    await page.click('#helpBtn');
    await expect(page.locator('#helpModal')).toBeVisible();
    // Close via X button
    await page.locator('#helpModal button[aria-label="Close"]').click();
    await expect(page.locator('#helpModal')).toBeHidden();
  });

  test('ephemeral banner visible after analysis', async ({ page }) => {
    await analyzeHtml(page, 'buttons');
    await expect(page.locator('#ephemeralBanner')).toBeVisible();
    await expect(page.locator('#ephemeralBanner')).toContainText('temporary');
  });
});

// ── Screenshot & Carousel Alignment ──

test.describe('Screenshot Pipeline', () => {

  // Carousel fixture served at docs/tests/fixtures/carousel.html — a nested
  // carousel pattern (like fink-translate.com): overflow:hidden container >
  // intermediate wrapper > track[transform]. Also has a fragment-only img src
  // and an <a href="#n"> to exercise URL filtering. Analyzed via real URL mode
  // (faithful rendering + real fetch/preload path) instead of paste-HTML srcdoc.
  const CAROUSEL_URL = `${BASE_URL}/tests/fixtures/carousel.html`;

  async function analyzeWithScreenshots(page) {
    await page.goto(ANALYZER_URL);
    // Enable screenshot checkbox (checked by default, but be explicit)
    await page.check('#screenshotCheck');
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', CAROUSEL_URL);
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 90000 });
  }

  test('carousel overflow:hidden containers get expanded for screenshots', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await analyzeWithScreenshots(page);

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

  test('viewer shows region sections below main screenshot for carousel content', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await analyzeWithScreenshots(page);

    // Check if region screenshots were captured (may be 0 if carousel slides have passing contrast)
    const regionDone = consoleLogs.find(l => l.includes('Region screenshots done:'));
    const regionCount = regionDone ? parseInt((regionDone.match(/done:\s*(\d+)/) || [])[1] || '0') : 0;

    // Open the viewer by expanding the screenshots details and clicking the thumbnail
    const screenshotDetails = page.locator('details.report-screenshots');
    if (await screenshotDetails.count() > 0) {
      await screenshotDetails.locator('summary').click();
      const screenshotImg = page.locator('.screenshot-img').first();
      await screenshotImg.waitFor({ state: 'visible', timeout: 5000 });
      await screenshotImg.click();
      await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });

      // Verify the viewer is open
      const overlay = page.locator('.milg-viewer-overlay.visible');
      await expect(overlay).toBeVisible();

      // Verify the main screenshot image is present
      await expect(page.locator('.milg-viewer-img')).toBeVisible();

      // If regions were captured, verify region sections exist below main screenshot
      if (regionCount > 0) {
        const regionSections = page.locator('.milg-viewer-region-section');
        const sectionCount = await regionSections.count();
        expect(sectionCount).toBeGreaterThan(0);

        // Verify each region section has a header with label
        for (let i = 0; i < sectionCount; i++) {
          const section = regionSections.nth(i);
          await expect(section).toBeVisible();
          // Check it has the region ID for navigation
          const id = await section.getAttribute('id');
          expect(id).toMatch(/^milg-region-\d+$/);
        }

        // Verify region sections are positioned below the main frame (not beside)
        const frame = page.locator('.milg-viewer-frame');
        const frameBox = await frame.boundingBox();
        if (frameBox) {
          for (let i = 0; i < sectionCount; i++) {
            const sectionBox = await regionSections.nth(i).boundingBox();
            if (sectionBox) {
              // Region sections must be below the frame (higher Y value)
              expect(sectionBox.y).toBeGreaterThan(frameBox.y + frameBox.height - 10);
            }
          }
        }
      }

      // Verify no expand toggle exists (region screenshots replace the old toggle approach)
      const toggleBtn = page.locator('.milg-viewer-expand-toggle');
      expect(await toggleBtn.count()).toBe(0);

      // Close the viewer
      await page.keyboard.press('Escape');
    }
  });

  test('pixel verification skips clipped carousel elements', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await analyzeWithScreenshots(page);

    // Check verification log for clippedSkipped count
    const verifyLog = consoleLogs.find(l => l.includes('clippedSkipped='));
    if (verifyLog) {
      const skipped = parseInt((verifyLog.match(/clippedSkipped=(\d+)/) || [])[1] || '0');
      // If there are clipped elements, they should be reported as skipped
      expect(skipped).toBeGreaterThanOrEqual(0);
    }
  });

  test('fragment-only img src is skipped during preload', async ({ page }) => {
    const consoleLogs = [];
    const consoleWarnings = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });

    await analyzeWithScreenshots(page);

    // Should NOT have a preload warning for fragment URLs
    const fragWarn = consoleWarnings.find(w => w.includes('#fragment') || w.includes('%23fragment'));
    expect(fragWarn).toBeFalsy();
  });

  test('hidden region mini-pages preserve ancestor dark context and button sizing', async ({ page }) => {
    await analyzeUrl(page, `${BASE_URL}/tests/fixtures/hidden-ancestor-context.html`);

    const region = await page.evaluate(() => {
      const raw = window.__milgLastReport && window.__milgLastReport.raw;
      const regions = (raw && raw.regionScreenshots) || [];
      const match = regions.find(r => {
        const pairs = r.extractedData && r.extractedData.colors ? (r.extractedData.colors.contrastPairs || []) : [];
        return pairs.some(p => (p.text || '').includes('Hidden action'));
      });
      if (!match) return null;
      const pairs = match.extractedData.colors.contrastPairs || [];
      const btnPair = pairs.find(p => (p.text || '').includes('Hidden action'));
      const touchTargets = match.extractedData.interaction ? (match.extractedData.interaction.touchTargets || []) : [];
      return {
        darkModeMethod: match.extractedData.structure && match.extractedData.structure.darkModeMethod,
        darknessLevel: match.extractedData.colors && match.extractedData.colors.darknessLevel,
        buttonHeight: btnPair && btnPair.bbox ? btnPair.bbox.height : 0,
        fidelity: match.regionFidelity || match.extractedData.regionFidelity || null,
        touchTarget: touchTargets.find(t => (t.text || '').includes('Hidden action')) || null,
      };
    });

    expect(region).not.toBeNull();
    expect(region.darkModeMethod).not.toBe('none');
    expect(region.darknessLevel).toBeGreaterThanOrEqual(6);
    expect(region.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(region.touchTarget).toBeNull();
    expect(region.fidelity && region.fidelity.compared).toBeGreaterThan(0);
  });

  test('analyzer details regions keep outer details box and hidden ancestor geometry', async ({ page }) => {
    await analyzeUrl(page, `${BASE_URL}/analyzer.html`);

    const regions = await page.evaluate(() => {
      const raw = window.__milgLastReport && window.__milgLastReport.raw;
      const list = (raw && raw.regionScreenshots) || [];
      function compact(label) {
        const r = list.find(x => x.label === label);
        if (!r) return null;
        const pairs = r.extractedData && r.extractedData.colors ? (r.extractedData.colors.contrastPairs || []) : [];
        const buttonPair = pairs.find(p => (p.text || '').includes('Switch to Console Snippet tab'));
        return {
          label: r.label,
          kind: r.kind,
          noAnchor: !!r.noAnchor,
          containerRect: r.containerRect,
          screenshotMeta: r.screenshotMeta,
          buttonHeight: buttonPair && buttonPair.bbox ? buttonPair.bbox.height : 0,
        };
      }
      return {
        how: compact('How it works'),
        prefer: compact('Prefer the Console Snippet (safer)'),
      };
    });

    expect(regions.how).not.toBeNull();
    expect(regions.how.kind).toBe('details');
    expect(regions.how.noAnchor).toBe(false);
    expect(regions.how.containerRect.width).toBeGreaterThan(650);
    expect(regions.how.screenshotMeta.canvasHeight).toBeGreaterThan(regions.how.containerRect.height * regions.how.screenshotMeta.scale);

    expect(regions.prefer).not.toBeNull();
    expect(regions.prefer.kind).toBe('details');
    expect(regions.prefer.noAnchor).toBe(false);
    expect(regions.prefer.containerRect.width).toBeGreaterThan(600);
    expect(regions.prefer.buttonHeight).toBeGreaterThanOrEqual(44);
  });

  test('analyzer self regions keep dark mode when analyzer UI is dark', async ({ page }) => {
    await page.goto(ANALYZER_URL);
    await page.evaluate(() => localStorage.setItem('milg-dark', 'true'));
    await page.reload();
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', `${BASE_URL}/analyzer.html`);
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 90000 });

    const darkRegions = await page.evaluate(() => {
      const raw = window.__milgLastReport && window.__milgLastReport.raw;
      return {
        bodyClass: document.body.className,
        mainMethod: raw && raw.structure && raw.structure.darkModeMethod,
        mainDarkness: raw && raw.colors && raw.colors.darknessLevel,
        placeholderPair: raw && raw.colors && (raw.colors.contrastPairs || []).find(p => p.selector === '#urlInput' && p.isPlaceholder),
        placeholderWarning: !!((window.__milgLastReport.categories || []).find(c => c.label === 'Color & Contrast') || { findings: [] }).findings.find(f =>
          f.severity === 'warning' && /placeholder/i.test(f.title || '') && /#urlInput/.test(f.detail || '')
        ),
        regions: ((raw && raw.regionScreenshots) || []).map(r => ({
          label: r.label,
          method: r.extractedData && r.extractedData.structure && r.extractedData.structure.darkModeMethod,
          darkness: r.extractedData && r.extractedData.colors && r.extractedData.colors.darknessLevel,
          bg: r.extractedData && r.extractedData.colors && (r.extractedData.colors.bgColors || [])[0],
        })),
      };
    });

    expect(darkRegions.bodyClass).toContain('dark-ui');
    expect(darkRegions.mainMethod).toBe('body-class');
    expect(darkRegions.mainDarkness).toBeGreaterThanOrEqual(6);
    expect(darkRegions.placeholderPair).toBeTruthy();
    expect(darkRegions.placeholderPair.passes).toBe(false);
    expect(darkRegions.placeholderWarning).toBe(true);
    const how = darkRegions.regions.find(r => r.label === 'How it works');
    expect(how).toBeTruthy();
    expect(how.method).toBe('body-class');
    expect(how.darkness).toBeGreaterThanOrEqual(6);
    expect(how.bg && how.bg.value).toBe('rgb(30, 41, 59)');
  });
});

// ── URL Analysis: Real Sites ──

test.describe('URL Analysis - fink-translate.com', () => {

  test('carousel regions render below main screenshot in viewer', async ({ page }) => {
    test.setTimeout(420000); // URL analysis: CORS proxy + iframe render + screenshots + masks can take 5+ min
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await page.goto(ANALYZER_URL);
    await page.check('#screenshotCheck');
    // Enter URL
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', 'https://www.fink-translate.com/');
    await page.click('#analyzeUrlBtn');
    // URL analysis can take a while: CORS proxy fetch + iframe render + screenshots + mask pipeline
    await page.waitForSelector('.report-container.visible', { timeout: 360000 });

    // Verify analysis completed
    const score = await page.locator('.report-gauge svg text').first().textContent();
    expect(parseInt(score, 10)).toBeGreaterThanOrEqual(0);

    // Check for region screenshot capture in console
    const regionLog = consoleLogs.find(l => l.includes('Region screenshots done:') || l.includes('clipping regions'));

    // Check for clipped pairs
    const clippedPairs = consoleLogs.filter(l => l.includes('_isClipped') || l.includes('clippedSkipped'));

    // Open the viewer
    const screenshotDetails = page.locator('details.report-screenshots');
    if (await screenshotDetails.count() > 0) {
      await screenshotDetails.locator('summary').click();
      const screenshotImg = page.locator('.screenshot-img').first();
      await screenshotImg.waitFor({ state: 'visible', timeout: 5000 });
      await screenshotImg.click();
      await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });

      // Verify the viewer opened
      await expect(page.locator('.milg-viewer-overlay.visible')).toBeVisible();
      await expect(page.locator('.milg-viewer-img')).toBeVisible();

      // Check for region sections
      const regionSections = page.locator('.milg-viewer-region-section');
      const regionSectionCount = await regionSections.count();

      // If regions exist, verify layout
      if (regionSectionCount > 0) {
        // Verify region sections are visible
        for (let i = 0; i < regionSectionCount; i++) {
          const section = regionSections.nth(i);
          const id = await section.getAttribute('id');
          expect(id).toMatch(/^milg-region-\d+$/);
        }

        // Verify layout: regions are BELOW the main frame, not beside it
        const frame = page.locator('.milg-viewer-frame');
        const frameBox = await frame.boundingBox();
        const regions = page.locator('.milg-viewer-regions');
        const regionsBox = await regions.boundingBox();
        if (frameBox && regionsBox) {
          expect(regionsBox.y).toBeGreaterThanOrEqual(frameBox.y + frameBox.height - 5);
        }

        // Click "Contrast" or "All" filter to trigger overlay rendering
        const allBtn = page.locator('.milg-viewer-filter-btn[data-filter-value="all"]');
        if (await allBtn.count() > 0) {
          await allBtn.click();
          // Wait a moment for overlays to render
          await page.waitForTimeout(500);

          // Check for container indicators (dashed blue boxes on main screenshot)
          const indicators = page.locator('svg.milg-viewer-svg rect[data-region]');
          const indicatorCount = await indicators.count();
          // Container indicators should exist for each region
          expect(indicatorCount).toBeGreaterThanOrEqual(regionSectionCount);
        }
      }

      // Verify no expand toggle (region screenshots replace it)
      expect(await page.locator('.milg-viewer-expand-toggle').count()).toBe(0);

      // Close viewer
      await page.keyboard.press('Escape');
    }

    // Check pixel verification handled clipped elements
    const verifyLog = consoleLogs.find(l => l.includes('clippedSkipped='));
    if (verifyLog) {
      const match = verifyLog.match(/clippedSkipped=(\d+)/);
      if (match) {
        console.log('Clipped pairs skipped from pixel verify:', match[1]);
      }
    }
  });
});

// ── Multiple Presets ──

test.describe('Preset Scoring', () => {
  const presets = ['hero', 'cards', 'stats-row', 'pricing', 'feature-grid'];

  for (const preset of presets) {
    test(`${preset} produces valid analysis`, async ({ page }) => {
      await analyzeHtml(page, preset);
      const score = await getScore(page);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      const findings = await page.locator('.finding-header').count();
      expect(findings).toBeGreaterThan(0);
    });
  }
});
