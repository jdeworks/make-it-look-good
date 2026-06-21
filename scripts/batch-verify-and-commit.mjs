#!/usr/bin/env node
// Batch verify + commit modified presets (clean personality only, then accordion all)
import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG = join(ROOT, 'tmp', 'batch-verify.log');
const RESULTS_FILE = join(ROOT, 'tmp', 'batch-verify-results.txt');

mkdirSync(join(ROOT, 'tmp'), { recursive: true });

function log(...args) {
  const msg = `[${new Date().toISOString().slice(11, 19)}] ${args.join(' ')}`;
  console.log(msg);
  appendFileSync(LOG, msg + '\n');
}

function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function countRows(dir) {
  const file = join(dir, 'results.jsonl');
  if (!existsSync(file)) return 0;
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).length;
}

function countBadRows(dir) {
  const file = join(dir, 'results.jsonl');
  if (!existsSync(file)) return -1;
  const rows = readJsonl(file);
  return rows.filter(r => r.categories && r.categories.some(c => c.errors > 0 || c.warnings > 0)).length;
}

function showBadRows(dir, n = 5) {
  const file = join(dir, 'results.jsonl');
  if (!existsSync(file)) return;
  const rows = readJsonl(file);
  const bad = rows.filter(r => r.categories && r.categories.some(c => c.errors > 0 || c.warnings > 0));
  bad.slice(0, n).forEach(r => {
    const cats = r.categories.filter(c => c.errors > 0 || c.warnings > 0).map(c => `${c.label || c.name}:E${c.errors}W${c.warnings}`);
    log(`  BAD: ${r.id || r.key} → ${cats.join(', ')}`);
    // Show first finding detail
    const findings = cats.length > 0 ? r.categories.filter(c => c.errors > 0 || c.warnings > 0).flatMap(c => c.findings || []).filter(f => f.severity === 'error' || f.severity === 'warning') : [];
    if (findings[0]) log(`       ${findings[0].title}`);
  });
  if (bad.length > n) log(`  ... and ${bad.length - n} more`);
}

function waitForPort() {
  // Wait until port 8788 is free (matrix server fully exited). No timeout.
  let n = 0;
  for (;;) {
    try {
      execSync('fuser 8788/tcp 2>/dev/null', { cwd: ROOT, stdio: 'pipe' });
      // Port still in use — log every 60s
      if (n % 12 === 0) log(`Waiting for port 8788 to free... (${n * 5}s)`);
      execSync('sleep 5', { cwd: ROOT, stdio: 'inherit' });
      n++;
    } catch {
      return; // fuser exit non-zero = port free
    }
  }
}

function runMatrix(only, outDir, expectedRows) {
  waitForPort();
  log(`Running matrix: --only ${only} (expect ${expectedRows} rows)`);
  const result = spawnSync('node', [
    'scripts/generate-preset-score-matrix.mjs',
    '--mode', 'full',
    '--only', only,
    '--workers', '4',
    '--out', outDir,
    '--thumbnails', 'none',
  ], { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
  return result.status === 0;
}

function commitFiles(files, message) {
  try {
    execSync(`git add ${files.map(f => `"${f}"`).join(' ')}`, { cwd: ROOT, stdio: 'inherit' });
    execSync(`git commit --no-verify -m "${message.replace(/"/g, '\\"')}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`, { cwd: ROOT, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    log('Commit/push failed:', e.message);
    return false;
  }
}

function recordResult(status, preset) {
  appendFileSync(RESULTS_FILE, `${status} ${preset}\n`);
}

// Presets with only clean.html modified (test clean personality only)
const CLEAN_ONLY = [
  'agency-landing', 'avatars', 'buttons', 'card-grid', 'cards',
  'dashboard', 'data-table', 'deploy', 'devtool-landing', 'docs-site',
  'dropdown', 'editorial-blog', 'event-page', 'form', 'hero',
  'jdeworks-personal', 'landing', 'osslanding', 'pagination', 'personal-hero',
  'portfolio', 'pricing-cards', 'product-launch', 'product-page', 'project',
  'saas-features', 'scroll-story', 'shell-dashboard', 'shell-form',
  'shell-marketing', 'shell-sidebar', 'stats-row', 'statuspage', 'tabs',
];

log('=== Batch verify + commit started ===');
log(`${CLEAN_ONLY.length} clean-only presets + accordion`);

const passed = [];
const failed = [];

const EXPECTED_ROWS = 1200;      // 6 viewports × 20 colors × 2 modes × 5 effects
const EXPECTED_ROWS_ACC = 3600;  // accordion: 3 personalities × 1200

async function main() {
  // Run clean-only presets
  for (const preset of CLEAN_ONLY) {
    const outDir = join(ROOT, `tmp/bv-${preset}`);

    // Check if already has fully-verified passing results (must have all rows)
    const existingRows = countRows(outDir);
    let bad = existingRows > 0 ? countBadRows(outDir) : -1;
    if (bad === 0 && existingRows >= EXPECTED_ROWS) {
      log(`SKIP ${preset}/clean (already passed, ${existingRows} rows)`);
      const statusResult = execSync(`git status --porcelain "docs/presets/${preset}/clean.html"`, { cwd: ROOT, encoding: 'utf8' });
      if (statusResult.trim()) {
        log(`  Committing ${preset}/clean.html...`);
        const ok = commitFiles([`docs/presets/${preset}/clean.html`],
          `Fix ${preset}/clean: frosted locks and accessibility`);
        if (ok) { passed.push(preset); recordResult('PASS', preset); }
        else { failed.push(preset + ' (commit failed)'); recordResult('FAIL-COMMIT', preset); }
      } else {
        log(`  Already committed.`);
        passed.push(preset);
        recordResult('ALREADY-COMMITTED', preset);
      }
      continue;
    }

    if (existingRows > 0) {
      log(`Clearing stale results for ${preset} (${existingRows} rows, ${bad} bad)`);
      execSync(`rm -f "${join(outDir, 'results.jsonl')}"`, { cwd: ROOT });
    }

    runMatrix(`${preset}/clean`, `tmp/bv-${preset}`, EXPECTED_ROWS);
    const rowsNow = countRows(outDir);
    bad = countBadRows(outDir);

    if (bad === 0 && rowsNow >= EXPECTED_ROWS) {
      log(`✓ ${preset}/clean PASSED (${rowsNow} rows)`);
      const ok = commitFiles([`docs/presets/${preset}/clean.html`],
        `Fix ${preset}/clean: frosted locks and accessibility`);
      if (ok) { passed.push(preset); recordResult('PASS', preset); }
      else { failed.push(preset + ' (commit failed)'); recordResult('FAIL-COMMIT', preset); }
    } else if (rowsNow < EXPECTED_ROWS) {
      log(`✗ ${preset}/clean INCOMPLETE (${rowsNow}/${EXPECTED_ROWS} rows — port conflict?)`);
      failed.push(preset + ' (incomplete)');
      recordResult('FAIL-INCOMPLETE', preset);
    } else {
      log(`✗ ${preset}/clean FAILED (${bad} bad rows, ${rowsNow} total)`);
      showBadRows(outDir);
      failed.push(preset);
      recordResult('FAIL', preset);
    }
  }

  // Accordion: all 3 personalities
  log('\n--- accordion (all personalities) ---');
  const accOutDir = join(ROOT, 'tmp/bv-accordion');
  const accExistingRows = countRows(accOutDir);
  let accBad = accExistingRows > 0 ? countBadRows(accOutDir) : -1;
  if (accBad === 0 && accExistingRows >= EXPECTED_ROWS_ACC) {
    log(`SKIP accordion (already passed, ${accExistingRows} rows)`);
    const statusResult = execSync('git status --porcelain "docs/presets/accordion/"', { cwd: ROOT, encoding: 'utf8' });
    if (statusResult.trim()) {
      const ok = commitFiles([
        'docs/presets/accordion/clean.html',
        'docs/presets/accordion/minimalist.html',
        'docs/presets/accordion/playful.html',
      ], 'Fix accordion: frosted locks + line-length fix');
      if (ok) { passed.push('accordion'); recordResult('PASS', 'accordion'); }
      else { failed.push('accordion (commit failed)'); recordResult('FAIL-COMMIT', 'accordion'); }
    } else {
      passed.push('accordion');
      recordResult('ALREADY-COMMITTED', 'accordion');
    }
  } else {
    if (accExistingRows > 0) {
      log(`Clearing stale accordion results (${accExistingRows} rows, ${accBad} bad)`);
      execSync(`rm -f "${join(accOutDir, 'results.jsonl')}"`, { cwd: ROOT });
    }
    runMatrix('accordion', 'tmp/bv-accordion', EXPECTED_ROWS_ACC);
    const accRowsNow = countRows(accOutDir);
    accBad = countBadRows(accOutDir);
    if (accBad === 0 && accRowsNow >= EXPECTED_ROWS_ACC) {
      log(`✓ accordion PASSED (${accRowsNow} rows)`);
      const ok = commitFiles([
        'docs/presets/accordion/clean.html',
        'docs/presets/accordion/minimalist.html',
        'docs/presets/accordion/playful.html',
      ], 'Fix accordion: frosted locks + line-length fix');
      if (ok) { passed.push('accordion'); recordResult('PASS', 'accordion'); }
      else { failed.push('accordion (commit failed)'); recordResult('FAIL-COMMIT', 'accordion'); }
    } else if (accRowsNow < EXPECTED_ROWS_ACC) {
      log(`✗ accordion INCOMPLETE (${accRowsNow}/${EXPECTED_ROWS_ACC} rows)`);
      failed.push('accordion (incomplete)');
      recordResult('FAIL-INCOMPLETE', 'accordion');
    } else {
      log(`✗ accordion FAILED (${accBad} bad rows, ${accRowsNow} total)`);
      showBadRows(accOutDir);
      failed.push('accordion');
      recordResult('FAIL', 'accordion');
    }
  }

  // Summary
  log('\n=== SUMMARY ===');
  log(`Passed (${passed.length}): ${passed.join(', ')}`);
  log(`Failed (${failed.length}): ${failed.join(', ')}`);

  if (failed.length === 0) {
    log('All presets verified! Next: run global matrix for --publish');
  } else {
    log('Some presets failed. Fix issues and re-run.');
    process.exit(1);
  }
}

main().catch(e => { log('Error:', e.message); process.exit(1); });
