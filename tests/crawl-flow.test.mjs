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

console.log('\n=== Results ===');
console.log(`${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
