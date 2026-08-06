// @ts-check
// Guards the `#preset:element/personality[/color][/effect]` deep link (v3.11.153):
//   1. A cold load applies the accent color as part of the FIRST render — the preview is
//      never painted with the template's stock palette first (that flash was also the
//      window in which a dropped second render looked like "the color didn't apply").
//   2. The optional effect segment still lands alongside the color.
//   3. A link pasted into an ALREADY-OPEN tab works. Only the fragment changes there, so
//      the browser never reloads and the app used to ignore it completely.
//   4. Degenerate cases stay quiet: color == stock primary, an unknown color name, and
//      the `before` personality (which carries no theming at all).
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8384';
const link = (path) => `${BASE_URL}/index.html#preset:${path}`;

// product-page/playful ships 113 `rose-NNN` tokens and zero `sky-NNN` (its manifest
// primaryColor is "rose"), so a sky link has real work to do and can't pass by accident.
const EL = 'product-page';

/** Collect console warnings/errors so the new diagnostic breadcrumbs can be asserted on. */
function collectLogs(page) {
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text());
  });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  return logs;
}

/** Read the applied accent from every surface that carries it. */
async function readState(page) {
  return page.evaluate(() => {
    const frame = document.getElementById('preview');
    const srcdoc = frame ? frame.getAttribute('srcdoc') || '' : '';
    const html = typeof editor !== 'undefined' ? editor.value : '';
    const count = (s, re) => (s.match(re) || []).length;
    const trigger = document.querySelector('#themeSwatches .color-dd-trigger');
    return {
      editorSky: count(html, /sky-/g),
      editorRose: count(html, /rose-/g),
      srcdocSky: count(srcdoc, /sky-/g),
      srcdocRose: count(srcdoc, /rose-/g),
      trigger: trigger ? trigger.getAttribute('title') : null,
      swatchesHidden: (document.getElementById('themeSwatches') || {}).style?.display === 'none',
      template: (document.getElementById('templateName') || {}).textContent,
      activeEffect: (document.querySelector('#styleButtons .style-btn.active') || {}).textContent || '',
    };
  });
}

/**
 * Record every value the preview iframe is ever given, so a stock-coloured intermediate
 * render is detectable after the fact. Must run before any app script.
 */
async function recordPreviewRenders(page) {
  await page.addInitScript(() => {
    window.__milgRenders = [];
    const track = (body) => {
      const s = String(body || '');
      if (s.length < 200) return; // ignore the empty/bootstrap render
      window.__milgRenders.push({ sky: (s.match(/sky-/g) || []).length, rose: (s.match(/rose-/g) || []).length });
    };
    document.addEventListener('DOMContentLoaded', () => {
      const frame = document.getElementById('preview');
      if (!frame) return;
      const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
      Object.defineProperty(frame, 'srcdoc', {
        get() { return desc.get.call(this); },
        set(v) { track(v); desc.set.call(this, v); },
      });
      const post = frame.contentWindow && frame.contentWindow.postMessage;
      if (post) {
        frame.contentWindow.postMessage = function (msg, origin) {
          if (msg && msg.type === 'milg-render') track(msg.body);
          return post.call(this, msg, origin);
        };
      }
    });
  });
}

test.describe('preset deep links', () => {
  test('cold load applies the accent on the first render', async ({ page }) => {
    const logs = collectLogs(page);
    await recordPreviewRenders(page);
    await page.goto(link(`${EL}/playful/sky`), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const f = document.getElementById('preview');
      return f && (f.getAttribute('srcdoc') || '').length > 200;
    }, null, { timeout: 20000 });

    const s = await readState(page);
    expect(s.template).toBe('Product Page');
    expect(s.editorRose).toBe(0);
    expect(s.editorSky).toBeGreaterThan(50);
    expect(s.srcdocRose).toBe(0);
    expect(s.srcdocSky).toBeGreaterThan(50);
    expect(s.trigger).toBe('Color theme: sky');

    // No render may ever have carried the stock rose palette.
    const renders = await page.evaluate(() => window.__milgRenders);
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.filter((r) => r.rose > 0)).toEqual([]);

    expect(logs.filter((l) => l.includes('deep-link accent not applied'))).toEqual([]);
  });

  test('color and effect segments both apply', async ({ page }) => {
    await page.goto(link(`${EL}/playful/sky/frosted`), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const f = document.getElementById('preview');
      return f && (f.getAttribute('srcdoc') || '').length > 200;
    }, null, { timeout: 20000 });
    const s = await readState(page);
    expect(s.editorRose).toBe(0);
    expect(s.editorSky).toBeGreaterThan(50);
    expect(s.trigger).toBe('Color theme: sky');
    expect(s.activeEffect.toLowerCase()).toContain('frosted');
  });

  test('a link pasted into an already-open tab is applied', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const f = document.getElementById('preview');
      return f && (f.getAttribute('srcdoc') || '').length > 200;
    }, null, { timeout: 20000 });

    await page.evaluate((el) => { window.location.hash = `preset:${el}/playful/sky`; }, EL);
    await page.waitForFunction(() => {
      const t = document.querySelector('#themeSwatches .color-dd-trigger');
      return t && t.getAttribute('title') === 'Color theme: sky';
    }, null, { timeout: 20000 });

    const s = await readState(page);
    expect(s.template).toBe('Product Page');
    expect(s.editorRose).toBe(0);
    expect(s.editorSky).toBeGreaterThan(50);
  });

  test('color equal to the stock primary is a clean no-op', async ({ page }) => {
    const logs = collectLogs(page);
    // product-page/clean already has sky as its primaryColor.
    await page.goto(link(`${EL}/clean/sky`), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const f = document.getElementById('preview');
      return f && (f.getAttribute('srcdoc') || '').length > 200;
    }, null, { timeout: 20000 });
    const s = await readState(page);
    expect(s.trigger).toBe('Color theme: sky');
    expect(s.srcdocSky).toBeGreaterThan(0);
    expect(logs.filter((l) => l.includes('deep-link accent not applied'))).toEqual([]);
  });

  test('unknown color is ignored and the before personality keeps its palette', async ({ page }) => {
    const logs = collectLogs(page);
    await page.goto(link(`${EL}/playful/notacolor`), { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const f = document.getElementById('preview');
      return f && (f.getAttribute('srcdoc') || '').length > 200;
    }, null, { timeout: 20000 });
    let s = await readState(page);
    expect(s.editorRose).toBeGreaterThan(50); // stock palette kept
    expect(s.editorSky).toBe(0);

    await page.evaluate(() => { window.location.hash = 'preset:landing/before'; });
    await page.waitForFunction(() => (document.getElementById('templateName') || {}).textContent !== 'Product Page', null, { timeout: 20000 });
    s = await readState(page);
    expect(s.swatchesHidden).toBe(true);
    expect(logs.filter((l) => l.includes('deep-link accent not applied'))).toEqual([]);
  });
});
