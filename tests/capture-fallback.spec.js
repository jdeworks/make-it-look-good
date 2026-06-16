// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8384';

test('capture core returns synthetic screenshot when screenshot library cannot load', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/fixtures/parity-page.html`);
  await page.addScriptTag({ url: `${BASE_URL}/analyzer-capture.js?v=capture-fallback` });

  const result = await page.evaluate(async () => {
    delete window.modernScreenshot;
    window.__milgData = { colors: { contrastPairs: [] } };
    const preHook = (_p, done) => done();
    const preload = (_p, _proxyUrl, done) => done();
    const regionFn = () => (cb) => cb([]);

    return new Promise((resolve) => {
      const opts = {
        msgType: 'milg-screenshots-result',
        cdnUrl: '/tests/fixtures/does-not-exist-modern-screenshot.js',
        proxyUrl: '',
        expand: true,
        preHookSrc: preHook.toString(),
        preloadSrc: preload.toString(),
        regionFnSrc: regionFn.toString(),
        sendFn: (payload) => resolve(payload),
      };
      window.MilgCapture.getCaptureFn()(1.2, 0.8, () => {}, opts)(() => {});
    });
  });

  expect(result.screenshotFull).toMatch(/^data:image\/webp;base64,/);
  expect(result.screenshots).toHaveLength(1);
  expect(result.screenshotMeta.synthetic).toBe(true);
  expect(result.screenshotError.stage).toBe('library-load-error');
  expect(result.screenshotError.reason).toContain('screenshot library could not be loaded');
  expect(result.screenshotError.fallback).toBe('synthetic-canvas');
  expect(result.screenshotMeta.screenshotError.stage).toBe('library-load-error');
  expect(result.regionScreenshots).toEqual([]);
});

test('capture core uses live hooks without eval for console snippet mode', async ({ page }) => {
  await page.goto(`${BASE_URL}/tests/fixtures/parity-page.html`);
  await page.addScriptTag({ url: `${BASE_URL}/lib/modern-screenshot.min.js?v=no-eval` });
  await page.addScriptTag({ url: `${BASE_URL}/analyzer-capture.js?v=no-eval` });

  const result = await page.evaluate(async () => {
    const originalEval = window.eval;
    window.__milgData = { colors: { contrastPairs: [] } };
    window.eval = () => { throw new Error('unsafe-eval blocked by test'); };
    const preHook = (_p, done) => done();
    const preloadFn = (_p, _proxyUrl, done) => done();
    const regionFn = () => (cb) => cb([]);

    try {
      return await new Promise((resolve) => {
        const opts = {
          msgType: 'milg-screenshots-result',
          cdnUrl: 'unused-when-modern-screenshot-is-present.js',
          proxyUrl: '',
          expand: false,
          preHook,
          preloadFn,
          regionFn,
          sendFn: (payload) => resolve(payload),
        };
        window.MilgCapture.getCaptureFn()(1, 0.75, () => {}, opts)(() => {});
      });
    } finally {
      window.eval = originalEval;
    }
  });

  expect(result.screenshotFull).toMatch(/^data:image\/webp;base64,/);
  expect(result.screenshotError).toBeFalsy();
});
