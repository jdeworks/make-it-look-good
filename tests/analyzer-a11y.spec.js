// @ts-check
// Guards the analyzer UI's own accessibility affordances (v3.11.25).
const { test, expect } = require('@playwright/test');
const ANALYZER = 'http://localhost:8384/analyzer.html';

test('analyzer UI exposes accessible names + live regions', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(ANALYZER);
  const a = await page.evaluate(() => {
    const attr = (id, name) => { const el = document.getElementById(id); return el ? el.getAttribute(name) : '__missing__'; };
    return {
      toastLive: attr('toast', 'aria-live'),
      toastRole: attr('toast', 'role'),
      copySnippet: attr('copySnippetBtn', 'aria-label'),
      exportJson: attr('exportJsonBtn', 'aria-label'),
      markdown: attr('markdownBtn', 'aria-label'),
      copyMd: attr('copyMdBtn', 'aria-label'),
      llmPack: attr('llmPackBtn', 'aria-label'),
      newAnalysis: attr('newAnalysisBtn', 'aria-label'),
      sevFilter: attr('exportSeverityFilter', 'aria-label'),
      viewportSel: attr('viewportSelect', 'aria-label'),
      analysisProgressLive: attr('analysisProgress', 'aria-live'),
      // No <h4> should be used for the audience-profiles section heading (heading-order skip).
      hasProfilesH2: !!Array.from(document.querySelectorAll('h2')).find((h) => /audience profile/i.test(h.textContent || '')),
    };
  });
  console.log('A11Y', JSON.stringify(a, null, 2));
  expect(a.toastLive).toBe('polite');
  expect(a.toastRole).toBe('status');
  for (const k of ['copySnippet', 'exportJson', 'markdown', 'copyMd', 'llmPack', 'newAnalysis', 'sevFilter', 'viewportSel']) {
    expect(a[k], `${k} aria-label`).toBeTruthy();
    expect(a[k]).not.toBe('__missing__');
  }
  expect(a.analysisProgressLive).toBe('polite');
  expect(a.hasProfilesH2).toBe(true);
});

test('input tabs follow the WAI-ARIA tabs pattern (roles + roving tabindex)', async ({ page }) => {
  await page.goto(ANALYZER);
  const t = await page.evaluate(() => {
    const list = document.querySelector('.input-tabs');
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const active = tabs.find((b) => b.classList.contains('active'));
    return {
      listRole: list && list.getAttribute('role'),
      tabRoles: tabs.map((b) => b.getAttribute('role')),
      activeSelected: active && active.getAttribute('aria-selected'),
      activeTabindex: active && active.getAttribute('tabindex'),
      inactiveTabindexes: tabs.filter((b) => b !== active).map((b) => b.getAttribute('tabindex')),
      controls: tabs.map((b) => b.getAttribute('aria-controls')),
      panelsExist: tabs.every((b) => !!document.getElementById(b.getAttribute('aria-controls'))),
      panelRoles: tabs.map((b) => { const p = document.getElementById(b.getAttribute('aria-controls')); return p && p.getAttribute('role'); }),
    };
  });
  expect(t.listRole).toBe('tablist');
  expect(t.tabRoles.every((r) => r === 'tab')).toBe(true);
  expect(t.activeSelected).toBe('true');
  expect(t.activeTabindex).toBe('0');
  expect(t.inactiveTabindexes.every((x) => x === '-1')).toBe(true);
  expect(t.controls.every(Boolean)).toBe(true);
  expect(t.panelsExist).toBe(true);
  expect(t.panelRoles.every((r) => r === 'tabpanel')).toBe(true);

  // Arrow-key navigation: focus the first tab, ArrowRight activates the second.
  await page.focus('.tab-btn[data-tab="tabUrl"]');
  await page.keyboard.press('ArrowRight');
  const after = await page.evaluate(() => {
    const snippet = document.querySelector('.tab-btn[data-tab="tabSnippet"]');
    return {
      activeData: document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tab,
      snippetActive: snippet.classList.contains('active'),
      snippetSelected: snippet.getAttribute('aria-selected'),
      panelShown: document.getElementById('tabSnippet').classList.contains('active'),
    };
  });
  expect(after.activeData).toBe('tabSnippet');
  expect(after.snippetActive).toBe(true);
  expect(after.snippetSelected).toBe('true');
  expect(after.panelShown).toBe(true);
});

test('analyzer.css honors prefers-reduced-motion', async ({ page }) => {
  await page.goto(ANALYZER);
  const hasReducedMotion = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of Array.from(rules || [])) {
        if (rule.media && /prefers-reduced-motion/.test(rule.conditionText || rule.media.mediaText || '')) return true;
      }
    }
    return false;
  });
  expect(hasReducedMotion).toBe(true);
});
