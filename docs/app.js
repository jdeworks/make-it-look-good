const preview = document.getElementById('preview');
const viewportLabel = document.getElementById('viewportLabel');
const darkBtn = document.getElementById('darkBtn');
const toast = document.getElementById('toast');
let darkMode = localStorage.getItem('milg-dark') === 'true';
let debounceTimer;
let currentViewport = 'full';
let currentPresetName = null;
let currentStyleIndex = 0;
let originalPresetHtml = '';
let inspectMode = false;
let sourceMap = null;

// --- Monaco editor ---
let monacoEditor = null;
let suppressChangeEvent = false;

function initMonaco() {
  monacoEditor = monaco.editor.create(document.getElementById('editorContainer'), {
    value: '',
    language: 'html',
    theme: darkMode ? 'vs-dark' : 'vs',
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: "var(--mono), 'JetBrains Mono', 'Fira Code', monospace",
    wordWrap: 'on',
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    renderWhitespace: 'none',
    padding: { top: 8 },
  });


  monacoEditor.onDidChangeModelContent(() => {
    if (suppressChangeEvent) return;
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
}

// Compatibility layer — replaces editor.value usage
const editor = {
  get value() { return monacoEditor ? monacoEditor.getValue() : ''; },
  set value(v) {
    if (!monacoEditor) return;
    suppressChangeEvent = true;
    monacoEditor.setValue(v);
    suppressChangeEvent = false;
  },
  focus() { if (monacoEditor) monacoEditor.focus(); },
  setSelectionRange(start, end) {
    if (!monacoEditor) return;
    const model = monacoEditor.getModel();
    const startPos = model.getPositionAt(start);
    const endPos = model.getPositionAt(end);
    monacoEditor.setSelection({ startLineNumber: startPos.lineNumber, startColumn: startPos.column, endLineNumber: endPos.lineNumber, endColumn: endPos.column });
    monacoEditor.focus();
  },
};

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

// RGB values for each Tailwind color shade — used to recolor inline CSS gradients/shadows
const tailwindRGB = {
  slate:   { 50:[248,250,252],100:[241,245,249],200:[226,232,240],300:[203,213,225],400:[148,163,184],500:[100,116,139],600:[71,85,105],700:[51,65,85],800:[30,41,59],900:[15,23,42],950:[2,6,23] },
  gray:    { 50:[249,250,251],100:[243,244,246],200:[229,231,235],300:[209,213,219],400:[156,163,175],500:[107,114,128],600:[75,85,99],700:[55,65,81],800:[31,41,55],900:[17,24,39],950:[3,7,18] },
  zinc:    { 50:[250,250,250],100:[244,244,245],200:[228,228,231],300:[212,212,216],400:[161,161,170],500:[113,113,122],600:[82,82,91],700:[63,63,70],800:[39,39,42],900:[24,24,27],950:[9,9,11] },
  neutral: { 50:[250,250,250],100:[245,245,245],200:[229,229,229],300:[212,212,212],400:[163,163,163],500:[115,115,115],600:[82,82,82],700:[64,64,64],800:[38,38,38],900:[23,23,23],950:[10,10,10] },
  stone:   { 50:[250,250,249],100:[245,245,244],200:[231,229,228],300:[214,211,209],400:[168,162,158],500:[120,113,108],600:[87,83,78],700:[68,64,60],800:[41,37,36],900:[28,25,23],950:[12,10,9] },
  red:     { 50:[254,242,242],100:[254,226,226],200:[254,202,202],300:[252,165,165],400:[248,113,113],500:[239,68,68],600:[220,38,38],700:[185,28,28],800:[153,27,27],900:[127,29,29],950:[69,10,10] },
  orange:  { 50:[255,247,237],100:[255,237,213],200:[254,215,170],300:[253,186,116],400:[251,146,60],500:[249,115,22],600:[234,88,12],700:[194,65,12],800:[154,52,18],900:[124,45,18],950:[67,20,7] },
  amber:   { 50:[255,251,235],100:[254,243,199],200:[253,230,138],300:[252,211,77],400:[251,191,36],500:[245,158,11],600:[217,119,6],700:[180,83,9],800:[146,64,14],900:[120,53,15],950:[69,26,3] },
  yellow:  { 50:[254,252,232],100:[254,249,195],200:[254,240,138],300:[253,224,71],400:[250,204,21],500:[234,179,8],600:[202,138,4],700:[161,98,7],800:[133,77,14],900:[113,63,18],950:[66,32,6] },
  lime:    { 50:[247,254,231],100:[236,252,203],200:[217,249,157],300:[190,242,100],400:[163,230,53],500:[132,204,22],600:[101,163,13],700:[77,124,15],800:[63,98,18],900:[54,83,20],950:[26,46,5] },
  green:   { 50:[240,253,244],100:[220,252,231],200:[187,247,208],300:[134,239,172],400:[74,222,128],500:[34,197,94],600:[22,163,74],700:[21,128,61],800:[22,101,52],900:[20,83,45],950:[5,46,22] },
  emerald: { 50:[236,253,245],100:[209,250,229],200:[167,243,208],300:[110,231,183],400:[52,211,153],500:[16,185,129],600:[5,150,105],700:[4,120,87],800:[6,95,70],900:[6,78,59],950:[2,44,34] },
  teal:    { 50:[240,253,250],100:[204,251,241],200:[153,246,228],300:[94,234,212],400:[45,212,191],500:[20,184,166],600:[13,148,136],700:[15,118,110],800:[17,94,89],900:[19,78,74],950:[4,47,46] },
  cyan:    { 50:[236,254,255],100:[207,250,254],200:[165,243,252],300:[103,232,249],400:[34,211,238],500:[6,182,212],600:[8,145,178],700:[14,116,144],800:[21,94,117],900:[22,78,99],950:[8,51,68] },
  sky:     { 50:[240,249,255],100:[224,242,254],200:[186,230,253],300:[125,211,252],400:[56,189,248],500:[14,165,233],600:[2,132,199],700:[3,105,161],800:[7,89,133],900:[12,74,110],950:[8,47,73] },
  blue:    { 50:[239,246,255],100:[219,234,254],200:[191,219,254],300:[147,197,253],400:[96,165,250],500:[59,130,246],600:[37,99,235],700:[29,78,216],800:[30,64,175],900:[30,58,138],950:[23,37,84] },
  indigo:  { 50:[238,242,255],100:[224,231,255],200:[199,210,254],300:[165,180,252],400:[129,140,248],500:[99,102,241],600:[79,70,229],700:[67,56,202],800:[55,48,163],900:[49,46,129],950:[30,27,75] },
  violet:  { 50:[245,243,255],100:[237,233,254],200:[221,214,254],300:[196,181,253],400:[167,139,250],500:[139,92,246],600:[124,58,237],700:[109,40,217],800:[91,33,182],900:[76,29,149],950:[46,16,101] },
  purple:  { 50:[250,245,255],100:[243,232,255],200:[233,213,255],300:[216,180,254],400:[192,132,252],500:[168,85,247],600:[147,51,234],700:[126,34,206],800:[107,33,168],900:[88,28,135],950:[59,7,100] },
  fuchsia: { 50:[253,244,255],100:[250,232,255],200:[245,208,254],300:[240,171,252],400:[232,121,249],500:[217,70,239],600:[192,38,211],700:[162,28,175],800:[134,25,143],900:[112,26,117],950:[74,4,78] },
  pink:    { 50:[253,242,248],100:[252,231,243],200:[251,207,232],300:[249,168,212],400:[244,114,182],500:[236,72,153],600:[219,39,119],700:[190,24,93],800:[157,23,77],900:[131,24,67],950:[80,7,36] },
  rose:    { 50:[255,241,242],100:[255,228,230],200:[254,205,211],300:[253,164,175],400:[251,113,133],500:[244,63,94],600:[225,29,72],700:[190,18,60],800:[159,18,57],900:[136,19,55],950:[76,5,25] },
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
  // Build srcdoc by concatenation to avoid </script> inside a template literal
  // breaking the HTML parser's script detection
  const srcdoc = '<!DOCTYPE html>\n<html lang="en"' + darkClass + '>\n<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></' + 'script>\n' +
    '  <style type="text/tailwindcss">\n' + darkVariantCSS + '\n  </style>\n' +
    '  <style>\nbody { margin: 0; }\n  </style>\n' +
    (visualStyles[currentStyleIndex].css ? '  <style>' + visualStyles[currentStyleIndex].css + '</style>\n' : '') +
    '</head>\n<body>\n' +
    processedHtml + '\n' +
    (inspectMode ? inspectorAgentScript : '') + '\n' +
    '<script>\n' +
    'document.addEventListener("click", function(e) {\n' +
    '  var a = e.target.closest("a");\n' +
    '  if (a) { e.preventDefault(); }\n' +
    '});\n' +
    'document.querySelectorAll("form").forEach(function(f) {\n' +
    '  f.addEventListener("submit", function(e) { e.preventDefault(); });\n' +
    '});\n' +
    'document.addEventListener("keydown", function(e) {\n' +
    '  if (e.key === "Escape") parent.postMessage("milg-escape", "*");\n' +
    '});\n' +
    '</' + 'script>\n' +
    '</body>\n</html>';
  preview.srcdoc = srcdoc;
}

function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updatePreview, 300);
}

let userEdited = false;

// --- Flat template list for prev/next navigation ---
function getTemplateList() {
  if (!manifestData) return [];
  const list = [];
  for (const cat of manifestData.categories) {
    for (const elName of cat.elements) {
      if (manifestData.elements[elName]) list.push(elName);
    }
  }
  return list;
}

function navigateTemplate(dir) {
  if (!currentElement || !manifestData) return;
  const list = getTemplateList();
  const idx = list.indexOf(currentElement);
  if (idx === -1) return;
  const newIdx = (idx + dir + list.length) % list.length;
  const newElement = list[newIdx];
  const pers = Object.keys(manifestData.elements[newElement].personalities).filter(p => p !== 'before');
  loadPreset(newElement, pers.includes('clean') ? 'clean' : pers[0]);
}

function updateTemplateNav() {
  const nav = document.getElementById('templateNav');
  const presetsBtn = document.getElementById('presetsBtn');
  const templateName = document.getElementById('templateName');
  const hasNav = !!currentElement;
  const hasName = templateName.textContent.length > 0;
  nav.style.display = hasNav ? 'flex' : 'none';
  // Button loses right radius when nav arrows or name are attached
  presetsBtn.classList.toggle('has-nav', hasNav || hasName);
}

function updateTemplateName() {
  const el = document.getElementById('templateName');
  if (!currentPresetName || !manifestData) {
    el.textContent = '';
    updateTemplateNav();
    return;
  }
  const info = manifestData.elements[currentPresetName];
  const label = info ? info.label : currentPresetName;
  el.textContent = label + (userEdited ? ' *' : '');
  updateTemplateNav();
}

// Input handling is done via CodeMirror's updateListener in initCodeMirror()

// --- Viewport ---
function setViewport(size, e) {
  currentViewport = size;
  // Scope active state to the group containing the clicked button
  if (e && e.currentTarget) {
    const group = e.currentTarget.closest('.viewport-group');
    if (group) group.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
  }

  if (size === 'full') {
    preview.style.width = '100%';
    viewportLabel.textContent = 'Full width';
  } else {
    preview.style.width = size + 'px';
    viewportLabel.textContent = size + 'px';
  }
}

// --- Dark mode ---
function applyDarkMode() {
  document.body.classList.toggle('dark-ui', darkMode);
  document.querySelectorAll('#darkBtn, #darkBtnMobile').forEach(b => b.classList.toggle('active', darkMode));
  if (monacoEditor) monaco.editor.setTheme(darkMode ? 'vs-dark' : 'vs');
}

function toggleDarkMode() {
  darkMode = !darkMode;
  localStorage.setItem('milg-dark', darkMode);
  applyDarkMode();
  updatePreview();
}

// --- Fullscreen preview ---
let preFullscreenViewport = null;

function toggleFullscreen() {
  const entering = !document.body.classList.contains('fullscreen-preview');
  document.body.classList.toggle('fullscreen-preview');
  document.querySelectorAll('#fullscreenBtn, #fullscreenBtnMobile').forEach(b => b.classList.toggle('active', entering));
  if (entering) {
    preFullscreenViewport = currentViewport;
    preview.style.width = '100%';
    currentViewport = 'full';
    const isMobile = window.innerWidth <= 768;
    showToast(isMobile ? 'Double-tap to exit fullscreen' : 'Press Esc to exit fullscreen');
  } else if (preFullscreenViewport !== null) {
    if (preFullscreenViewport === 'full') {
      preview.style.width = '100%';
    } else {
      preview.style.width = preFullscreenViewport + 'px';
    }
    currentViewport = preFullscreenViewport;
    preFullscreenViewport = null;
  }
}

// Double-tap to exit fullscreen (touch devices)
let lastTap = 0;
document.addEventListener('touchend', function(e) {
  if (!document.body.classList.contains('fullscreen-preview')) return;
  const now = Date.now();
  if (now - lastTap < 350) {
    e.preventDefault();
    toggleFullscreen();
    lastTap = 0;
  } else {
    lastTap = now;
  }
}, { passive: false });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.body.classList.contains('fullscreen-preview')) {
    toggleFullscreen();
  }
});

// Listen for Esc from inside the iframe (iframe posts message to parent)
window.addEventListener('message', function(e) {
  if (e.source === preview.contentWindow && e.data === 'milg-escape' && document.body.classList.contains('fullscreen-preview')) {
    toggleFullscreen();
  }
});

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

// Gradient companion map — secondary colors commonly paired with each primary in gradients
// When switching primary, companion gets remapped to a shade of the new primary for coherent gradients
const gradientCompanions = {
  rose: ['pink', 'fuchsia'],
  pink: ['rose', 'fuchsia'],
  fuchsia: ['pink', 'purple'],
  purple: ['violet', 'fuchsia'],
  violet: ['purple', 'indigo'],
  indigo: ['violet', 'blue'],
  blue: ['indigo', 'sky'],
  sky: ['blue', 'cyan'],
  cyan: ['sky', 'teal'],
  teal: ['cyan', 'emerald'],
  emerald: ['teal', 'green'],
  green: ['emerald', 'lime'],
  lime: ['green', 'yellow'],
  yellow: ['lime', 'amber'],
  amber: ['yellow', 'orange'],
  orange: ['amber', 'red'],
  red: ['orange', 'rose'],
};

// Get the companion color for a target primary (one step away on the color wheel)
function getCompanion(color) {
  const neighbors = gradientCompanions[color];
  return neighbors ? neighbors[0] : color;
}

function applyColorTheme(html, fromPrimary, toPrimary, fromNeutral, toNeutral, theme) {
  let result = html;
  const shades = ['50','100','200','300','400','500','600','700','800','900','950'];

  // --- 1. Collect all secondary colors used in gradients alongside the primary ---
  const fromCompanions = gradientCompanions[fromPrimary] || [];
  const toCompanion = getCompanion(toPrimary);

  // Use placeholders to avoid chain replacements (e.g. rose→red, then pink→rose)
  function replaceColorToPlaceholder(from, placeholder) {
    if (from === toPrimary) return; // skip if already the target
    for (const shade of shades) {
      result = result.replace(new RegExp('(\\b|-)' + from + '-' + shade + '\\b', 'g'), '$1__MILG_' + placeholder + '_' + shade + '__');
    }
  }
  function resolvePlaceholder(placeholder, to) {
    for (const shade of shades) {
      result = result.replace(new RegExp('__MILG_' + placeholder + '_' + shade + '__', 'g'), to + '-' + shade);
    }
  }

  // Replace primary and its gradient companions via placeholders
  replaceColorToPlaceholder(fromPrimary, 'PRIMARY');
  for (const comp of fromCompanions) {
    if (comp !== fromPrimary && comp !== toPrimary) {
      replaceColorToPlaceholder(comp, 'COMPANION');
    }
  }
  resolvePlaceholder('PRIMARY', toPrimary);
  resolvePlaceholder('COMPANION', toCompanion);

  if (fromNeutral && toNeutral && fromNeutral !== toNeutral) {
    for (const shade of shades) {
      result = result.replace(new RegExp('(\\b|-)' + fromNeutral + '-' + shade + '\\b', 'g'), '$1' + toNeutral + '-' + shade);
    }
  }

  // --- 2. Replace inline rgba() and hex values in <style> blocks and arbitrary Tailwind values ---
  function replaceInlineColors(from, to) {
    if (from === to) return;
    const fromRGB = tailwindRGB[from];
    const toRGB = tailwindRGB[to];
    if (!fromRGB || !toRGB) return;
    for (const shade of shades) {
      const fr = fromRGB[shade];
      const tr = toRGB[shade];
      if (!fr || !tr) continue;
      // rgba(R, G, B with flexible spacing
      const rgbaPattern = new RegExp(
        'rgba\\(\\s*' + fr[0] + '\\s*,\\s*' + fr[1] + '\\s*,\\s*' + fr[2] + '\\s*,',
        'g'
      );
      result = result.replace(rgbaPattern, 'rgba(' + tr[0] + ', ' + tr[1] + ', ' + tr[2] + ',');
      // Also match without spaces (compact rgba in arbitrary Tailwind values)
      const rgbaCompact = new RegExp(
        'rgba\\(' + fr[0] + ',' + fr[1] + ',' + fr[2] + ',',
        'g'
      );
      result = result.replace(rgbaCompact, 'rgba(' + tr[0] + ',' + tr[1] + ',' + tr[2] + ',');
      // Hex values — convert RGB to hex and replace
      const fromHex = '#' + fr.map(c => c.toString(16).padStart(2, '0')).join('');
      const toHex = '#' + tr.map(c => c.toString(16).padStart(2, '0')).join('');
      if (fromHex !== toHex) {
        result = result.replace(new RegExp(fromHex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), toHex);
      }
    }
  }
  replaceInlineColors(fromPrimary, toPrimary);
  for (const comp of fromCompanions) {
    if (comp !== fromPrimary) replaceInlineColors(comp, toCompanion);
  }

  // --- 3. Semantic colors — remap to avoid clashes with new primary ---
  if (theme) {
    const semanticMap = [
      ['red', theme.destructive],
      ['green', theme.success],
      ['amber', theme.warning],
    ];
    const needsRemap = semanticMap.filter(([from, to]) => from !== to);
    if (needsRemap.length > 0) {
      for (const [from, to] of needsRemap) {
        for (const shade of shades) {
          result = result.replace(new RegExp('(\\b|-)' + from + '-' + shade + '\\b', 'g'), '$1__MILG_' + to.toUpperCase() + '_' + shade + '__');
        }
      }
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
  try {
    let fragment;
    let label;
    if (currentElement && currentPersonality && !userEdited) {
      // Share as config — encodes element, personality, color, style
      let cfg = currentElement + '/' + currentPersonality;
      const defaultColor = getElementPrimary(currentElement, currentPersonality);
      if (currentColorName && currentColorName !== defaultColor) {
        cfg += '/' + currentColorName;
      }
      if (currentStyleIndex > 0) {
        // Pad color slot if needed
        if (!cfg.includes('/', cfg.indexOf('/') + 1)) cfg += '/' + defaultColor;
        cfg += '/' + visualStyles[currentStyleIndex].name.toLowerCase();
      }
      fragment = 'preset:' + cfg;
      label = 'Preset link copied';
    } else {
      fragment = 'code:' + btoa(unescape(encodeURIComponent(html)));
      label = 'Link copied to clipboard';
    }
    const url = window.location.origin + window.location.pathname + '#' + fragment;
    navigator.clipboard.writeText(url).then(() => {
      showToast(label);
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
  // Format: preset:element/personality[/color][/style]
  if (hash.startsWith('preset:')) {
    const path = hash.slice(7);
    const parts = path.split('/');
    const element = parts[0];
    const personality = parts[1] || 'clean';
    const color = parts[2] || null;
    const style = parts[3] || null;
    await loadManifest();
    await loadPreset(element, personality);
    // Apply color theme if specified
    if (color && tailwindColors[color]) {
      selectTheme(color);
    }
    // Apply style if specified
    if (style) {
      const idx = visualStyles.findIndex(s => s.name.toLowerCase() === style);
      if (idx >= 0) selectStyle(idx);
    }
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
  card.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:480px;width:100%;font-family:var(--font);box-shadow:0 20px 60px rgba(0,0,0,0.3);color:var(--text);';

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
    + '    <h3 style="margin:0 0 4px;font-size:16px;font-weight:600;color:var(--text);">' + title + '</h3>'
    + '    <p style="margin:0;font-size:14px;color:var(--text-secondary);line-height:1.5;">' + desc + '</p>'
    + '  </div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">'
    + '  <button id="trust-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text-secondary);font-size:14px;font-family:var(--font);cursor:pointer;">Cancel</button>'
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

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  // Left/right arrow keys navigate templates (when not typing in editor/search)
  const editorContainer = document.getElementById('editorContainer');
  if ((editorContainer && editorContainer.contains(document.activeElement)) || document.activeElement === presetSearch) return;
  if (e.key === 'ArrowLeft' && currentElement) { e.preventDefault(); navigateTemplate(-1); }
  if (e.key === 'ArrowRight' && currentElement) { e.preventDefault(); navigateTemplate(1); }
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

// --- Mobile tab switching ---
function setMobileTab(tab) {
  const htmlTab = document.getElementById('mobileTabHtml');
  const previewTab = document.getElementById('mobileTabPreview');
  if (tab === 'html') {
    htmlTab.classList.add('active');
    previewTab.classList.remove('active');
    editorPanel.classList.add('mobile-visible');
    document.querySelector('.preview-panel').classList.add('mobile-hidden');
  } else {
    previewTab.classList.add('active');
    htmlTab.classList.remove('active');
    editorPanel.classList.remove('mobile-visible');
    document.querySelector('.preview-panel').classList.remove('mobile-hidden');
    updatePreview();
  }
}

// On mobile, default to full width viewport and preview tab
function initMobile() {
  if (window.innerWidth <= 768) {
    currentViewport = 'full';
    preview.style.width = '100%';
    viewportLabel.textContent = 'Full width';
  }
}


// --- Inspect Mode ---
// (inspectMode and sourceMap declared at top of file)

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

// Scroll editor to show a given character offset, centered vertically
function scrollEditorToOffset(offset) {
  if (!monacoEditor) return;
  const model = monacoEditor.getModel();
  const pos = model.getPositionAt(offset);
  monacoEditor.revealPositionInCenter(pos);
}

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
      scrollEditorToOffset(info.start);
    }
  }

  if (e.data.type === 'hover-end') {
    editor.setSelectionRange(0, 0);
  }

  if (e.data.type === 'select' && sourceMap) {
    const info = sourceMap.get(e.data.milgId);
    if (info) {
      // Exit inspect mode so the user can edit the selected code without
      // hover events changing the selection as the mouse moves
      inspectMode = false;
      document.getElementById('inspectBtn').classList.remove('active');
      // Tell the iframe to stop highlighting
      preview.contentWindow.postMessage({ channel: 'milg-inspector', type: 'set-inspect-mode', enabled: false }, '*');

      editor.focus();
      editor.setSelectionRange(info.start, info.end);
      scrollEditorToOffset(info.start);
    }
  }
});

// --- Init ---
function startApp() {
  applyDarkMode();
  initMonaco();
  initMobile();
  loadFromHash().then(() => {
    if (!editor.value) {
      updatePreview();
    }
  });
}

// Monaco loads async via require() — wait for it
if (window._monacoReady) {
  startApp();
} else {
  window.addEventListener('monaco-ready', startApp);
}
