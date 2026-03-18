const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const viewportLabel = document.getElementById('viewportLabel');
const darkBtn = document.getElementById('darkBtn');
const toast = document.getElementById('toast');
let darkMode = false;
let debounceTimer;
let currentViewport = 'full';
let currentPresetName = null;
let currentStyleIndex = 0;
let originalPresetHtml = '';

const tailwindColors = {
  slate:   { swatch: '#64748b', neutral: 'slate' },
  gray:    { swatch: '#6b7280', neutral: 'gray' },
  zinc:    { swatch: '#71717a', neutral: 'zinc' },
  neutral: { swatch: '#737373', neutral: 'neutral' },
  stone:   { swatch: '#78716c', neutral: 'stone' },
  red:     { swatch: '#ef4444', neutral: 'slate' },
  orange:  { swatch: '#f97316', neutral: 'stone' },
  amber:   { swatch: '#f59e0b', neutral: 'stone' },
  yellow:  { swatch: '#eab308', neutral: 'stone' },
  lime:    { swatch: '#84cc16', neutral: 'zinc' },
  green:   { swatch: '#22c55e', neutral: 'slate' },
  emerald: { swatch: '#10b981', neutral: 'zinc' },
  teal:    { swatch: '#14b8a6', neutral: 'neutral' },
  cyan:    { swatch: '#06b6d4', neutral: 'slate' },
  sky:     { swatch: '#0ea5e9', neutral: 'slate' },
  blue:    { swatch: '#3b82f6', neutral: 'slate' },
  indigo:  { swatch: '#6366f1', neutral: 'gray' },
  violet:  { swatch: '#8b5cf6', neutral: 'slate' },
  purple:  { swatch: '#a855f7', neutral: 'zinc' },
  fuchsia: { swatch: '#d946ef', neutral: 'zinc' },
  pink:    { swatch: '#ec4899', neutral: 'gray' },
  rose:    { swatch: '#f43f5e', neutral: 'gray' },
};

// Semantic color defaults per primary — avoids primary clashing with destructive/success/warning
function getSemanticColors(primary) {
  const defaults = { destructive: 'red', success: 'green', warning: 'amber' };
  if (primary === 'red') defaults.destructive = 'rose';
  if (primary === 'rose') defaults.destructive = 'red';
  if (primary === 'green') defaults.success = 'emerald';
  if (primary === 'emerald') defaults.success = 'teal';
  if (primary === 'teal') defaults.success = 'emerald';
  if (primary === 'amber') defaults.warning = 'yellow';
  if (primary === 'yellow') defaults.warning = 'orange';
  if (primary === 'orange') defaults.destructive = 'red';
  return defaults;
}

// Legacy compat — convert color name to theme-like object
function colorToTheme(colorName) {
  const info = tailwindColors[colorName] || tailwindColors.blue;
  const semantic = getSemanticColors(colorName);
  return {
    name: colorName,
    primary: colorName,
    neutral: info.neutral,
    swatch: info.swatch,
    ...semantic,
  };
}

// Primary colors now come from manifestData.elements[name].primaryColor via getElementPrimary()

const presetNeutralMap = {
  restaurant: 'stone',
};

const visualStyles = [
  { name: 'Clean', label: 'Clean', css: '' },
  { name: 'Minimalist', label: 'Minimal', css: `/* Minimalist — Quiet Precision */
[class*="shadow"]{box-shadow:none!important}
[class*="border"]{border-color:rgba(0,0,0,0.06)!important}
[class*="rounded-lg"],[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"]{border-radius:4px!important}
[class*="rounded-full"]{border-radius:9999px!important}
h1,h2,h3,h4,h5,h6{font-weight:300!important;letter-spacing:0.02em}
h1{font-size:2.25em!important}
p,span,li,td,th{opacity:0.75}
button:not([class*="bg-"]),[role="button"]:not([class*="bg-"]){font-weight:400!important;letter-spacing:0.06em;text-transform:uppercase;font-size:0.82em!important;border:1px solid rgba(0,0,0,0.1)!important;background:transparent!important;color:inherit!important}
button[class*="bg-"],[role="button"][class*="bg-"]{font-weight:400!important;letter-spacing:0.06em;text-transform:uppercase;font-size:0.82em!important;opacity:0.85}
button:hover,a:hover,[role="button"]:hover{opacity:0.5;transition:opacity 250ms ease-out}
nav,aside,[class*="border-b"],[class*="border-r"]{border-color:rgba(0,0,0,0.04)!important}
` },
  { name: 'Playful', label: 'Playful', css: `/* Playful — Fun Energy */
[class*="rounded-md"],[class*="rounded-lg"]{border-radius:16px!important}
[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"]{border-radius:24px!important}
[class*="shadow-sm"],[class*="shadow-md"]{box-shadow:0 4px 14px rgba(99,102,241,0.18),0 2px 6px rgba(244,63,94,0.12)!important}
[class*="shadow-lg"],[class*="shadow-xl"]{box-shadow:0 10px 30px rgba(99,102,241,0.22),0 4px 12px rgba(244,63,94,0.14)!important}
button,[role="button"],article{transition:transform 300ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 300ms cubic-bezier(0.34,1.56,0.64,1)!important}
button:hover,[role="button"]:hover{transform:scale(1.05) translateY(-2px)!important}
article:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(99,102,241,0.2)!important}
h1,h2,h3{font-weight:800!important;letter-spacing:-0.01em}
input,select,textarea{border-radius:14px!important}
button:active,[role="button"]:active{transform:scale(0.95)!important;transition-duration:80ms!important}
` },
  { name: 'Glass', label: 'Glass', css: `/* Glass — Frosted Modern */
body{background:linear-gradient(135deg,#dbeafe 0%,#ede9fe 35%,#fce7f3 65%,#e0f2fe 100%)!important;min-height:100vh}
[class*="bg-white"]{background:rgba(255,255,255,0.55)!important;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.4)!important;box-shadow:0 4px 24px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.6)!important}
[class*="bg-slate-50"],[class*="bg-gray-50"],[class*="bg-zinc-50"]{background:rgba(248,250,252,0.4)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
[class*="shadow-sm"],[class*="shadow-md"],[class*="shadow-lg"],[class*="shadow-xl"]{box-shadow:0 4px 20px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.5)!important}
[class*="rounded-lg"]{border-radius:14px!important}
[class*="rounded-xl"],[class*="rounded-2xl"]{border-radius:18px!important}
[class*="border"]{border-color:rgba(255,255,255,0.35)!important}
input,select,textarea{background:rgba(255,255,255,0.45)!important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.4)!important;border-radius:12px!important}
button:hover,[role="button"]:hover{box-shadow:0 0 24px rgba(99,102,241,0.18),0 6px 20px rgba(0,0,0,0.06)!important;transition:box-shadow 250ms ease-out,transform 250ms ease-out;transform:translateY(-1px)}
nav,aside,header{-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);background:rgba(255,255,255,0.65)!important}
` },
  { name: 'Editorial', label: 'Editorial', css: `/* Editorial — Refined Type */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
h1,h2,h3,h4,h5,h6{font-family:'Playfair Display',Georgia,'Times New Roman',serif!important;letter-spacing:-0.02em;line-height:1.15}
h1{font-weight:400!important;font-size:2.75em!important;letter-spacing:-0.03em}
h2{font-weight:700!important}
h3,h4,h5,h6{font-weight:700!important}
[class*="shadow"]{box-shadow:none!important}
[class*="border"]{border-color:#e2e8f0!important}
[class*="rounded-lg"],[class*="rounded-xl"],[class*="rounded-2xl"],[class*="rounded-3xl"],[class*="rounded-md"]{border-radius:2px!important}
button,[role="button"]{font-weight:400!important;letter-spacing:0.1em;text-transform:uppercase;font-size:0.78em!important;border-radius:1px!important;padding-top:0.75rem!important;padding-bottom:0.75rem!important}
a:hover{text-decoration:underline!important;text-underline-offset:4px;text-decoration-thickness:1px}
button:hover,[role="button"]:hover{opacity:0.75;transition:opacity 200ms ease}
p{line-height:1.75!important}
body{letter-spacing:0.005em}
[class*="bg-blue-600"],[class*="bg-indigo-600"],[class*="bg-violet-600"],[class*="bg-teal-600"],[class*="bg-emerald-600"],[class*="bg-rose-600"],[class*="bg-orange-600"],[class*="bg-fuchsia-600"]{background-color:#334155!important}
[class*="bg-blue-600"]:hover,[class*="bg-indigo-600"]:hover,[class*="bg-violet-600"]:hover,[class*="bg-teal-600"]:hover,[class*="bg-emerald-600"]:hover{background-color:#1e293b!important}
input,select,textarea{border-radius:1px!important}
` },
];

// --- Preview rendering ---
const darkVariantCSS = '@custom-variant dark (&:where(.dark, .dark *));';

function updatePreview() {
  const html = editor.value;
  const darkClass = darkMode ? ' class="dark"' : '';

  // Build source map for inspect mode
  let bodyHtml;
  if (inspectMode) {
    const mapped = buildSourceMap(html);
    bodyHtml = mapped.annotatedHtml;
    sourceMap = mapped.sourceMap;
  } else {
    bodyHtml = html;
    sourceMap = null;
  }

  // Inject dark variant override into any preset tailwindcss style blocks
  const processedHtml = bodyHtml.replace(
    /<style type="text\/tailwindcss">/gi,
    '<style type="text/tailwindcss">\n    ' + darkVariantCSS
  );
  const srcdoc = `<!DOCTYPE html>
<html lang="en"${darkClass}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
  <style type="text/tailwindcss">
${darkVariantCSS}
  </style>
  <style>
body { margin: 0; }
  </style>
  ${visualStyles[currentStyleIndex].css ? '<style>' + visualStyles[currentStyleIndex].css + '</style>' : ''}
</head>
<body>
${processedHtml}
${inspectMode ? inspectorAgentScript : ''}
<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a');
  if (a) {
    e.preventDefault();
  }
});
document.querySelectorAll('form').forEach(function(f) {
  f.addEventListener('submit', function(e) { e.preventDefault(); });
});
<\/script>
</body>
</html>`;
  preview.srcdoc = srcdoc;
}

function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 300);
}

let userEdited = false;

function updateTemplateName() {
  const el = document.getElementById('templateName');
  if (!currentPresetName || !manifestData) {
    el.textContent = '';
    return;
  }
  const info = manifestData.elements[currentPresetName];
  const label = info ? info.label : currentPresetName;
  el.textContent = label + (userEdited ? ' *' : '');
}

editor.addEventListener('input', () => {
  if (currentPresetName && !userEdited) {
    userEdited = true;
    updateTemplateName();
  }
  if (currentElement) {
    currentElement = null;
    currentPersonality = null;
    currentPresetName = null;
    originalPresetHtml = '';
    currentStyleIndex = 0;
    userEdited = false;
    document.getElementById('personalityButtons').style.display = 'none';
    document.getElementById('themeSwatches').style.display = 'none';
    document.getElementById('styleButtons').style.display = 'none';
    updateTemplateName();
  }
  debouncedUpdate();
});

// --- Viewport ---
function setViewport(size, e) {
  currentViewport = size;
  const btns = document.querySelectorAll('.viewport-group .btn');
  btns.forEach(b => b.classList.remove('active'));
  if (e && e.currentTarget) e.currentTarget.classList.add('active');

  if (size === 'full') {
    preview.style.width = '100%';
    viewportLabel.textContent = 'Full width';
  } else {
    preview.style.width = size + 'px';
    viewportLabel.textContent = size + 'px';
  }
}

// --- Dark mode ---
function toggleDarkMode() {
  darkMode = !darkMode;
  darkBtn.classList.toggle('active', darkMode);
  updatePreview();
}

// --- Templates (loaded from presets/ directory) ---
const presetCache = {};
let manifestData = null;
let currentElement = null;
let currentPersonality = null;

async function fetchPreset(element, personality) {
  const key = element + '/' + personality;
  if (presetCache[key]) return presetCache[key];
  try {
    const resp = await fetch('presets/' + element + '/' + personality + '.html');
    if (!resp.ok) throw new Error('Not found: ' + key);
    const html = await resp.text();
    presetCache[key] = html;
    return html;
  } catch(e) {
    console.error('Failed to load preset:', key);
    return '';
  }
}

async function loadManifest() {
  if (manifestData) return manifestData;
  try {
    const resp = await fetch('presets/index.json');
    manifestData = await resp.json();
    return manifestData;
  } catch(e) {
    console.error('Failed to load manifest:', e);
    return null;
  }
}

function getElementPrimary(element, personality) {
  personality = personality || currentPersonality || 'clean';
  if (manifestData && manifestData.elements[element]) {
    const pers = manifestData.elements[element].personalities;
    if (pers && pers[personality]) return pers[personality].primaryColor || 'blue';
  }
  return 'blue';
}

let menuBuilt = false;

async function buildPresetsMenu() {
  if (menuBuilt) return;
  const manifest = await loadManifest();
  if (!manifest) return;
  const list = document.getElementById('presetsList');
  list.innerHTML = '';

  manifest.categories.forEach((cat, catIdx) => {
    const group = document.createElement('div');
    group.className = 'preset-group';
    group.style.cssText = (catIdx === 0 ? 'padding:4px 12px 2px;' : 'padding:6px 12px 2px;border-top:1px solid var(--border);margin-top:4px;') + 'font-size:10px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.08em;';
    group.textContent = cat.label;
    list.appendChild(group);

    cat.elements.forEach(elName => {
      const el = manifest.elements[elName];
      if (!el) return;
      const persNames = Object.keys(el.personalities);
      const hasBefore = persNames.includes('before');

      if (hasBefore) {
        const btnBefore = document.createElement('button');
        btnBefore.textContent = el.label + ' \u2014 Before';
        btnBefore.onclick = () => loadPreset(elName, 'before');
        list.appendChild(btnBefore);

        const btnAfter = document.createElement('button');
        btnAfter.textContent = el.label + ' \u2014 After';
        btnAfter.onclick = () => loadPreset(elName, 'clean');
        list.appendChild(btnAfter);
      } else {
        const btn = document.createElement('button');
        btn.textContent = el.label;
        btn.onclick = () => loadPreset(elName, 'clean');
        list.appendChild(btn);
      }
    });
  });

  menuBuilt = true;
}

async function togglePresets() {
  const menu = document.getElementById('presetsMenu');
  const isOpening = !menu.classList.contains('open');
  menu.classList.toggle('open');
  if (isOpening) {
    await buildPresetsMenu();
    const input = document.getElementById('presetSearch');
    input.value = '';
    filterPresets('');
    setTimeout(() => input.focus(), 50);
  }
}

function applyColorTheme(html, fromPrimary, toPrimary, fromNeutral, toNeutral, theme) {
  let result = html;
  const shades = ['50','100','200','300','400','500','600','700','800','900','950'];
  function replaceColor(from, to) {
    if (from === to) return;
    for (const shade of shades) {
      result = result.replace(new RegExp('(\\b|-)' + from + '-' + shade + '\\b', 'g'), '$1' + to + '-' + shade);
    }
  }
  // Primary color
  replaceColor(fromPrimary, toPrimary);
  // Neutral scale
  if (fromNeutral && toNeutral) replaceColor(fromNeutral, toNeutral);
  // Semantic colors — remap to avoid clashes with new primary
  // Use temp placeholders to prevent chain replacements (e.g., red→orange→stone)
  if (theme) {
    const semanticMap = [
      ['red', theme.destructive],
      ['green', theme.success],
      ['amber', theme.warning],
    ];
    const needsRemap = semanticMap.filter(([from, to]) => from !== to);
    if (needsRemap.length > 0) {
      // Step 1: replace originals with placeholders
      for (const [from, to] of needsRemap) {
        for (const shade of shades) {
          result = result.replace(new RegExp('(\\b|-)' + from + '-' + shade + '\\b', 'g'), '$1__MILG_' + to.toUpperCase() + '_' + shade + '__');
        }
      }
      // Step 2: replace placeholders with final values
      for (const [from, to] of needsRemap) {
        for (const shade of shades) {
          result = result.replace(new RegExp('__MILG_' + to.toUpperCase() + '_' + shade + '__', 'g'), to + '-' + shade);
        }
      }
    }
  }
  return result;
}

let currentColorName = 'blue';

function renderThemeSwatches(element, personality) {
  const container = document.getElementById('themeSwatches');
  container.innerHTML = '';
  const primary = getElementPrimary(element, personality);
  if (!element || !primary) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  currentColorName = primary;

  // Render all Tailwind color swatches (skip neutral grays)
  const colorNames = Object.keys(tailwindColors).filter(c => !['slate','gray','zinc','neutral','stone'].includes(c));
  for (const name of colorNames) {
    const info = tailwindColors[name];
    const btn = document.createElement('button');
    btn.className = 'theme-swatch' + (name === primary ? ' active' : '');
    btn.style.backgroundColor = info.swatch;
    btn.title = name;
    btn.setAttribute('aria-label', name + ' color theme');
    btn.onclick = () => selectTheme(name);
    container.appendChild(btn);
  }
}

function selectTheme(colorName) {
  if (!currentElement) return;
  currentColorName = colorName;
  const fromPrimary = getElementPrimary(currentElement, currentPersonality);
  const fromNeutral = presetNeutralMap[currentElement] || 'slate';
  const theme = colorToTheme(colorName);
  const themed = applyColorTheme(originalPresetHtml, fromPrimary, theme.primary, fromNeutral, theme.neutral, theme);
  editor.value = themed;
  updatePreview();
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.title === colorName);
  });
}

function renderStyleButtons(presetName) {
  const container = document.getElementById('styleButtons');
  // Keep the "Style" label span, clear only buttons
  const label = container.querySelector('span');
  container.innerHTML = '';
  if (label) container.appendChild(label);
  if (!presetName) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  visualStyles.forEach((style, index) => {
    const btn = document.createElement('button');
    btn.className = 'style-btn' + (index === 0 ? ' active' : '');
    btn.textContent = style.label;
    btn.title = style.name;
    btn.onclick = () => selectStyle(index);
    container.appendChild(btn);
  });
}

function selectStyle(index) {
  currentStyleIndex = index;
  updatePreview();
  document.querySelectorAll('.style-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
}

function renderPersonalityButtons(element, activePersonality) {
  const container = document.getElementById('personalityButtons');
  container.innerHTML = '';
  if (!manifestData || !manifestData.elements[element]) {
    container.style.display = 'none';
    return;
  }
  const personalities = Object.keys(manifestData.elements[element].personalities).filter(p => p !== 'before');
  if (personalities.length <= 1) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  for (const pers of personalities) {
    const btn = document.createElement('button');
    btn.className = 'pers-btn' + (pers === activePersonality ? ' active' : '');
    btn.textContent = pers.charAt(0).toUpperCase() + pers.slice(1);
    btn.onclick = () => loadPreset(element, pers);
    container.appendChild(btn);
  }
}

async function loadPreset(element, personality) {
  personality = personality || 'clean';
  await loadManifest();
  const html = await fetchPreset(element, personality);
  if (!html) return;
  currentElement = element;
  currentPersonality = personality;
  currentPresetName = element;
  userEdited = false;
  const primary = getElementPrimary(element, personality);
  currentColorName = primary;
  originalPresetHtml = html;
  editor.value = html;
  document.getElementById('presetsMenu').classList.remove('open');
  updateTemplateName();
  if (personality === 'before') {
    document.getElementById('personalityButtons').style.display = 'none';
    document.getElementById('themeSwatches').style.display = 'none';
    document.getElementById('styleButtons').style.display = 'none';
    currentStyleIndex = 0;
  } else {
    renderPersonalityButtons(element, personality);
    renderThemeSwatches(element, personality);
    currentStyleIndex = 0;
    renderStyleButtons(element);
  }
  updatePreview();
}

// --- Preset search/filter ---
const presetSearch = document.getElementById('presetSearch');
presetSearch.addEventListener('input', (e) => filterPresets(e.target.value));
presetSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('presetsMenu').classList.remove('open');
  }
  if (e.key === 'Enter') {
    // Load first visible preset
    const first = document.querySelector('#presetsList button:not([style*="display: none"])');
    if (first) first.click();
  }
});

function filterPresets(query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById('presetsList');
  const buttons = list.querySelectorAll('button');
  const groups = list.querySelectorAll('.preset-group');
  let anyVisible = false;

  buttons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    const match = !q || text.includes(q);
    btn.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });

  // Hide group headers if all their buttons are hidden
  groups.forEach(group => {
    let next = group.nextElementSibling;
    let groupHasVisible = false;
    while (next && !next.classList.contains('preset-group')) {
      if (next.tagName === 'BUTTON' && next.style.display !== 'none') {
        groupHasVisible = true;
      }
      next = next.nextElementSibling;
    }
    group.style.display = groupHasVisible ? '' : 'none';
  });

  // Show empty state
  let empty = list.querySelector('.presets-empty');
  if (!anyVisible) {
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'presets-empty';
      list.appendChild(empty);
    }
    empty.textContent = 'No templates match "' + query + '"';
    empty.style.display = '';
  } else if (empty) {
    empty.style.display = 'none';
  }
}

// Close presets menu on outside click
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.presets-dropdown');
  if (!dropdown.contains(e.target)) {
    document.getElementById('presetsMenu').classList.remove('open');
  }
});

// --- Share ---
function shareDesign() {
  const html = editor.value;
  if (!html.trim()) {
    showToast('Nothing to share — add some HTML first');
    return;
  }
  // Check if content matches current loaded preset
  const isPreset = currentElement && currentPersonality && html === originalPresetHtml;
  try {
    let fragment;
    if (isPreset) {
      fragment = 'preset:' + currentElement + '/' + currentPersonality;
    } else {
      fragment = 'code:' + btoa(unescape(encodeURIComponent(html)));
    }
    const url = window.location.origin + window.location.pathname + '#' + fragment;
    navigator.clipboard.writeText(url).then(() => {
      showToast(isPreset ? 'Preset link copied' : 'Link copied to clipboard');
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  } catch (e) {
    showToast('HTML too large to share via URL');
  }
}

// --- Toast ---
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- Load from URL hash ---
async function loadFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  // Preset link — trusted, load directly
  if (hash.startsWith('preset:')) {
    const path = hash.slice(7);
    const parts = path.split('/');
    const element = parts[0];
    const personality = parts[1] || 'clean';
    await loadManifest();
    await loadPreset(element, personality);
    return;
  }

  // Custom code link — decode and check before loading
  let decoded;
  const raw = hash.startsWith('code:') ? hash.slice(5) : hash; // back-compat with old links
  try {
    decoded = decodeURIComponent(escape(atob(raw)));
  } catch (e) {
    return; // invalid hash
  }

  const hasScripts = /<script[\s>]/i.test(decoded);
  showTrustDialog(decoded, hasScripts);
}

function showTrustDialog(html, hasScripts) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:12px;padding:24px;max-width:480px;width:100%;font-family:var(--font);box-shadow:0 20px 60px rgba(0,0,0,0.3);';

  const iconColor = hasScripts ? '#dc2626' : '#f59e0b';
  const iconBg = hasScripts ? '#fef2f2' : '#fffbeb';
  const title = hasScripts ? 'Shared content contains scripts' : 'Load shared content?';
  const desc = hasScripts
    ? 'This shared link includes <code>&lt;script&gt;</code> tags that will execute code in a sandboxed iframe. Only load this if you trust the person who sent it.'
    : 'This shared link contains HTML from an external source. It will be rendered in a sandboxed iframe.';

  card.innerHTML = ''
    + '<div style="display:flex;align-items:start;gap:12px;">'
    + '  <div style="width:40px;height:40px;border-radius:8px;background:' + iconBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
    + '    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    + '  </div>'
    + '  <div>'
    + '    <h3 style="margin:0 0 4px;font-size:16px;font-weight:600;color:#0f172a;">' + title + '</h3>'
    + '    <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">' + desc + '</p>'
    + '  </div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">'
    + '  <button id="trust-cancel" style="padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:white;color:#475569;font-size:14px;font-family:var(--font);cursor:pointer;">Cancel</button>'
    + '  <button id="trust-load" style="padding:8px 16px;border:none;border-radius:8px;background:' + (hasScripts ? '#dc2626' : '#2563eb') + ';color:white;font-size:14px;font-weight:500;font-family:var(--font);cursor:pointer;">' + (hasScripts ? 'I trust this — load anyway' : 'Load preview') + '</button>'
    + '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  card.querySelector('#trust-cancel').onclick = function() {
    overlay.remove();
    // Clear hash so it doesn't re-prompt on reload
    history.replaceState(null, '', window.location.pathname);
  };
  card.querySelector('#trust-load').onclick = function() {
    overlay.remove();
    editor.value = html;
    updatePreview();
  };
}

// --- Tab key support ---
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    debouncedUpdate();
  }
});


// --- Draggable divider ---
const divider = document.getElementById('divider');
const editorPanel = document.querySelector('.editor-panel');
const mainEl = document.querySelector('.main');
let isDragging = false;

function startDrag(e) {
  isDragging = true;
  divider.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  preview.style.pointerEvents = 'none';
  e.preventDefault();
}

function onDrag(clientX) {
  if (!isDragging) return;
  const rect = mainEl.getBoundingClientRect();
  let pct = ((clientX - rect.left) / rect.width) * 100;
  pct = Math.max(20, Math.min(80, pct));
  editorPanel.style.setProperty('--editor-width', pct + '%');
  try { localStorage.setItem('milg-split', pct); } catch(e) {}
}

function stopDrag() {
  if (!isDragging) return;
  isDragging = false;
  divider.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  preview.style.pointerEvents = '';
}

divider.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', (e) => onDrag(e.clientX));
document.addEventListener('mouseup', stopDrag);
divider.addEventListener('touchstart', (e) => { startDrag(e); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (isDragging) onDrag(e.touches[0].clientX); }, { passive: true });
document.addEventListener('touchend', stopDrag);

try {
  const saved = localStorage.getItem('milg-split');
  if (saved) editorPanel.style.setProperty('--editor-width', saved + '%');
} catch(e) {}

// --- Inspect Mode ---
let inspectMode = false;
let sourceMap = null;

function toggleInspect() {
  inspectMode = !inspectMode;
  document.getElementById('inspectBtn').classList.toggle('active', inspectMode);
  updatePreview();
  if (!inspectMode) {
    editor.setSelectionRange(0, 0);
  }
}

// Source-map indexer: injects data-milg-id into opening tags, returns annotated HTML + map
function buildSourceMap(html) {
  const map = new Map();
  let id = 0;
  let result = '';
  let i = 0;
  const len = html.length;

  while (i < len) {
    // Skip <script> and <style> block contents
    const lower5 = html.substring(i, i + 7).toLowerCase();
    if (lower5.startsWith('<script') || lower5.startsWith('<style')) {
      const tagName = lower5.startsWith('<script') ? 'script' : 'style';
      const closingTag = '</' + tagName;
      // Find end of opening tag
      let openEnd = html.indexOf('>', i);
      if (openEnd === -1) { result += html.substring(i); break; }
      // Inject ID into this tag
      const tagStart = i;
      const currentId = id++;
      result += html.substring(i, openEnd) + ' data-milg-id="' + currentId + '"' + '>';
      map.set(currentId, { start: tagStart, end: openEnd + 1 });
      i = openEnd + 1;
      // Skip to closing tag
      let closeIdx = html.toLowerCase().indexOf(closingTag, i);
      if (closeIdx === -1) { result += html.substring(i); break; }
      let closeEnd = html.indexOf('>', closeIdx);
      if (closeEnd === -1) closeEnd = html.length;
      result += html.substring(i, closeEnd + 1);
      i = closeEnd + 1;
      continue;
    }

    if (html[i] === '<' && i + 1 < len && html[i + 1] !== '/' && html[i + 1] !== '!') {
      // Opening tag
      const tagStart = i;
      let j = i + 1;
      // Get tag name
      while (j < len && /[a-zA-Z0-9-]/.test(html[j])) j++;
      // Find end of tag (handle quoted attributes)
      let inQuote = null;
      while (j < len) {
        if (inQuote) {
          if (html[j] === inQuote) inQuote = null;
        } else {
          if (html[j] === '"' || html[j] === "'") inQuote = html[j];
          else if (html[j] === '>') break;
        }
        j++;
      }
      if (j >= len) { result += html.substring(i); break; }
      const currentId = id++;
      // Handle self-closing tags: insert attribute before the />, not after
      let insertPos = j;
      if (j > 0 && html[j - 1] === '/') insertPos = j - 1;
      result += html.substring(i, insertPos) + ' data-milg-id="' + currentId + '"' + html.substring(insertPos, j + 1);
      map.set(currentId, { start: tagStart, end: j + 1 });
      i = j + 1;
    } else {
      result += html[i];
      i++;
    }
  }
  return { annotatedHtml: result, sourceMap: map };
}

const inspectorAgentScript = `
<script>
(function() {
  var CHAN = 'milg-inspector';
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #3b82f6;background:rgba(59,130,246,0.08);transition:all 120ms ease-out;display:none;border-radius:3px;';
  document.body.appendChild(overlay);
  var enabled = false;
  var lastId = -1;

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.channel !== CHAN) return;
    if (e.data.type === 'set-inspect-mode') {
      enabled = e.data.enabled;
      if (!enabled) { overlay.style.display = 'none'; lastId = -1; }
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!enabled) return;
    var el = e.target;
    while (el && el !== document.body && !el.hasAttribute('data-milg-id')) el = el.parentElement;
    if (!el || !el.hasAttribute('data-milg-id')) { overlay.style.display = 'none'; lastId = -1; return; }
    var id = parseInt(el.getAttribute('data-milg-id'));
    if (id === lastId) return;
    lastId = id;
    var rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    parent.postMessage({channel: CHAN, type: 'hover', milgId: id}, '*');
  });

  document.body.addEventListener('mouseleave', function() {
    if (!enabled) return;
    overlay.style.display = 'none';
    lastId = -1;
    parent.postMessage({channel: CHAN, type: 'hover-end'}, '*');
  });

  document.addEventListener('click', function(e) {
    if (!enabled) return;
    var el = e.target;
    while (el && el !== document.body && !el.hasAttribute('data-milg-id')) el = el.parentElement;
    if (el && el.hasAttribute('data-milg-id')) {
      e.preventDefault();
      e.stopPropagation();
      parent.postMessage({channel: CHAN, type: 'select', milgId: parseInt(el.getAttribute('data-milg-id'))}, '*');
    }
  }, true);

  parent.postMessage({channel: CHAN, type: 'inspector-ready'}, '*');
})();
<\/script>`;

// Parent-side message handler
window.addEventListener('message', function(e) {
  if (e.source !== preview.contentWindow) return;
  if (!e.data || e.data.channel !== 'milg-inspector') return;

  if (e.data.type === 'inspector-ready' && inspectMode) {
    preview.contentWindow.postMessage({ channel: 'milg-inspector', type: 'set-inspect-mode', enabled: true }, '*');
  }

  if (e.data.type === 'hover' && sourceMap) {
    const info = sourceMap.get(e.data.milgId);
    if (info) {
      editor.focus();
      editor.setSelectionRange(info.start, info.end);
      // Scroll textarea to show selection
      const text = editor.value.substring(0, info.start);
      const lines = text.split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 18;
      const targetScroll = lines * lineHeight - editor.clientHeight / 3;
      editor.scrollTop = Math.max(0, targetScroll);
    }
  }

  if (e.data.type === 'hover-end') {
    editor.setSelectionRange(0, 0);
  }

  if (e.data.type === 'select' && sourceMap) {
    const info = sourceMap.get(e.data.milgId);
    if (info) {
      editor.focus();
      editor.setSelectionRange(info.start, info.end);
      const text = editor.value.substring(0, info.start);
      const lines = text.split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 18;
      const targetScroll = lines * lineHeight - editor.clientHeight / 3;
      editor.scrollTop = Math.max(0, targetScroll);
    }
  }
});

// --- Init ---
loadFromHash().then(() => {
  if (!editor.value) {
    updatePreview();
  }
});
