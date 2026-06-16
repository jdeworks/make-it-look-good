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
  expect(result.regionScreenshots).toEqual([]);
});
