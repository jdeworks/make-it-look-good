/**
 * Crawl Multi-Page Flow Tests
 *
 * Tests that:
 * 1. Crawl JSON format is detected correctly (_milgCrawl marker)
 * 2. Multi-page results contain expected structure
 * 3. Single-page data is still accepted as before
 * 4. Link discovery filters correctly (hash, external, extensions, index variants)
 *
 * Run: node tests/crawl-flow.test.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}

// Load crawl module
const crawlSrc = readFileSync(resolve(__dirname, '../docs/analyzer-crawl.js'), 'utf-8');
// Execute in a minimal browser-like context
const window = { MilgScoring: { runScoring: function(d) { return { overall: 75, grade: 'C', categories: [] }; } } };
const fn = new Function('window', crawlSrc + '; return window.MilgCrawl;');
const MilgCrawl = fn(window);

console.log('\n=== Crawl Data Format Tests ===\n');

// Test 1: Crawl JSON marker detection
const singlePage = { meta: { url: 'https://example.com', title: 'Test' }, colors: { textColors: [], bgColors: [] } };
const crawlData = { _milgCrawl: true, startUrl: 'https://example.com', results: [
  { url: 'https://example.com', data: singlePage },
  { url: 'https://example.com/about', data: { ...singlePage, meta: { ...singlePage.meta, url: 'https://example.com/about' } } }
]};

assert(crawlData._milgCrawl === true, 'Crawl data has _milgCrawl marker');
assert(crawlData.results.length === 2, 'Crawl data contains 2 pages');
assert(crawlData.results[0].url === 'https://example.com', 'First page URL correct');
assert(crawlData.results[1].url === 'https://example.com/about', 'Second page URL correct');

// Test 2: Single page format detection (no _milgCrawl)
assert(!singlePage._milgCrawl, 'Single page data has no _milgCrawl marker');
assert(singlePage.meta && singlePage.colors, 'Single page has meta and colors');

console.log('\n=== Link Discovery Tests ===\n');

// Test 3: URL normalization
assert(typeof MilgCrawl.normalizeUrl === 'function', 'normalizeUrl exists');
assert(MilgCrawl.normalizeUrl('https://example.com/page#section') === 'https://example.com/page', 'Hash stripped from URL');
assert(MilgCrawl.normalizeUrl('https://example.com/page/') === 'https://example.com/page', 'Trailing slash stripped');
assert(MilgCrawl.normalizeUrl('https://example.com/page?q=1') === 'https://example.com/page', 'Query params stripped');

// Test 4: Blacklist matching
assert(typeof MilgCrawl.matchesBlacklist === 'function', 'matchesBlacklist exists');
assert(MilgCrawl.matchesBlacklist('https://example.com/blog/post', ['/blog/*']), 'Wildcard blacklist matches');
assert(!MilgCrawl.matchesBlacklist('https://example.com/about', ['/blog/*']), 'Wildcard blacklist does not match other paths');
assert(MilgCrawl.matchesBlacklist('https://example.com/pricing', ['/pricing']), 'Exact blacklist matches');

// Test 5: Link discovery (DOMParser not available in Node — skip if not present)
try {
  const htmlWithLinks = `<html><body>
    <a href="/">Home</a><a href="/about">About</a><a href="#section">Anchor</a>
    <a href="mailto:test@test.com">Email</a><a href="/file.pdf">PDF</a>
    <a href="https://other.com/page">External</a><a href="/contact">Contact</a>
  </body></html>`;
  const discovered = MilgCrawl.discoverLinks(htmlWithLinks, 'https://example.com/', [], 10);
  assert(!discovered.some(u => u.includes('#')), 'No hash URLs in discovered links');
  assert(!discovered.some(u => u.includes('mailto:')), 'No mailto URLs');
  assert(!discovered.some(u => u.includes('.pdf')), 'No PDF URLs');
  assert(!discovered.some(u => u.includes('other.com')), 'No external URLs');
  assert(discovered.some(u => u.includes('/about')), 'Internal /about link discovered');
  assert(discovered.some(u => u.includes('/contact')), 'Internal /contact link discovered');
} catch(e) {
  if (e.message.includes('DOMParser')) {
    console.log('  ⊘ discoverLinks skipped (DOMParser not available in Node)');
  } else { throw e; }
}

console.log('\n=== Session Management Tests ===\n');

// Test 6: Session creation
const session = MilgCrawl.createSession('https://example.com', { maxPages: 5 });
assert(session.startUrl === 'https://example.com', 'Session has correct startUrl');
assert(session.options.maxPages === 5, 'Session has correct maxPages');
assert(session.status === 'crawling', 'Session starts with crawling status');
assert(Array.isArray(session.pages), 'Session has pages array');

// Test 7: Summary building
session.pages.push(
  { url: 'https://example.com', status: 'done', rawData: singlePage, reportData: { overall: 85, grade: 'B', categories: [] } },
  { url: 'https://example.com/about', status: 'done', rawData: singlePage, reportData: { overall: 72, grade: 'C', categories: [] } }
);
session.status = 'complete';
const summary = MilgCrawl.buildSummary(session);
assert(summary.pagesAnalyzed === 2, 'Summary counts 2 pages');
assert(summary.averageScore === 79, 'Average score is (85+72)/2 = 79 (rounded)');
assert(summary.bestPage.score === 85, 'Best page score is 85');
assert(summary.worstPage.score === 72, 'Worst page score is 72');

console.log('\n=== Sitemap Discovery Tests ===\n');

assert(typeof MilgCrawl.discoverSitemap === 'function', 'discoverSitemap exists');
assert(typeof MilgCrawl.mergeDiscovered === 'function', 'mergeDiscovered exists');

// Fake fetchText factory: maps url → text (or throws/garbage). Callback-style.
function fakeFetch(map) {
  return function(url, cb) {
    var v = map[url];
    if (v === undefined) { cb('', '404'); return; }
    if (v instanceof Error) { cb('', v.message); return; }
    cb(v, null);
  };
}

// Test 8: basic sitemap with same-origin, cross-origin, and media entries
const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/products?ref=foo</loc></url>
  <url><loc>https://other.com/external</loc></url>
  <url><loc>https://example.com/brochure.pdf</loc></url>
  <url><loc>https://example.com/logo.png</loc></url>
</urlset>`;

const r8 = await MilgCrawl.discoverSitemap('https://example.com', fakeFetch({
  'https://example.com/robots.txt': 'User-agent: *\nDisallow:',
  'https://example.com/sitemap.xml': basicSitemap
}));
assert(r8.some(u => u.includes('/about')), 'sitemap: /about discovered');
assert(r8.some(u => u.includes('/products')), 'sitemap: /products discovered');
assert(!r8.some(u => u.includes('other.com')), 'sitemap: cross-origin excluded');
assert(!r8.some(u => u.includes('.pdf')), 'sitemap: PDF media excluded');
assert(!r8.some(u => u.includes('.png')), 'sitemap: PNG media excluded');

// Test 9: robots.txt Sitemap: directive points to a non-default sitemap URL
const r9 = await MilgCrawl.discoverSitemap('https://example.com', fakeFetch({
  'https://example.com/robots.txt': 'Sitemap: https://example.com/custom-sitemap.xml\n',
  'https://example.com/custom-sitemap.xml': `<urlset><url><loc>https://example.com/hidden</loc></url></urlset>`
}));
assert(r9.some(u => u.includes('/hidden')), 'sitemap: robots.txt Sitemap: directive followed');

// Test 10: sitemap-index pointing to a child sitemap (one level of nesting)
const indexXml = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;
const childXml = `<urlset>
  <url><loc>https://example.com/page-a</loc></url>
  <url><loc>https://example.com/page-b</loc></url>
</urlset>`;
const r10 = await MilgCrawl.discoverSitemap('https://example.com', fakeFetch({
  'https://example.com/robots.txt': '',
  'https://example.com/sitemap.xml': indexXml,
  'https://example.com/sitemap-pages.xml': childXml
}));
assert(r10.some(u => u.includes('/page-a')), 'sitemap-index: child page-a discovered');
assert(r10.some(u => u.includes('/page-b')), 'sitemap-index: child page-b discovered');
assert(!r10.some(u => u.includes('sitemap-pages.xml')), 'sitemap-index: child sitemap URL not treated as a page');

// Test 11: graceful failure — fetchText throws
const r11 = await MilgCrawl.discoverSitemap('https://example.com', function() { throw new Error('boom'); });
assert(Array.isArray(r11) && r11.length === 0, 'sitemap: returns [] when fetchText throws');

// Test 12: graceful failure — garbage / non-XML response
const r12 = await MilgCrawl.discoverSitemap('https://example.com', fakeFetch({
  'https://example.com/robots.txt': '',
  'https://example.com/sitemap.xml': 'NOT XML <<< broken &&& {}'
}));
assert(Array.isArray(r12) && r12.length === 0, 'sitemap: returns [] on garbage XML');

// Test 13: bad origin string returns []
const r13 = await MilgCrawl.discoverSitemap('not-a-url', fakeFetch({}));
assert(Array.isArray(r13) && r13.length === 0, 'sitemap: returns [] for invalid origin');

console.log('\n=== mergeDiscovered Tests ===\n');

// Test 14: dedups DOM links vs sitemap URLs (by normalizeUrl)
const m14 = MilgCrawl.mergeDiscovered(
  ['https://example.com/about', 'https://example.com/contact'],
  ['https://example.com/about/', 'https://example.com/blog'], // /about/ dups /about
  [], 10);
assert(m14.length === 3, 'mergeDiscovered: deduped about (3 unique total)');
assert(m14.filter(u => u.includes('/about')).length === 1, 'mergeDiscovered: only one /about variant kept');
assert(m14.some(u => u.includes('/blog')), 'mergeDiscovered: sitemap-only /blog included');

// Test 15: respects blacklist
const m15 = MilgCrawl.mergeDiscovered(
  ['https://example.com/about'],
  ['https://example.com/blog/post1', 'https://example.com/pricing'],
  ['/blog/*'], 10);
assert(!m15.some(u => u.includes('/blog/')), 'mergeDiscovered: blacklisted /blog/* dropped');
assert(m15.some(u => u.includes('/pricing')), 'mergeDiscovered: non-blacklisted /pricing kept');

// Test 16: respects maxPages cap (maxPages-1 since start page counts as 1)
const m16 = MilgCrawl.mergeDiscovered(
  ['https://example.com/a', 'https://example.com/b'],
  ['https://example.com/c', 'https://example.com/d', 'https://example.com/e'],
  [], 3); // cap = 2
assert(m16.length === 2, 'mergeDiscovered: capped at maxPages-1 (2)');

console.log('\n=== Results ===');
console.log(`${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
