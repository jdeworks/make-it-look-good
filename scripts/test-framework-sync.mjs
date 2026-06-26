#!/usr/bin/env node
// test-framework-sync.mjs — structural drift guard for the framework preset files.
//
// The .jsx/.vue/.svelte files under docs/presets/<el>/ are hand-written ports of
// each element's canonical clean.html. They have no live render in the sandboxed
// preview, so we can't pixel-diff them — instead we check STRUCTURAL parity:
//   1. filesystem <-> index.json frameworkFiles agree            (ERROR — deterministic)
//   2. field set (inputs/selects) matches clean.html             (WARN — heuristic)
//   3. accent color tokens for the element's hue match           (WARN — heuristic)
//   4. responsive breakpoint prefixes present in clean.html      (WARN — heuristic)
//   5. framework file not older than clean.html (git)            (WARN — freshness smell)
//
// Exit non-zero only on (1) — or on any WARN when run with --strict.
// Usage: node scripts/test-framework-sync.mjs [--strict]
//
// This is an advisory dogfood check, not a perfection gate ("don't chase 100").

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS = path.join(ROOT, 'docs', 'presets');
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const err = (el, msg) => errors.push(`  ✗ [${el}] ${msg}`);
const warn = (el, msg) => warnings.push(`  ⚠ [${el}] ${msg}`);

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

// --- token / field extractors (heuristic, tolerant) ----------------------------

// Pull class tokens from class= / className= attributes AND from string/template
// literals (framework files keep classes in `const labelClass = '...'` helpers).
function classTokens(src) {
  const tokens = new Set();
  const tailwindish = /^(?:(?:sm|md|lg|xl|2xl|max-sm|max-md|max-lg|dark|hover|focus|focus-visible|active|group-hover|disabled|placeholder|peer):)*-?[a-z][a-z0-9-]*(?:\/[0-9]+)?(?:\[[^\]]+\])?$/;
  // class / className attribute values (quotes)
  const attr = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{`([^`]*)`\})/g;
  let m;
  while ((m = attr.exec(src))) {
    (m[1] || m[2] || m[3] || m[4] || '').split(/\s+/).forEach((t) => t && tokens.add(t));
  }
  // helper consts: const xClass = '...'  /  = `...`
  const helper = /\b\w*[Cc]lass\w*\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  while ((m = helper.exec(src))) {
    (m[1] || m[2] || m[3] || '').split(/\s+/).forEach((t) => t && tailwindish.test(t) && tokens.add(t));
  }
  return tokens;
}

// Normalize a field id/name to a semantic key: lowercase, strip non-alphanumerics,
// drop a leading framing prefix so form-first-name == signup-first-name == firstName.
const PREFIXES = ['signup', 'login', 'form', 'field'];
function fieldKey(raw) {
  let k = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const p of PREFIXES) { if (k.startsWith(p) && k.length > p.length) { k = k.slice(p.length); break; } }
  return k;
}
function fieldKeys(src) {
  const keys = new Set();
  // Match any tag, then keep real form controls (input/select/textarea) AND component
  // wrappers that carry a literal id alongside a name/type — e.g. a memoized
  // <Field id="form-email" name="email" type="email" /> that renders the input internally.
  // This keeps field parity honest without forcing the markup to stay un-refactored.
  const tag = /<([A-Za-z][\w.]*)\b([^>]*?)\/?>/g;
  let m;
  while ((m = tag.exec(src))) {
    const tagName = m[1].toLowerCase();
    const attrs = m[2];
    const id = /\bid\s*=\s*["']([^"']+)["']/.exec(attrs);
    const name = /\bname\s*=\s*["']([^"']+)["']/.exec(attrs);
    const hasType = /\btype\s*=\s*["'][^"']+["']/.test(attrs);
    const isControl = tagName === 'input' || tagName === 'select' || tagName === 'textarea';
    const isComponent = /^[A-Z]/.test(m[1]); // a JSX component wrapper like <Field/>, not a native <button>
    if (isControl || (isComponent && id && (name || hasType))) {
      const ref = id ? id[1] : name ? name[1] : null;
      if (ref) keys.add(fieldKey(ref));
    }
  }
  return keys;
}

const BREAKPOINTS = ['sm:', 'md:', 'lg:', 'xl:', 'max-sm:', 'max-md:'];
function breakpoints(tokens) {
  const bp = new Set();
  for (const t of tokens) for (const b of BREAKPOINTS) if (t.includes(b)) bp.add(b);
  return bp;
}

// accent tokens for a given hue, e.g. hue=blue -> bg-blue-700, text-blue-400, ...
function hueShades(tokens, hue) {
  const shades = new Set();
  const re = new RegExp(`(?:^|:)[a-z-]+-${hue}-(\\d{2,3})`);
  for (const t of tokens) { const mm = re.exec(t); if (mm) shades.add(mm[1]); }
  return shades;
}

function gitMtime(p) {
  try {
    const out = execSync(`git log -1 --format=%ct -- "${p}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
    const n = parseInt(out.toString().trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

const setDiff = (a, b) => [...a].filter((x) => !b.has(x));

// --- load manifest -------------------------------------------------------------

const manifest = JSON.parse(read(path.join(PRESETS, 'index.json')));
const elements = manifest.elements;

// 1. filesystem -> index.json: every committed framework file must be declared.
const onDisk = {}; // el -> Set(filenames)
for (const el of fs.readdirSync(PRESETS)) {
  const dir = path.join(PRESETS, el);
  if (!fs.statSync(dir).isDirectory()) continue;
  const fwFiles = fs.readdirSync(dir).filter((f) => /\.(jsx|vue|svelte)$/.test(f));
  if (fwFiles.length) onDisk[el] = new Set(fwFiles);
}

const declared = {}; // el -> Set(filenames)
for (const [el, info] of Object.entries(elements)) {
  if (!info.frameworkFiles) continue;
  const files = new Set();
  for (const arr of Object.values(info.frameworkFiles)) for (const e of arr) files.add(e.file);
  declared[el] = files;
}

// parity both directions
for (const [el, files] of Object.entries(onDisk)) {
  const dec = declared[el] || new Set();
  for (const f of files) if (!dec.has(f)) err(el, `${f} exists on disk but is not in index.json frameworkFiles`);
}
for (const [el, files] of Object.entries(declared)) {
  const disk = onDisk[el] || new Set();
  for (const f of files) if (!disk.has(f)) err(el, `index.json declares ${f} but it is missing on disk`);
  if (!elements[el].frameworks) err(el, `frameworkFiles present but no "frameworks" badge array`);
}

// 2-5. per-file structural parity against clean.html (base files) ----------------
let filesChecked = 0;
for (const [el, files] of Object.entries(onDisk)) {
  const cleanPath = path.join(PRESETS, el, 'clean.html');
  const cleanSrc = read(cleanPath);
  if (!cleanSrc) { warn(el, 'no clean.html to diff against — skipping structural checks'); continue; }

  const hue = elements[el]?.personalities?.clean?.primaryColor || 'blue';
  const cleanTokens = classTokens(cleanSrc);
  const cleanFields = fieldKeys(cleanSrc);
  const cleanBp = breakpoints(cleanTokens);
  const cleanShades = hueShades(cleanTokens, hue);
  const cleanMtime = gitMtime(path.relative(ROOT, cleanPath));

  for (const f of files) {
    filesChecked++;
    const fp = path.join(PRESETS, el, f);
    const src = read(fp);
    const isBase = /^(react\.jsx|vue\.vue|svelte\.svelte)$/.test(f); // variants (-modal/-search/...) add behavior with no HTML counterpart
    const tokens = classTokens(src);

    // 2. field parity (base files only — variants legitimately add/remove fields)
    if (isBase) {
      const fields = fieldKeys(src);
      const extra = setDiff(fields, cleanFields);
      const missing = setDiff(cleanFields, fields);
      if (extra.length) warn(el, `${f} has fields not in clean.html: ${extra.join(', ')}`);
      if (missing.length) warn(el, `${f} is missing clean.html fields: ${missing.join(', ')}`);
    }

    // 3. accent hue parity
    const shades = hueShades(tokens, hue);
    const shadeDrift = setDiff(cleanShades, shades);
    if (isBase && shadeDrift.length) warn(el, `${f} missing ${hue} shade(s) used in clean.html: ${shadeDrift.map((s) => hue + '-' + s).join(', ')}`);

    // 4. responsive breakpoint parity
    const bpMissing = setDiff(cleanBp, breakpoints(tokens));
    if (isBase && bpMissing.length) warn(el, `${f} missing responsive breakpoints from clean.html: ${[...bpMissing].join(' ')}`);

    // 5. freshness
    const mt = gitMtime(path.relative(ROOT, fp));
    if (cleanMtime && mt && mt < cleanMtime) {
      const days = Math.round((cleanMtime - mt) / 86400);
      warn(el, `${f} last changed ${days}d before clean.html — may be stale`);
    }
  }
}

// --- report --------------------------------------------------------------------
console.log(`\nframework-sync: ${Object.keys(onDisk).length} elements, ${filesChecked} framework files checked\n`);
if (warnings.length) { console.log('WARNINGS (advisory):'); console.log(warnings.join('\n') + '\n'); }
if (errors.length) { console.log('ERRORS (must fix):'); console.log(errors.join('\n') + '\n'); }

if (errors.length) { console.log(`✗ ${errors.length} error(s).`); process.exit(1); }
if (STRICT && warnings.length) { console.log(`✗ ${warnings.length} warning(s) under --strict.`); process.exit(1); }
console.log(`✓ filesystem ↔ index.json in sync${warnings.length ? ` (${warnings.length} advisory warning(s))` : ''}.`);
