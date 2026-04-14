// @ts-check
// Diagnostic test: captures region screenshot data from fink-translate.com
// and writes debug artifacts to test-results/region-debug/
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ANALYZER_URL = 'http://localhost:8384/analyzer.html';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'region-debug');

test.describe('Region Screenshot Debug', () => {

  test('diagnose fink-translate carousel regions', async ({ page }) => {
    test.setTimeout(420000);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      // Print region/clipped related logs immediately
      if (text.includes('region') || text.includes('Region') || text.includes('clipp') || text.includes('milg-viewer'))
        console.log('[BROWSER]', text);
    });

    // 1. Run URL analysis
    await page.goto(ANALYZER_URL);
    await page.check('#screenshotCheck');
    await page.click('[data-tab="tabUrl"]');
    await page.fill('#urlInput', 'https://www.fink-translate.com/');
    await page.click('#analyzeUrlBtn');
    await page.waitForSelector('.report-container.visible', { timeout: 360000 });

    // 2. Extract raw report data
    const reportDump = await page.evaluate(() => {
      const report = window.__milgLastReport;
      if (!report || !report.raw) return { error: 'no report data' };
      const raw = report.raw;

      // Region screenshots
      const regions = (raw.regionScreenshots || []).map((rgn, i) => ({
        index: i,
        hasScreenshot: !!rgn.screenshot,
        screenshotLen: rgn.screenshot ? rgn.screenshot.length : 0,
        screenshotMeta: rgn.screenshotMeta || null,
        pairIndices: rgn.pairIndices || [],
        localBboxes: rgn.localBboxes || {},
        containerRect: rgn.containerRect || null,
        hasExtractedData: !!rgn.extractedData,
        extractedPairCount: rgn.extractedData && rgn.extractedData.colors ? (rgn.extractedData.colors.contrastPairs || []).length : 0,
        hasRegionReport: !!rgn.regionReport,
        regionScore: rgn.regionReport ? rgn.regionReport.overall : null,
      }));

      // Clipped pairs
      const pairs = raw.colors ? raw.colors.contrastPairs || [] : [];
      const clippedPairs = pairs.map((p, i) => ({
        index: i,
        isClipped: !!p._isClipped,
        bbox: p.bbox,
        selector: p.selector ? p.selector.substring(0, 80) : null,
        text: p.text ? p.text.substring(0, 40) : null,
        ratio: p.ratio,
        passes: p.passes,
      })).filter(p => p.isClipped);

      // All pairs with bboxes (for bbox identity check)
      const allPairsWithBbox = pairs.filter(p => p.bbox).length;

      // screenshotMeta vs cleanMeta
      const screenshotMeta = raw.screenshotMeta || null;
      const cleanMeta = raw.screenshotCleanMeta || null;
      const hasCleanScreenshot = !!raw.screenshotClean;
      const hasExpandedScreenshot = !!raw.screenshotFull;

      return {
        regionCount: regions.length,
        regions,
        clippedPairCount: clippedPairs.length,
        clippedPairs,
        totalPairs: pairs.length,
        allPairsWithBbox,
        screenshotMeta,
        cleanMeta,
        hasCleanScreenshot,
        hasExpandedScreenshot,
      };
    });

    // Write the report dump
    fs.writeFileSync(path.join(OUT_DIR, 'report-dump.json'), JSON.stringify(reportDump, null, 2));
    console.log('\n=== REPORT DUMP ===');
    console.log('Region count:', reportDump.regionCount);
    console.log('Clipped pairs:', reportDump.clippedPairCount, '/', reportDump.totalPairs);
    console.log('Has clean screenshot:', reportDump.hasCleanScreenshot);
    console.log('Has expanded screenshot:', reportDump.hasExpandedScreenshot);
    console.log('Clean meta:', JSON.stringify(reportDump.cleanMeta));
    console.log('Screenshot meta:', JSON.stringify(reportDump.screenshotMeta));
    if (reportDump.regions) {
      reportDump.regions.forEach(r => {
        console.log(`Region ${r.index}: screenshot=${r.screenshotLen}bytes, meta=${JSON.stringify(r.screenshotMeta)}, containerRect=${JSON.stringify(r.containerRect)}, pairIndices=[${r.pairIndices.join(',')}]`);
      });
    }
    if (reportDump.clippedPairs) {
      reportDump.clippedPairs.forEach(p => {
        console.log(`Clipped pair ${p.index}: bbox=${JSON.stringify(p.bbox)} text="${p.text}" ratio=${p.ratio} passes=${p.passes}`);
      });
    }

    // 3. Save region screenshot images
    const regionImages = await page.evaluate(() => {
      const report = window.__milgLastReport;
      if (!report || !report.raw || !report.raw.regionScreenshots) return [];
      return report.raw.regionScreenshots.map((rgn, i) => ({
        index: i,
        dataUri: rgn.screenshot || null,
      }));
    });
    regionImages.forEach(ri => {
      if (ri.dataUri) {
        const match = ri.dataUri.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          fs.writeFileSync(path.join(OUT_DIR, `region-${ri.index}.webp`), Buffer.from(match[1], 'base64'));
          console.log(`Saved region-${ri.index}.webp`);
        }
      }
    });

    // 4. Save clean screenshot
    const cleanScreenshot = await page.evaluate(() => {
      const report = window.__milgLastReport;
      if (!report || !report.raw) return null;
      return report.raw.screenshotClean || null;
    });
    if (cleanScreenshot) {
      const match = cleanScreenshot.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        fs.writeFileSync(path.join(OUT_DIR, 'clean-screenshot.webp'), Buffer.from(match[1], 'base64'));
        console.log('Saved clean-screenshot.webp');
      }
    }

    // 5. Open viewer and check what renders
    const screenshotDetails = page.locator('details.report-screenshots');
    if (await screenshotDetails.count() > 0) {
      await screenshotDetails.locator('summary').click();
      const screenshotImg = page.locator('.screenshot-img').first();
      await screenshotImg.waitFor({ state: 'visible', timeout: 5000 });
      await screenshotImg.click();
      await page.waitForSelector('.milg-viewer-overlay.visible', { timeout: 10000 });

      // Click "All" filter
      const allBtn = page.locator('.milg-viewer-filter-btn[data-filter-value="all"]');
      if (await allBtn.count() > 0) {
        await allBtn.click();
        await page.waitForTimeout(500);
      }

      // Check SVG overlay state
      const svgState = await page.evaluate(() => {
        const svg = document.querySelector('svg.milg-viewer-svg');
        if (!svg) return { error: 'no SVG found' };
        const rects = svg.querySelectorAll('rect');
        const regionIndicators = svg.querySelectorAll('rect[data-region]');
        const texts = svg.querySelectorAll('text');
        return {
          totalRects: rects.length,
          regionIndicatorCount: regionIndicators.length,
          regionIndicators: Array.from(regionIndicators).map(r => ({
            class: r.getAttribute('class'),
            x: r.getAttribute('x'),
            y: r.getAttribute('y'),
            width: r.getAttribute('width'),
            height: r.getAttribute('height'),
            stroke: r.getAttribute('stroke'),
          })),
          textCount: texts.length,
          texts: Array.from(texts).map(t => ({
            x: t.getAttribute('x'),
            y: t.getAttribute('y'),
            fontSize: t.getAttribute('font-size'),
            content: t.textContent.substring(0, 50),
          })),
          viewBox: svg.getAttribute('viewBox'),
          svgWidth: svg.getBoundingClientRect().width,
          svgHeight: svg.getBoundingClientRect().height,
        };
      });

      fs.writeFileSync(path.join(OUT_DIR, 'svg-state.json'), JSON.stringify(svgState, null, 2));
      console.log('\n=== SVG OVERLAY STATE ===');
      console.log('viewBox:', svgState.viewBox);
      console.log('SVG display size:', svgState.svgWidth, 'x', svgState.svgHeight);
      console.log('Total rects:', svgState.totalRects);
      console.log('Region indicators:', svgState.regionIndicatorCount);
      if (svgState.regionIndicators) {
        svgState.regionIndicators.forEach(ind => {
          console.log('  Indicator:', JSON.stringify(ind));
        });
      }
      console.log('Texts:', svgState.textCount);
      if (svgState.texts) {
        svgState.texts.forEach(t => console.log('  Text:', JSON.stringify(t)));
      }

      // Check region sections in DOM
      const regionSections = await page.evaluate(() => {
        const sections = document.querySelectorAll('.milg-viewer-region-section');
        return Array.from(sections).map((s, i) => {
          const img = s.querySelector('img');
          const rgnSvg = s.querySelector('svg');
          const rects = rgnSvg ? rgnSvg.querySelectorAll('rect') : [];
          return {
            id: s.id,
            width: s.getBoundingClientRect().width,
            height: s.getBoundingClientRect().height,
            imgNaturalWidth: img ? img.naturalWidth : null,
            imgNaturalHeight: img ? img.naturalHeight : null,
            imgDisplayWidth: img ? img.getBoundingClientRect().width : null,
            imgDisplayHeight: img ? img.getBoundingClientRect().height : null,
            imgStyleWidth: img ? img.style.width : null,
            svgViewBox: rgnSvg ? rgnSvg.getAttribute('viewBox') : null,
            svgRectCount: rects.length,
          };
        });
      });

      console.log('\n=== REGION SECTIONS IN DOM ===');
      regionSections.forEach(s => {
        console.log(`${s.id}: section=${Math.round(s.width)}x${Math.round(s.height)}px, img=${Math.round(s.imgDisplayWidth)}x${Math.round(s.imgDisplayHeight)}px (natural: ${s.imgNaturalWidth}x${s.imgNaturalHeight}), style.width=${s.imgStyleWidth}, svgViewBox=${s.svgViewBox}, rects=${s.svgRectCount}`);
      });

      // Take a screenshot of the viewer top
      await page.screenshot({ path: path.join(OUT_DIR, 'viewer-with-overlays.png'), fullPage: false });
      console.log('Saved viewer-with-overlays.png');

      // Scroll the viewer content to show the container indicator area
      const indicatorRect = page.locator('svg.milg-viewer-svg rect[data-region="0"]');
      if (await indicatorRect.count() > 0) {
        await indicatorRect.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT_DIR, 'viewer-indicator-area.png'), fullPage: false });
        console.log('Saved viewer-indicator-area.png');
      }

      // Scroll to first region section and screenshot
      const firstRegion = page.locator('.milg-viewer-region-section').first();
      if (await firstRegion.count() > 0) {
        await firstRegion.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT_DIR, 'viewer-region-section.png'), fullPage: false });
        console.log('Saved viewer-region-section.png');
      }

      // Grab console logs with milg-viewer prefix
      const viewerLogs = consoleLogs.filter(l => l.includes('[milg-viewer]'));
      console.log('\n=== VIEWER CONSOLE LOGS ===');
      viewerLogs.forEach(l => console.log(l));
    }

    // Write all console logs
    fs.writeFileSync(path.join(OUT_DIR, 'console-logs.txt'), consoleLogs.join('\n'));

    // Assertions (loose — this is a diagnostic test)
    expect(reportDump.regionCount).toBeGreaterThanOrEqual(0);
    expect(reportDump.hasCleanScreenshot).toBe(true);
  });
});
