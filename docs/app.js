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
let activePresetFilter = 'all';
let chooserState = null;
let presetScores = null;
// Editor content the last time a clean (un-edited) preset rendered — lets us detect an
// edit being undone back to the original and auto-reattach to the preset.
let lastCleanContent = '';
// When a loaded preset is hand-edited we detach from it but stash enough to show a
// "modified" breadcrumb + one-click restore. Null while on a clean preset or custom HTML.
let detachedFrom = null;

// --- Monaco editor ---
let monacoEditor = null;
let suppressChangeEvent = false;
// Snapshot of the editor content immediately after a large, HTML-ish paste. The next
// preview render is gated through the trust dialog ONLY while the content still equals
// this snapshot — so it never misfires on a later trusted change (template load, undo,
// or continued typing). Cleared as soon as it's consumed or the content diverges.
let pastePendingContent = null;

function handleEditorContentChange() {
  // Undo/typed all the way back to the clean preset -> silently reattach (button -> Share).
  if (detachedFrom && editor.value === detachedFrom.cleanHtml) {
    reattachPreset(detachedFrom);
    debouncedUpdate();
    return;
  }
  // First edit of a clean preset -> detach, but keep a breadcrumb + restore target.
  if (currentElement) {
    const info = manifestData && manifestData.elements[currentPresetName];
    detachedFrom = {
      element: currentElement,
      personality: currentPersonality,
      colorName: currentColorName,
      styleIndex: currentStyleIndex,
      label: (info && info.label) || currentPresetName,
      originalHtml: originalPresetHtml,
      cleanHtml: lastCleanContent,
    };
    currentElement = null;
    currentPersonality = null;
    currentPresetName = null;
    originalPresetHtml = '';
    userEdited = true;
    document.getElementById('personalityButtons').style.display = 'none';
    document.getElementById('themeSwatches').style.display = 'none';
    document.getElementById('styleButtons').style.display = 'none';
    updateTemplateName();
    syncMobileToolbar();
  }
  debouncedUpdate();
}

function ensureFallbackEditor(reason) {
  const container = document.getElementById('editorContainer');
  if (!container || container.querySelector('.fallback-editor')) return;
  const wrap = document.createElement('div');
  wrap.className = 'fallback-editor-wrap';
  wrap.innerHTML = '<div class="fallback-editor-notice">' +
    '<strong>Code editor fallback</strong><span>' + (reason || 'The Monaco editor did not load. You can still edit HTML here.') + '</span>' +
    '</div>';
  const textarea = document.createElement('textarea');
  textarea.className = 'fallback-editor';
  textarea.setAttribute('spellcheck', 'false');
  textarea.setAttribute('aria-label', 'HTML editor fallback');
  textarea.value = _fallbackValue || '';
  textarea.addEventListener('input', function() {
    _fallbackValue = textarea.value;
    handleEditorContentChange();
  });
  wrap.appendChild(textarea);
  container.innerHTML = '';
  container.appendChild(wrap);
}

function initMonaco() {
  if (typeof monaco === 'undefined') {
    ensureFallbackEditor('Monaco could not load from the CDN. Editing still works in this fallback textarea.');
    return;
  }
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
    handleEditorContentChange();
  });

  // Guard against pasting untrusted HTML (e.g. someone else's "Copy code" output):
  // snapshot the content so the next render can prompt before showing it. Only sizeable,
  // markup-looking pastes are guarded; normal small edits aren't interrupted.
  monacoEditor.onDidPaste((e) => {
    try {
      const pasted = monacoEditor.getModel().getValueInRange(e.range);
      if (pasted && pasted.length > 200 && /<[a-z!]/i.test(pasted)) {
        pastePendingContent = editor.value;
      }
    } catch (_) { /* range unavailable — ignore */ }
  });
}

// Compatibility layer — replaces editor.value usage
// _fallbackValue stores content when Monaco isn't available (mobile)
var _fallbackValue = '';
const editor = {
  get value() { return monacoEditor ? monacoEditor.getValue() : _fallbackValue; },
  set value(v) {
    _fallbackValue = v;
    const fallback = document.querySelector('.fallback-editor');
    if (fallback && fallback.value !== v) fallback.value = v;
    if (!monacoEditor) return;
    suppressChangeEvent = true;
    monacoEditor.setValue(v);
    suppressChangeEvent = false;
  },
  focus() {
    if (monacoEditor) monacoEditor.focus();
    else {
      const fallback = document.querySelector('.fallback-editor');
      if (fallback) fallback.focus();
    }
  },
  setSelectionRange(start, end) {
    if (!monacoEditor) {
      const fallback = document.querySelector('.fallback-editor');
      if (fallback) {
        fallback.focus();
        fallback.setSelectionRange(start, end);
      }
      return;
    }
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

// Accent choices offered in the color dropdown: every Tailwind hue plus three
// distinct grays (slate cool / zinc pure / stone warm — gray and neutral are
// near-duplicates of zinc) so the grid fills 20 = 4×5 cells exactly.
function accentColorNames() {
  return Object.keys(tailwindColors)
    .filter(c => !['slate', 'gray', 'zinc', 'neutral', 'stone'].includes(c))
    .concat(['slate', 'zinc', 'stone']);
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
  { name: 'None', label: 'None', css: '' },
  { name: 'Hushed', label: 'Hushed', css: `/* Hushed — Quiet Precision */
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
  { name: 'Bouncy', label: 'Bouncy', css: `/* Bouncy — Fun Energy */
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
  { name: 'Frosted', label: 'Frosted', css: `/* Frosted — Frosted Modern (light + dark) */
html:not(.dark) body{background:linear-gradient(135deg,#dbeafe 0%,#ede9fe 35%,#fce7f3 65%,#e0f2fe 100%)!important;min-height:100vh}
.dark body,.dark.min-h-screen,html.dark body{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 35%,#1e1b4b 65%,#0f172a 100%)!important;min-height:100vh}
html:not(.dark) [class*="bg-white"]{background:rgba(255,255,255,0.55)!important;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.4)!important;box-shadow:0 4px 24px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.6)!important}
.dark [class*="bg-slate-900"],.dark [class*="bg-slate-950"],.dark [class*="bg-gray-900"],.dark [class*="bg-gray-950"]{background:rgba(15,23,42,0.78)!important;-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(99,102,241,0.15)!important;box-shadow:0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(99,102,241,0.1)!important}
html:not(.dark) [class*="bg-slate-50"],html:not(.dark) [class*="bg-gray-50"],html:not(.dark) [class*="bg-zinc-50"]{background:rgba(248,250,252,0.4)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.dark [class*="bg-slate-800"],.dark [class*="bg-gray-800"],.dark [class*="bg-slate-850"]{background:rgba(30,41,59,0.72)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
[class*="shadow-sm"],[class*="shadow-md"],[class*="shadow-lg"],[class*="shadow-xl"]{box-shadow:0 4px 20px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.5)!important}
.dark [class*="shadow-sm"],.dark [class*="shadow-md"],.dark [class*="shadow-lg"],.dark [class*="shadow-xl"]{box-shadow:0 4px 20px rgba(0,0,0,0.3),inset 0 1px 0 rgba(99,102,241,0.1)!important}
[class*="rounded-lg"]{border-radius:14px!important}
[class*="rounded-xl"],[class*="rounded-2xl"]{border-radius:18px!important}
html:not(.dark) [class*="border-slate-200"],html:not(.dark) [class*="border-gray-200"],html:not(.dark) [class*="border-zinc-200"]{border-color:rgba(255,255,255,0.35)!important}
.dark [class*="border-slate-700"],.dark [class*="border-slate-800"],.dark [class*="border-gray-700"],.dark [class*="border-gray-800"]{border-color:rgba(99,102,241,0.15)!important}
[class*="divide-slate"],[class*="divide-gray"],[class*="divide-zinc"]{--tw-divide-opacity:0.3}
html:not(.dark) [class*="border-t"]:not([class*="border-t-0"]){border-color:rgba(100,116,139,0.2)!important}
.dark [class*="border-t"]:not([class*="border-t-0"]){border-color:rgba(99,102,241,0.12)!important}
html:not(.dark) [class*="text-slate-500"],html:not(.dark) [class*="text-gray-500"],html:not(.dark) [class*="text-zinc-500"]{color:rgb(51,65,85)!important}
html:not(.dark) [class*="text-slate-400"],html:not(.dark) [class*="text-gray-400"]{color:rgb(71,85,105)!important}
.dark [class*="text-slate-400"],.dark [class*="text-gray-400"]{color:rgb(148,163,184)!important}
.dark [class*="text-slate-300"],.dark [class*="text-gray-300"]{color:rgb(203,213,225)!important}
input,select,textarea{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-radius:12px!important}
html:not(.dark) input,html:not(.dark) select,html:not(.dark) textarea{background:rgba(255,255,255,0.45)!important;border:1px solid rgba(255,255,255,0.4)!important}
.dark input,.dark select,.dark textarea{background:rgba(15,23,42,0.45)!important;border:1px solid rgba(99,102,241,0.2)!important}
button:hover,[role="button"]:hover{box-shadow:0 0 24px rgba(99,102,241,0.18),0 6px 20px rgba(0,0,0,0.06)!important;transition:box-shadow 250ms ease-out,transform 250ms ease-out;transform:translateY(-1px)}
html:not(.dark) nav,html:not(.dark) aside,html:not(.dark) header{-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);background:rgba(255,255,255,0.65)!important}
.dark nav,.dark aside,.dark header{-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);background:rgba(15,23,42,0.65)!important}
` },
  { name: 'Serif', label: 'Serif', css: `/* Serif — Refined Type */
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

// Thin, theme-matched scrollbar for the rendered-template preview iframe (its own
// document, so it can't use the app's CSS vars). Semi-transparent grey tuned per mode.
function previewScrollbarCSS(dark) {
  const thumb = dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
  const thumbHover = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  return 'html{scrollbar-width:thin;scrollbar-color:' + thumb + ' transparent}'
    + '::-webkit-scrollbar{width:10px;height:10px}'
    + '::-webkit-scrollbar-track{background:transparent}'
    + '::-webkit-scrollbar-thumb{background:' + thumb + ';border-radius:5px}'
    + '::-webkit-scrollbar-thumb:hover{background:' + thumbHover + '}'
    + '::-webkit-scrollbar-corner{background:transparent}';
}

function buildPreviewSrcdoc(html, opts) {
  opts = opts || {};
  const dark = opts.dark !== undefined ? opts.dark : darkMode;
  const effectCSS = opts.effectCSS !== undefined ? opts.effectCSS : (visualStyles[currentStyleIndex].css || '');
  const includeInspector = opts.includeInspector ? inspectorAgentScript : '';
  const darkClass = dark ? ' class="dark"' : '';
  const processedHtml = html.replace(
    /<style type="text\/tailwindcss">/gi,
    '<style type="text/tailwindcss">\n    ' + darkVariantCSS
  );

  return '<!DOCTYPE html>\n<html lang="en"' + darkClass + '>\n<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <script>function __milgTailwindFailed(){document.documentElement.classList.add("milg-tailwind-failed");try{parent.postMessage({type:"milg-tailwind-failed"},"*")}catch(e){}}</' + 'script>\n' +
    '  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" onerror="__milgTailwindFailed()"></' + 'script>\n' +
      '  <style type="text/tailwindcss">\n' + darkVariantCSS + '\n  </style>\n' +
    '  <style>\nbody { margin: 0; }\n' + previewScrollbarCSS(dark) + '\n' +
    '.milg-tailwind-failed body:before{content:"Tailwind CDN failed to load. Preview may appear unstyled.";display:block;position:sticky;top:0;z-index:2147483647;padding:10px 14px;background:#7f1d1d;color:#fff;font:13px/1.4 system-ui,sans-serif;text-align:center}\n  </style>\n' +
    (effectCSS ? '  <style>' + effectCSS + '</style>\n' : '') +
    '</head>\n<body>\n' +
    processedHtml + '\n' +
    includeInspector + '\n' +
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
    'var _lastTap = 0;\n' +
    'document.addEventListener("touchend", function(e) {\n' +
    '  var now = Date.now();\n' +
    '  if (now - _lastTap < 350) { parent.postMessage("milg-double-tap", "*"); _lastTap = 0; }\n' +
    '  else { _lastTap = now; }\n' +
    '});\n' +
    '</' + 'script>\n' +
    '<script>\n' +
    'window.addEventListener("message", function(e) {\n' +
    '  if (e.data && e.data.type === "milg-run-analyzer") {\n' +
    '    var s = document.createElement("script");\n' +
    '    s.textContent = ' + JSON.stringify(analyzePreviewScript) + ';\n' +
    '    document.body.appendChild(s);\n' +
    '    s.remove();\n' +
    '  }\n' +
    '});\n' +
    '</' + 'script>\n' +
    '</body>\n</html>';
}

function updatePreview() {
  const html = editor.value;

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

  preview.srcdoc = buildPreviewSrcdoc(bodyHtml, { includeInspector: inspectMode });
  // Remember the content of a clean preset so an edit-then-revert can reattach.
  if (currentElement && !userEdited) lastCleanContent = html;
}

function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (pastePendingContent !== null) {
      const snapshot = pastePendingContent;
      pastePendingContent = null;
      // Only prompt if the content about to render is still exactly the pasted content.
      // A later edit or template load diverges from the snapshot and renders normally.
      if (editor.value === snapshot) {
        const hasScripts = /<script[\s>]/i.test(snapshot);
        showTrustDialog(snapshot, hasScripts, {
          paste: true,
          onConfirm: updatePreview,
          onCancel: () => {
            // Revert the paste so untrusted HTML never stays in the editor.
            if (monacoEditor) monacoEditor.trigger('paste-guard', 'undo', null);
            updatePreview();
            showToast('Pasted content reverted');
          },
        });
        return;
      }
    }
    updatePreview();
  }, 300);
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

function updateShareButton() {
  const btn = document.getElementById('shareBtn');
  if (!btn) return;
  const isPreset = currentElement && currentPersonality && !userEdited;
  const labelSpan = btn.querySelector('.share-label');
  if (labelSpan) labelSpan.textContent = isPreset ? 'Share' : 'Copy code';
  btn.title = isPreset ? 'Copy shareable link' : 'Copy the full edited HTML to the clipboard';
}

function updateTemplateName() {
  updateShareButton();
  const el = document.getElementById('templateName');
  const restoreBtn = document.getElementById('restoreTemplateBtn');
  // Clean preset loaded.
  if (currentPresetName && manifestData) {
    const info = manifestData.elements[currentPresetName];
    el.textContent = info ? info.label : currentPresetName;
    if (restoreBtn) restoreBtn.style.display = 'none';
    updateTemplateNav();
    return;
  }
  // Edited from a preset → show the breadcrumb + restore control.
  if (detachedFrom) {
    el.textContent = detachedFrom.label + ' • modified';
    if (restoreBtn) restoreBtn.style.display = '';
    updateTemplateNav();
    return;
  }
  // Custom HTML with no preset origin.
  el.textContent = '';
  if (restoreBtn) restoreBtn.style.display = 'none';
  updateTemplateNav();
}

// Re-attach to the preset stashed in `d` without re-fetching: restores the editor
// state vars + sidebar controls. Caller guarantees the editor already holds the clean
// HTML (auto-revert) or sets it first (restore button).
function reattachPreset(d) {
  currentElement = d.element;
  currentPersonality = d.personality;
  currentPresetName = d.element;
  currentColorName = d.colorName;
  currentStyleIndex = d.styleIndex;
  originalPresetHtml = d.originalHtml;
  userEdited = false;
  detachedFrom = null;
  lastCleanContent = editor.value;
  if (d.personality === 'before') {
    document.getElementById('personalityButtons').style.display = 'none';
    document.getElementById('themeSwatches').style.display = 'none';
    document.getElementById('styleButtons').style.display = 'none';
  } else {
    try { renderPersonalityButtons(d.element, d.personality); } catch (e) { console.error('[milg] personality render failed:', e); }
    try { renderThemeSwatches(d.element, d.personality); } catch (e) { console.error('[milg] swatch render failed:', e); }
    try { renderStyleButtons(d.element); } catch (e) { console.error('[milg] style render failed:', e); }
  }
  try { syncMobileToolbar(); } catch (e) { console.error('[milg] mobile toolbar sync failed:', e); }
  updateTemplateName();
}

// Restore button — discard edits and return to the original preset.
function restoreTemplate() {
  if (!detachedFrom) return;
  const d = detachedFrom;
  userAccentColor = null; // "restore original" includes the original colors
  editor.value = d.cleanHtml; // setter suppresses the change event
  reattachPreset(d);
  updatePreview();
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
  document.querySelectorAll('#darkBtn').forEach(b => b.classList.toggle('active', darkMode));
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
  document.querySelectorAll('#fullscreenBtn').forEach(b => b.classList.toggle('active', entering));
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
  if (e.source !== preview.contentWindow) return;
  if (e.data === 'milg-escape' && document.body.classList.contains('fullscreen-preview')) {
    toggleFullscreen();
  }
  if (e.data === 'milg-double-tap' && document.body.classList.contains('fullscreen-preview')) {
    toggleFullscreen();
  }
  if (e.data && e.data.type === 'milg-tailwind-failed') {
    showToast('Tailwind CDN failed to load; preview may appear unstyled.');
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

async function loadPresetScores() {
  if (presetScores) return presetScores;
  try {
    const resp = await fetch('presets/scores.json');
    if (!resp.ok) throw new Error('No scores artifact');
    presetScores = await resp.json();
  } catch(e) {
    presetScores = { matrix: {} };
  }
  return presetScores;
}

function getPresetCategory(element) {
  if (!manifestData || !manifestData.categories) return '';
  for (const cat of manifestData.categories) {
    if ((cat.elements || []).indexOf(element) !== -1) return cat.label;
  }
  return '';
}

function inferPresetKind(element, info) {
  if (info && info.kind) return info.kind;
  const category = getPresetCategory(element).toLowerCase();
  const label = ((info && info.label) || element).toLowerCase();
  if (category.indexOf('before') !== -1) return 'before-after';
  if (category.indexOf('layout') !== -1 || element.indexOf('shell-') === 0) return 'app';
  if (category.indexOf('expressive') !== -1) return 'expressive';
  if (category.indexOf('full') !== -1 || /landing|portfolio|restaurant|pricing|product|event|docs|blog|site/.test(element)) return 'full-page';
  if (/dashboard|table|status|deploy/.test(element + ' ' + label)) return 'dashboard';
  if (/form|onboarding/.test(element + ' ' + label)) return 'form';
  return 'component';
}

function getPresetTags(element, info) {
  const tags = [element, getPresetCategory(element), inferPresetKind(element, info), (info && info.label) || ''];
  if (info && info.tags) tags.push.apply(tags, info.tags);
  if (/dev|docs|oss|deploy/.test(element)) tags.push('developers', 'technical');
  if (/dashboard|table|status|shell/.test(element)) tags.push('business', 'app');
  if (/landing|pricing|product|agency|restaurant|event/.test(element)) tags.push('marketing', 'public');
  if (/form/.test(element)) tags.push('onboarding');
  if (/portfolio|personal|blog|editorial/.test(element)) tags.push('portfolio', 'content');
  return tags.filter(Boolean).map(String);
}

function getBestFor(element, info) {
  if (info && info.bestFor && info.bestFor.length) return info.bestFor.join(', ');
  const kind = inferPresetKind(element, info);
  if (kind === 'dashboard') return 'Admin tools, metrics, operational screens';
  if (kind === 'form') return 'Signup, onboarding, structured input flows';
  if (kind === 'full-page') return 'Complete pages with a strong starting structure';
  if (kind === 'expressive') return 'High-character marketing and editorial directions';
  if (kind === 'app') return 'Application shells and repeat-use product UI';
  if (kind === 'before-after') return 'Comparing weak and improved design decisions';
  return 'Focused UI components and reusable sections';
}

function hasFrameworkFile(element, personality, framework) {
  // The current gallery can only test committed framework variants if they are
  // mirrored beside the HTML preset. This keeps badges truthful without network work.
  return false;
}

function getPresetFrameworks(element, info) {
  if (info && info.frameworks && info.frameworks.length) return info.frameworks;
  return ['html'];
}

function getPresetScore(element, personality) {
  const key = element + '/' + personality;
  const row = presetScores && presetScores.matrix ? presetScores.matrix[key] : null;
  if (!row) return null;
  if (row.default && typeof row.default.score === 'number') return row.default.score;
  if (typeof row.avg === 'number') return Math.round(row.avg);
  if (typeof row.min === 'number') return row.min;
  return null;
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
  await loadPresetScores();
  const list = document.getElementById('presetsList');
  list.innerHTML = '';

  const filterWrap = document.createElement('div');
  filterWrap.className = 'preset-filter-row';
  const filters = [
    ['all', 'All'],
    ['full-page', 'Pages'],
    ['expressive', 'Expressive'],
    ['app', 'App'],
    ['dashboard', 'Dashboard'],
    ['component', 'Components'],
    ['before-after', 'Before/After']
  ];
  filters.forEach(([id, label]) => {
    const chip = document.createElement('button');
    chip.className = 'preset-filter-chip' + (id === activePresetFilter ? ' active' : '');
    chip.textContent = label;
    chip.dataset.filter = id;
    chip.onclick = () => setPresetFilter(id);
    filterWrap.appendChild(chip);
  });
  list.appendChild(filterWrap);

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
        list.appendChild(createPresetCard(elName, 'before'));
        list.appendChild(createPresetCard(elName, 'clean', 'After'));
      } else {
        const preferred = persNames.indexOf('clean') !== -1 ? 'clean' : persNames[0];
        list.appendChild(createPresetCard(elName, preferred));
      }
    });
  });

  menuBuilt = true;
}

function createPresetCard(element, personality, suffix) {
  const info = manifestData.elements[element];
  const category = getPresetCategory(element);
  const kind = inferPresetKind(element, info);
  const persNames = Object.keys(info.personalities || {});
  const bestFor = getBestFor(element, info);
  const score = getPresetScore(element, personality);
  const tags = getPresetTags(element, info).concat(persNames);
  const frameworks = getPresetFrameworks(element, info).map(f => f.toUpperCase()).join(', ');
  const card = document.createElement('button');
  card.className = 'preset-card';
  card.dataset.kind = kind;
  card.dataset.search = tags.concat([bestFor, personality, suffix || '']).join(' ').toLowerCase();
  card.onclick = () => loadPreset(element, personality);

  const title = info.label + (suffix ? ' - ' + suffix : personality === 'before' ? ' - Before' : '');
  const variants = persNames.filter(p => p !== 'before').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
  const scoreHtml = score === null
    ? '<span class="preset-score pending">No score</span>'
    : '<span class="preset-score ' + (score >= 90 ? 'good' : score >= 85 ? 'review' : 'fail') + '">' + score + '</span>';

  card.innerHTML = ''
    + '<span class="preset-thumb" aria-hidden="true"><span>' + escapeHtml((info.label || element).slice(0, 2).toUpperCase()) + '</span></span>'
    + '<span class="preset-card-body">'
    + '  <span class="preset-card-top"><span class="preset-card-title">' + escapeHtml(title) + '</span>' + scoreHtml + '</span>'
    + '  <span class="preset-card-meta">' + escapeHtml(category || kind) + ' / ' + escapeHtml(kind.replace('-', ' ')) + '</span>'
    + '  <span class="preset-card-best">' + escapeHtml(bestFor) + '</span>'
    + '  <span class="preset-card-badges"><span>' + escapeHtml(variants || personality) + '</span><span>' + escapeHtml(frameworks) + '</span></span>'
    + '</span>'
    + '<span class="preset-card-action">Start</span>';
  return card;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}

function setPresetFilter(filter) {
  activePresetFilter = filter;
  document.querySelectorAll('.preset-filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  filterPresets(document.getElementById('presetSearch').value || '');
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
      // rgb(R, G, B) without alpha — spaced and compact forms
      const rgbPattern = new RegExp(
        'rgb\\(\\s*' + fr[0] + '\\s*,\\s*' + fr[1] + '\\s*,\\s*' + fr[2] + '\\s*\\)',
        'g'
      );
      result = result.replace(rgbPattern, 'rgb(' + tr[0] + ',' + tr[1] + ',' + tr[2] + ')');
      const rgbCompact = new RegExp(
        'rgb\\(' + fr[0] + ',' + fr[1] + ',' + fr[2] + '\\)',
        'g'
      );
      result = result.replace(rgbCompact, 'rgb(' + tr[0] + ',' + tr[1] + ',' + tr[2] + ')');
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
// Accent the user explicitly picked (null = none yet). Survives personality and
// template switches — each loadPreset re-tints the fresh preset with it.
let userAccentColor = null;

// Desktop: compact color dropdown — one color-well trigger, options stack
// below it as gapless color blocks (mobile toolbar keeps the swatch grid).
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

  const colorNames = accentColorNames();
  const label = document.createElement('span');
  label.style.cssText = 'font-size:9px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.08em;margin-right:2px;';
  label.textContent = 'Accent color';
  container.appendChild(label);
  const dd = document.createElement('div');
  dd.className = 'color-dd';
  const trigger = document.createElement('button');
  trigger.className = 'color-dd-trigger';
  trigger.style.backgroundColor = tailwindColors[primary].swatch;
  trigger.title = 'Color theme: ' + primary;
  trigger.setAttribute('aria-label', 'Color theme: ' + primary + ' — open color list');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div');
  menu.className = 'color-dd-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Color theme');
  for (const name of colorNames) {
    const opt = document.createElement('button');
    opt.className = 'color-dd-option' + (name === primary ? ' selected' : '');
    opt.style.backgroundColor = tailwindColors[name].swatch;
    opt.dataset.color = name;
    opt.title = name;
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', name === primary ? 'true' : 'false');
    opt.setAttribute('aria-label', name + ' color theme');
    opt.onclick = (e) => { e.stopPropagation(); selectTheme(name); closeColorMenu(); };
    menu.appendChild(opt);
  }
  trigger.onclick = (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) closeColorMenu();
    else openColorMenu(trigger, menu);
  };
  dd.appendChild(trigger);
  dd.appendChild(menu);
  container.appendChild(dd);
}

// The toolbar scroll container clips overflow, so the menu is position:fixed
// and anchored to the trigger on open; any outside scroll/resize closes it.
let _colorMenuCleanup = null;
function openColorMenu(trigger, menu) {
  closeColorMenu();
  const r = trigger.getBoundingClientRect();
  menu.style.top = (r.bottom + 4) + 'px';
  // 4-column grid is 176px wide — center it under the trigger, clamped to the viewport
  const centered = r.left + r.width / 2 - 88;
  menu.style.left = Math.max(8, Math.min(centered, window.innerWidth - 184)) + 'px';
  menu.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
  const onDoc = (e) => { if (!menu.contains(e.target) && e.target !== trigger) closeColorMenu(); };
  const onKey = (e) => { if (e.key === 'Escape') { closeColorMenu(); trigger.focus(); } };
  const onAway = (e) => { if (e.target === menu) return; closeColorMenu(); };
  document.addEventListener('click', onDoc, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onAway);
  window.addEventListener('scroll', onAway, true);
  _colorMenuCleanup = () => {
    document.removeEventListener('click', onDoc, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onAway);
    window.removeEventListener('scroll', onAway, true);
    menu.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  };
}
function closeColorMenu() {
  if (_colorMenuCleanup) { _colorMenuCleanup(); _colorMenuCleanup = null; }
}

function selectTheme(colorName) {
  if (!currentElement) return;
  currentColorName = colorName;
  userAccentColor = colorName;
  const fromPrimary = getElementPrimary(currentElement, currentPersonality);
  const fromNeutral = presetNeutralMap[currentElement] || 'slate';
  const theme = colorToTheme(colorName);
  const themed = applyColorTheme(originalPresetHtml, fromPrimary, theme.primary, fromNeutral, theme.neutral, theme);
  editor.value = themed;
  updatePreview();
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.title === colorName);
  });
  const trig = document.querySelector('#themeSwatches .color-dd-trigger');
  if (trig && tailwindColors[colorName]) {
    trig.style.backgroundColor = tailwindColors[colorName].swatch;
    trig.title = 'Color theme: ' + colorName;
    trig.setAttribute('aria-label', 'Color theme: ' + colorName + ' — open color list');
  }
  document.querySelectorAll('#themeSwatches .color-dd-option').forEach(o => {
    const on = o.dataset.color === colorName;
    o.classList.toggle('selected', on);
    o.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  syncMobileToolbar();
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
  syncMobileToolbar();
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
    // Per-step guards, like autoLoadTemplate: a toolbar render failing must
    // never stop the preview below from updating (the editor is already set).
    try { renderPersonalityButtons(element, personality); } catch (e) { console.error('[milg] personality render failed:', e); }
    try { renderThemeSwatches(element, personality); } catch (e) { console.error('[milg] swatch render failed:', e); }
    currentStyleIndex = 0;
    try { renderStyleButtons(element); } catch (e) { console.error('[milg] style render failed:', e); }
  }
  try { syncMobileToolbar(); } catch (e) { console.error('[milg] mobile toolbar sync failed:', e); }
  // Keep the user's chosen accent across personality/template switches:
  // re-tint the freshly loaded preset instead of showing its stock primary.
  if (userAccentColor && personality !== 'before' && userAccentColor !== primary) {
    try { selectTheme(userAccentColor); } catch (e) { console.error('[milg] accent reapply failed:', e); updatePreview(); }
  } else {
    updatePreview();
  }
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
    const first = document.querySelector('#presetsList .preset-card:not([style*="display: none"])');
    if (first) first.click();
  }
});

function filterPresets(query) {
  const q = query.toLowerCase().trim();
  const list = document.getElementById('presetsList');
  const cards = list.querySelectorAll('.preset-card');
  const groups = list.querySelectorAll('.preset-group');
  let anyVisible = false;

  cards.forEach(card => {
    const text = (card.textContent + ' ' + (card.dataset.search || '')).toLowerCase();
    const queryMatch = !q || text.includes(q);
    const filterMatch = activePresetFilter === 'all' || card.dataset.kind === activePresetFilter;
    const match = queryMatch && filterMatch;
    card.style.display = match ? '' : 'none';
    if (match) anyVisible = true;
  });

  // Hide group headers if all their buttons are hidden
  groups.forEach(group => {
    let next = group.nextElementSibling;
    let groupHasVisible = false;
    while (next && !next.classList.contains('preset-group')) {
      if (next.classList && next.classList.contains('preset-card') && next.style.display !== 'none') {
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
  if (currentElement && currentPersonality && !userEdited) {
    // Unchanged preset → short, restorable link (element/personality/color/style).
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
    const url = window.location.origin + window.location.pathname + '#preset:' + cfg;
    navigator.clipboard.writeText(url)
      .then(() => showToast('Preset link copied'))
      .catch(() => prompt('Copy this link:', url));
  } else {
    // Uniquely edited HTML → URLs can't reliably hold it, so copy the full HTML
    // to the clipboard. Paste it back into the editor to restore.
    navigator.clipboard.writeText(html)
      .then(() => showToast('Full HTML copied — paste it into the editor to restore'))
      .catch(() => prompt('Copy this HTML:', html));
  }
}

function openTemplateChooser() {
  loadManifest().then(function() {
    renderTemplateChooser();
  });
}

function closeTemplateChooser() {
  localStorage.setItem('milg-template-chooser-dismissed', 'true');
  const overlay = document.getElementById('templateChooserOverlay');
  if (overlay) overlay.remove();
}

function renderTemplateChooser() {
  closeTemplateChooser();
  chooserState = chooserState || { what: 'landing', audience: 'developers', personality: 'clean', framework: 'html' };
  const overlay = document.createElement('div');
  overlay.id = 'templateChooserOverlay';
  overlay.className = 'chooser-overlay';
  overlay.innerHTML = ''
    + '<div class="chooser-panel" role="dialog" aria-modal="true" aria-label="Find my template">'
    + '  <div class="chooser-head">'
    + '    <div><h2>Find my template</h2><p>Rank presets by use case, audience, tone, and stack.</p></div>'
    + '    <button class="btn btn-icon" onclick="closeTemplateChooser()" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>'
    + '  </div>'
    + '  <div class="chooser-grid">'
    + chooserQuestion('what', 'What are you building?', [['landing','Landing page'], ['app','App / dashboard'], ['form','Form / onboarding'], ['content','Docs / content'], ['portfolio','Portfolio'], ['product','Product page'], ['component','Component']])
    + chooserQuestion('audience', 'Who is it for?', [['developers','Developers'], ['business','Business users'], ['public','General public'], ['mobile','Mobile-first consumers']])
    + chooserQuestion('personality', 'Personality?', [['clean','Clean'], ['minimalist','Minimalist'], ['playful','Playful'], ['editorial','Editorial'], ['dark','Dark technical']])
    + chooserQuestion('framework', 'Need framework code?', [['html','HTML'], ['react','React'], ['vue','Vue'], ['svelte','Svelte']])
    + '  </div>'
    + '  <div class="chooser-results" id="chooserResults"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeTemplateChooser(); });
  updateChooserResults();
}

function chooserQuestion(key, label, options) {
  let html = '<div class="chooser-question"><div class="chooser-label">' + escapeHtml(label) + '</div><div class="chooser-options">';
  options.forEach(function(opt) {
    const active = chooserState[key] === opt[0] ? ' active' : '';
    html += '<button class="chooser-chip' + active + '" onclick="setChooserAnswer(\'' + opt[0] + '\',\'' + key + '\')">' + escapeHtml(opt[1]) + '</button>';
  });
  return html + '</div></div>';
}

function setChooserAnswer(value, key) {
  chooserState[key] = value;
  renderTemplateChooser();
  const hash = 'recommend:' + [chooserState.what, chooserState.audience, chooserState.personality, chooserState.framework].join(',');
  history.replaceState(null, '', '#' + hash);
}

function scorePresetRecommendation(element, info) {
  const tags = getPresetTags(element, info).join(' ').toLowerCase();
  const kind = inferPresetKind(element, info);
  const label = ((info && info.label) || element).toLowerCase();
  let score = 0;
  const what = chooserState.what;
  if (what === 'landing' && (/landing|marketing|agency/.test(element + ' ' + tags))) score += 5;
  if (what === 'app' && (/dashboard|shell|table|status|deploy|app/.test(element + ' ' + tags))) score += 5;
  if (what === 'form' && (/form|onboarding/.test(element + ' ' + tags))) score += 5;
  if (what === 'content' && (/docs|blog|editorial|content/.test(element + ' ' + tags))) score += 5;
  if (what === 'portfolio' && (/portfolio|personal|agency/.test(element + ' ' + tags))) score += 5;
  if (what === 'product' && (/product|pricing|showcase|launch/.test(element + ' ' + tags))) score += 5;
  if (what === 'component' && kind === 'component') score += 5;
  if (chooserState.audience === 'developers' && /dev|docs|oss|deploy|technical/.test(element + ' ' + tags)) score += 3;
  if (chooserState.audience === 'business' && /dashboard|table|pricing|status|business|app/.test(element + ' ' + tags)) score += 3;
  if (chooserState.audience === 'public' && /landing|restaurant|event|portfolio|product/.test(element + ' ' + tags + ' ' + label)) score += 3;
  if (chooserState.audience === 'mobile' && /form|landing|product|event/.test(element + ' ' + tags)) score += 2;
  if (info.personalities && info.personalities[chooserState.personality]) score += 2;
  if (chooserState.personality === 'dark' && /dev|docs|status|dashboard|oss/.test(element + ' ' + tags)) score += 2;
  if (chooserState.framework && chooserState.framework !== 'html') {
    const frameworks = getPresetFrameworks(element, info);
    if (frameworks.indexOf(chooserState.framework) !== -1) score += 3;
    else score -= 1;
  }
  return score;
}

function updateChooserResults() {
  const results = document.getElementById('chooserResults');
  if (!results || !manifestData) return;
  const ranked = Object.entries(manifestData.elements).map(function(entry) {
    return { element: entry[0], info: entry[1], score: scorePresetRecommendation(entry[0], entry[1]) };
  }).sort(function(a, b) { return b.score - a.score; }).slice(0, 3);

  results.innerHTML = '<div class="chooser-results-title">Recommended presets</div>' + ranked.map(function(item) {
    const personalities = Object.keys(item.info.personalities || {});
    let personality = personalities.indexOf(chooserState.personality) !== -1 ? chooserState.personality : (personalities.indexOf('clean') !== -1 ? 'clean' : personalities[0]);
    if (personality === 'before' && personalities.length > 1) personality = personalities.find(p => p !== 'before');
    const reason = getBestFor(item.element, item.info);
    return '<div class="chooser-result">'
      + '<div><strong>' + escapeHtml(item.info.label || item.element) + '</strong><span>' + escapeHtml(reason) + '</span></div>'
      + '<button class="btn btn-primary" onclick="chooseRecommendedPreset(\'' + item.element + '\',\'' + personality + '\')">Load</button>'
      + '</div>';
  }).join('');
}

function chooseRecommendedPreset(element, personality) {
  localStorage.setItem('milg-template-chooser-dismissed', 'true');
  closeTemplateChooser();
  loadPreset(element, personality || 'clean');
}

function openAgentPackMenu() {
  closeAgentPackMenu();
  const btn = document.getElementById('agentPackBtn');
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'agentPackMenu';
  menu.className = 'agent-pack-menu';
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
  menu.innerHTML = ''
    + '<button onclick="copyAgentPack(\'prompt\')">Copy Agent Prompt</button>'
    + '<button onclick="copyAgentPack(\'markdown\')">Copy Markdown</button>'
    + '<button onclick="copyCurrentHtml()">Copy HTML</button>'
    + '<button onclick="downloadCurrentHtml()">Download .html</button>'
    + '<button onclick="copyFrameworkPrompt()">Copy Framework Prompt</button>';
  document.body.appendChild(menu);
  setTimeout(function() {
    document.addEventListener('click', closeAgentPackMenu, { once: true });
  }, 0);
}

function closeAgentPackMenu(e) {
  const menu = document.getElementById('agentPackMenu');
  if (!menu) return;
  if (e && (menu.contains(e.target) || e.target === document.getElementById('agentPackBtn'))) return;
  menu.remove();
}

function copyAgentPack(format) {
  const pack = buildAgentPack(format || 'prompt');
  navigator.clipboard.writeText(pack)
    .then(() => showToast((format === 'markdown' ? 'Markdown' : 'Agent prompt') + ' copied'))
    .catch(() => prompt('Copy this Agent Pack:', pack));
  closeAgentPackMenu();
}

function copyCurrentHtml() {
  const html = editor.value || '';
  navigator.clipboard.writeText(html)
    .then(() => showToast('HTML copied'))
    .catch(() => prompt('Copy this HTML:', html));
  closeAgentPackMenu();
}

function downloadCurrentHtml() {
  const element = currentElement || 'custom';
  const personality = currentPersonality || 'html';
  const blob = new Blob([editor.value || ''], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = element + '-' + personality + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('HTML download started');
  closeAgentPackMenu();
}

function copyFrameworkPrompt() {
  const target = chooserState && chooserState.framework && chooserState.framework !== 'html' ? chooserState.framework : 'React';
  const promptText = buildAgentPack('prompt') + '\n\n## Framework conversion\nConvert the preset to ' + target + '. Preserve the rendered structure, responsive behavior, accessible semantics, spacing rhythm, contrast, and visual hierarchy. Keep content editable through ordinary component props or local data objects.';
  navigator.clipboard.writeText(promptText)
    .then(() => showToast('Framework prompt copied'))
    .catch(() => prompt('Copy this framework prompt:', promptText));
  closeAgentPackMenu();
}

function buildAgentPack(format) {
  const element = currentElement || (detachedFrom && detachedFrom.element) || 'custom';
  const personality = currentPersonality || (detachedFrom && detachedFrom.personality) || 'custom';
  const info = manifestData && manifestData.elements[element] ? manifestData.elements[element] : null;
  const variants = info ? Object.keys(info.personalities || {}).filter(p => p !== 'before').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') : 'custom';
  const sourcePath = element !== 'custom' ? 'docs/presets/' + element + '/' + personality + '.html' : 'custom editor HTML';
  const repoBase = 'https://raw.githubusercontent.com/jdeworks/make-it-look-good/dev/';
  const rawUrl = element !== 'custom' ? repoBase + sourcePath : 'n/a';
  const componentFile = inferKnowledgeFile(element);
  const title = format === 'markdown' ? '# Preset Handoff' : '# make-it-look-good Agent Pack';
  const effectName = (visualStyles[currentStyleIndex] && visualStyles[currentStyleIndex].name) || 'None';
  const colorName = currentColorName || getElementPrimary(element, personality) || 'blue';
  const useDescription = chooserState && chooserState.what !== undefined
    ? 'Use case: ' + chooserState.what + ', audience: ' + chooserState.audience + ', personality: ' + chooserState.personality + (chooserState.framework !== 'html' ? ', convert to: ' + chooserState.framework : '')
    : '';
  const knowledge = [
    'layout/visual-hierarchy.md',
    'layout/spacing-system.md',
    'typography/type-scale.md',
    'color/contrast-and-accessibility.md',
    'interaction/touch-targets.md',
    'responsive/mobile-first.md'
  ];
  if (componentFile) knowledge.push(componentFile);
  const knowledgeUrls = knowledge.map(function(k) { return '- ' + repoBase + 'knowledge/' + k; });
  const currentHtml = editor.value || '';
  const lines = [
    title,
    '',
    '## Preset',
    '- Template: **' + (info && info.label ? info.label : element) + '** — ' + personality,
    '- Available variants: ' + variants,
    '- Accent color: ' + colorName + (effectName !== 'None' ? ' + ' + effectName + ' effect' : '') + (darkMode ? ' (dark mode)' : ''),
    useDescription,
    '',
    '## Design knowledge',
    'Read these files from the make-it-look-good repo for design guidance:',
  ].concat(knowledgeUrls).concat([
    '',
    '## Instructions',
    '1. Use the HTML below as your starting point — it has the current color and edits applied.',
    '2. Replace placeholder content with real brand content.',
    '3. Preserve the spacing rhythm, contrast ratios, touch targets, and responsive structure.',
    '4. Match the target project stack (convert classes/structure as needed).',
    '5. Generate Design Review Notes listing issues found and decisions made.',
    '',
    '## Current HTML',
    '```html',
    currentHtml,
    '```'
  ]);
  return lines.join('\n');
}

function inferKnowledgeFile(element) {
  if (/form/.test(element)) return 'components/forms.md';
  if (/button/.test(element)) return 'components/buttons.md';
  if (/card|pricing/.test(element)) return 'components/cards.md';
  if (/table/.test(element)) return 'components/tables.md';
  if (/dropdown|tabs|accordion|pagination/.test(element)) return 'components/navigation.md';
  return null;
}

let comparisonPaneState = {
  left:  { colorName: null, dark: false, effectIndex: 0 },
  right: { colorName: null, dark: false, effectIndex: 0 }
};

async function openComparisonMode() {
  await loadManifest();
  if (!currentElement || !manifestData || !manifestData.elements[currentElement]) {
    showToast('Load a preset before comparing');
    return;
  }
  closeComparisonMode();
  const info = manifestData.elements[currentElement];
  const personality = currentPersonality && currentPersonality !== 'before'
    ? currentPersonality
    : Object.keys(info.personalities || {}).filter(p => p !== 'before')[0] || 'clean';
  const defaultColor = getElementPrimary(currentElement, personality);
  comparisonPaneState = {
    left:  { colorName: defaultColor,     dark: false,    effectIndex: 0               },
    right: { colorName: currentColorName, dark: darkMode, effectIndex: currentStyleIndex }
  };
  const overlay = document.createElement('div');
  overlay.id = 'comparisonOverlay';
  overlay.className = 'comparison-overlay';
  overlay.innerHTML = ''
    + '<div class="comparison-panel" role="dialog" aria-modal="true" aria-label="Compare customizations">'
    + '  <div class="comparison-head">'
    + '    <div><h2>' + escapeHtml(info.label || currentElement) + ' — ' + escapeHtml(personality) + '</h2>'
    + '      <p>Customize each side independently to compare styles</p></div>'
    + '    <button class="btn btn-icon" onclick="closeComparisonMode()" aria-label="Close comparison"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>'
    + '  </div>'
    + '  <div class="comparison-grid">'
    + '    <div class="comparison-pane">'
    + '      <div class="comparison-pane-header">'
    + '        <span class="comparison-pane-label">Default</span>'
    + '        <div class="comparison-pane-controls" id="comparisonLeftControls"></div>'
    + '      </div>'
    + '      <iframe id="comparisonLeft" sandbox="allow-scripts" title="Comparison left"></iframe>'
    + '    </div>'
    + '    <div class="comparison-pane">'
    + '      <div class="comparison-pane-header">'
    + '        <span class="comparison-pane-label">Your style</span>'
    + '        <div class="comparison-pane-controls" id="comparisonRightControls"></div>'
    + '      </div>'
    + '      <iframe id="comparisonRight" sandbox="allow-scripts" title="Comparison right"></iframe>'
    + '    </div>'
    + '  </div>'
    + '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeComparisonMode(); });
  renderComparisonPaneControls('left');
  renderComparisonPaneControls('right');
  await renderComparisonPane('left', personality);
  await renderComparisonPane('right', personality);
}

function closeComparisonMode() {
  const overlay = document.getElementById('comparisonOverlay');
  if (overlay) overlay.remove();
}

function renderComparisonPaneControls(side) {
  const id = side === 'left' ? 'comparisonLeftControls' : 'comparisonRightControls';
  const container = document.getElementById(id);
  if (!container) return;
  const state = comparisonPaneState[side];
  const colors = accentColorNames();
  const swatches = colors.map(function(c) {
    const sw = (tailwindColors[c] || {}).swatch || '#888';
    const active = c === state.colorName ? ' class="comparison-swatch active"' : ' class="comparison-swatch"';
    return '<button' + active + ' style="background:' + sw + '" title="' + c + '" onclick="setComparisonColor(\'' + side + '\',\'' + c + '\')"></button>';
  }).join('');
  const darkActive = state.dark ? ' active' : '';
  const darkBtn = '<button class="comparison-ctrl-btn' + darkActive + '" onclick="toggleComparisonDark(\'' + side + '\')" title="' + (state.dark ? 'Switch to light' : 'Switch to dark') + '">'
    + (state.dark ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/></svg>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>')
    + '</button>';
  const effectOpts = visualStyles.map(function(vs, i) {
    return '<option value="' + i + '"' + (i === state.effectIndex ? ' selected' : '') + '>' + vs.name + '</option>';
  }).join('');
  const effectSel = '<select class="comparison-effect-sel" onchange="setComparisonEffect(\'' + side + '\',this.value)">' + effectOpts + '</select>';
  container.innerHTML = '<div class="comparison-swatches">' + swatches + '</div>' + darkBtn + effectSel;
}

async function renderComparisonPane(side, personality) {
  const iframe = document.getElementById(side === 'left' ? 'comparisonLeft' : 'comparisonRight');
  if (!iframe || !currentElement) return;
  const p = personality || currentPersonality || 'clean';
  const state = comparisonPaneState[side];
  let html = await fetchPreset(currentElement, p);
  if (p !== 'before' && html) {
    const fromPrimary = getElementPrimary(currentElement, p);
    const fromNeutral = presetNeutralMap[currentElement] || 'slate';
    const theme = colorToTheme(state.colorName || fromPrimary);
    html = applyColorTheme(html, fromPrimary, theme.primary, fromNeutral, theme.neutral, theme);
  }
  const effectCSS = (visualStyles[state.effectIndex] || {}).css || '';
  iframe.srcdoc = buildPreviewSrcdoc(html || '', { dark: state.dark, effectCSS: effectCSS });
}

function setComparisonColor(side, colorName) {
  comparisonPaneState[side].colorName = colorName;
  renderComparisonPaneControls(side);
  renderComparisonPane(side);
}

function toggleComparisonDark(side) {
  comparisonPaneState[side].dark = !comparisonPaneState[side].dark;
  renderComparisonPaneControls(side);
  renderComparisonPane(side);
}

function setComparisonEffect(side, value) {
  comparisonPaneState[side].effectIndex = parseInt(value, 10) || 0;
  renderComparisonPane(side);
}

function transformPresetForCurrentContext(html, element, personality) {
  if (!html || personality === 'before') return html || '';
  const fromPrimary = getElementPrimary(element, personality);
  const fromNeutral = presetNeutralMap[element] || 'slate';
  const targetColor = currentColorName || fromPrimary;
  const theme = colorToTheme(targetColor);
  return applyColorTheme(html, fromPrimary, theme.primary, fromNeutral, theme.neutral, theme);
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

  if (hash.startsWith('recommend:')) {
    const parts = hash.slice(10).split(',');
    chooserState = {
      what: parts[0] || 'landing',
      audience: parts[1] || 'developers',
      personality: parts[2] || 'clean',
      framework: parts[3] || 'html'
    };
    setTimeout(openTemplateChooser, 50);
    return;
  }

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

function showTrustDialog(html, hasScripts, opts) {
  opts = opts || {};
  const isPaste = !!opts.paste;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:480px;width:100%;font-family:var(--font);box-shadow:0 20px 60px rgba(0,0,0,0.3);color:var(--text);';

  const iconColor = hasScripts ? '#dc2626' : '#f59e0b';
  const iconBg = hasScripts ? '#fef2f2' : '#fffbeb';
  const source = isPaste ? 'pasted' : 'shared';
  const title = hasScripts
    ? (isPaste ? 'Pasted content contains scripts' : 'Shared content contains scripts')
    : (isPaste ? 'Render pasted content?' : 'Load shared content?');
  const desc = hasScripts
    ? 'This ' + source + ' content includes <code>&lt;script&gt;</code> tags that will execute code in a sandboxed iframe. Only continue if you trust where it came from.'
    : 'This ' + source + ' content contains HTML from an external source. It will be rendered in a sandboxed iframe.';

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
    if (opts.onCancel) { opts.onCancel(); return; }
    // Clear hash so it doesn't re-prompt on reload
    history.replaceState(null, '', window.location.pathname);
  };
  card.querySelector('#trust-load').onclick = function() {
    overlay.remove();
    if (opts.onConfirm) { opts.onConfirm(); return; }
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

// --- Mobile preview toolbar ---
function toggleMobileToolbar() {
  const toggle = document.getElementById('mobileToolbarToggle');
  const content = document.getElementById('mobileToolbarContent');
  const isOpen = content.classList.contains('open');
  content.classList.toggle('open');
  toggle.setAttribute('aria-expanded', !isOpen);
}

// Sync desktop controls into mobile toolbar containers
// We recreate buttons with fresh onclick handlers (cloneNode does NOT copy .onclick)
function syncMobileToolbar() {
  const mobilePers = document.getElementById('mobilePersonalityButtons');
  const mobileTheme = document.getElementById('mobileThemeSwatches');
  const mobileStyle = document.getElementById('mobileStyleButtons');
  if (!mobilePers || !mobileTheme || !mobileStyle) return;

  // Personality buttons — recreate with direct onclick
  const desktopPers = document.getElementById('personalityButtons');
  mobilePers.innerHTML = '';
  if (desktopPers && desktopPers.style.display !== 'none' && currentElement) {
    var personalities = Object.keys(manifestData.elements[currentElement].personalities).filter(function(p) { return p !== 'before'; });
    personalities.forEach(function(pers) {
      var btn = document.createElement('button');
      btn.className = 'pers-btn' + (pers === currentPersonality ? ' active' : '');
      btn.textContent = pers.charAt(0).toUpperCase() + pers.slice(1);
      btn.onclick = function() { loadPreset(currentElement, pers); };
      mobilePers.appendChild(btn);
    });
  }

  // Theme swatches — recreate with direct onclick
  const desktopTheme = document.getElementById('themeSwatches');
  mobileTheme.innerHTML = '';
  if (desktopTheme && desktopTheme.style.display !== 'none') {
    var colorNames = accentColorNames();
    colorNames.forEach(function(name) {
      var btn = document.createElement('button');
      btn.className = 'theme-swatch' + (name === currentColorName ? ' active' : '');
      btn.style.backgroundColor = tailwindColors[name].swatch;
      btn.title = name;
      btn.setAttribute('aria-label', name + ' color theme');
      btn.onclick = function() { selectTheme(name); };
      mobileTheme.appendChild(btn);
    });
  }

  // Style/effect buttons — recreate with direct onclick
  const desktopStyle = document.getElementById('styleButtons');
  mobileStyle.innerHTML = '';
  if (desktopStyle && desktopStyle.style.display !== 'none') {
    var label = document.createElement('span');
    label.style.cssText = 'font-size:9px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.08em;margin-right:2px;';
    label.textContent = 'Effect';
    mobileStyle.appendChild(label);
    visualStyles.forEach(function(style, index) {
      var btn = document.createElement('button');
      btn.className = 'style-btn' + (index === currentStyleIndex ? ' active' : '');
      btn.textContent = style.label;
      btn.title = style.name;
      btn.onclick = function() { selectStyle(index); };
      mobileStyle.appendChild(btn);
    });
  }

  // Show/hide the toolbar toggle based on whether there are any controls
  var hasControls = mobilePers.children.length > 0 || mobileTheme.children.length > 0 || mobileStyle.children.length > 0;
  document.getElementById('mobilePreviewToolbar').classList.toggle('has-controls', hasControls);
}

// --- Analyze Current Preview ---
// Extracts design data from the preview iframe and opens the analyzer with it.
// The extraction script is a module-level constant so updatePreview() can embed it.

const analyzePreviewScript = `
(function() {
  var _pc = document.createElement('canvas');
  _pc.width = 1; _pc.height = 1;
  var _px = _pc.getContext('2d', { willReadFrequently: true });
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
    var m2 = str.match(/rgba?\\((\\d+)\\s+(\\d+)\\s+(\\d+)(?:\\s*\\/\\s*([\\d.]+%?))\\)?/);
    if (m2) { var a = m2[4] !== undefined ? (m2[4].indexOf('%') !== -1 ? parseFloat(m2[4]) / 100 : +m2[4]) : 1; return { r: +m2[1], g: +m2[2], b: +m2[3], a: a }; }
    if (/\\/\\s*0\\s*[\\)%]/.test(str)) return null;
    _px.clearRect(0, 0, 1, 1);
    _px.fillStyle = 'rgba(0,0,0,0)';
    _px.fillStyle = str;
    _px.fillRect(0, 0, 1, 1);
    var d = _px.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return null;
    return { r: d[0], g: d[1], b: d[2], a: Math.round(d[3] / 255 * 100) / 100 };
  }
  function blendOnWhite(c) {
    if (!c) return { r: 255, g: 255, b: 255 };
    var a = c.a;
    return { r: Math.round(c.r * a + 255 * (1 - a)), g: Math.round(c.g * a + 255 * (1 - a)), b: Math.round(c.b * a + 255 * (1 - a)) };
  }
  function getGradientBg(el) {
    var bgi = getComputedStyle(el).backgroundImage;
    if (!bgi || bgi === 'none' || bgi.indexOf('gradient') === -1) return null;
    if (bgi.indexOf('radial') !== -1) { var rs = bgi.match(/(?:rgba?\\([^)]+\\)|#[0-9a-fA-F]{3,8})/g); if (rs && rs.length > 0) { var fc = parseColor(rs[0]); if (fc && fc.a > 0) return fc; } return null; }
    var stops = []; var sr = /(rgba?\\([^)]+\\)|#[0-9a-fA-F]{3,8})\\s*([\\d.]+%)?/g; var m;
    while ((m = sr.exec(bgi)) !== null) { var sc = parseColor(m[1]); if (sc) stops.push({ c: sc, p: m[2] ? parseFloat(m[2]) / 100 : null }); }
    if (stops.length < 2) return null;
    if (stops[0].p === null) stops[0].p = 0;
    if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
    for (var i = 0; i < stops.length - 1; i++) {
      if (stops[i].p <= 0.5 && stops[i + 1].p >= 0.5) {
        var t = (stops[i + 1].p - stops[i].p) > 0 ? (0.5 - stops[i].p) / (stops[i + 1].p - stops[i].p) : 0;
        var a = stops[i].c, b = stops[i + 1].c;
        return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t), a: 1 };
      }
    }
    return stops[0].c;
  }
  function getEffectiveBg(el) {
    var node = el, layers = [];
    while (node && node !== document.documentElement) {
      var bg = getComputedStyle(node).backgroundColor;
      var c = parseColor(bg);
      if (!c || c.a === 0) c = getGradientBg(node);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      node = node.parentElement;
    }
    var result = { r: 255, g: 255, b: 255 };
    for (var i = layers.length - 1; i >= 0; i--) {
      var l = layers[i], a = l.a;
      result = { r: Math.round(l.r * a + result.r * (1 - a)), g: Math.round(l.g * a + result.g * (1 - a)), b: Math.round(l.b * a + result.b * (1 - a)) };
    }
    return result;
  }
  function luminance(c) {
    var rs = c.r / 255, gs = c.g / 255, bs = c.b / 255;
    var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(c1, c2) {
    var l1 = luminance(c1), l2 = luminance(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function rgbStr(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }
  function isVisible(el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function cssSelector(el) {
    if (el.id) return '#' + el.id;
    var tag = el.tagName.toLowerCase();
    var cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return tag + cls;
  }

  var data = {
    meta: { title: document.title || 'Editor Preview', url: 'Editor Preview', viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, timestamp: new Date().toISOString(), version: 1 },
    colors: { textColors: [], bgColors: [], contrastPairs: [] },
    typography: { bodyFontSize: '', bodyLineHeight: '', bodyFontFamily: '', fontFamilies: [], fontSizes: [], fontWeights: [], headings: [], lineHeights: [], maxLineLength: { chars: 0, element: '' } },
    spacing: { paddings: [], margins: [], gaps: [], maxContentWidth: '', bodyPaddingHorizontal: '' },
    interaction: { touchTargets: [], transitions: [] },
    accessibility: { semanticElements: {}, headingHierarchy: [], imagesWithoutAlt: 0, formLabels: { total: 0, withLabel: 0, withoutLabel: 0 }, focusIndicators: [] },
    structure: { totalElements: 0, darkModeClasses: false, responsiveClasses: false, tailwindDetected: false, cssFramework: 'unknown' }
  };

  var allElements = document.body.querySelectorAll('*');
  data.structure.totalElements = allElements.length;
  var htmlStr = document.body.innerHTML;
  if (/class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || /class="[^"]*(?:flex|grid|text-|bg-|p-|m-)/.test(htmlStr)) { data.structure.tailwindDetected = true; data.structure.cssFramework = 'tailwind'; }
  data.structure.darkModeClasses = /class="[^"]*dark:/.test(htmlStr) || document.body.classList.contains('dark-ui') || document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('dark') || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.cssText && r.cssText.indexOf('prefers-color-scheme') !== -1; }); } catch(e) { return false; } });
  data.structure.responsiveClasses = /class="[^"]*(?:sm:|md:|lg:|xl:)/.test(htmlStr) || Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r instanceof CSSMediaRule && /max-width|min-width/.test(r.conditionText || ''); }); } catch(e) { return false; } });

  var bodyStyle = getComputedStyle(document.body);
  data.typography.bodyFontSize = bodyStyle.fontSize;
  data.typography.bodyLineHeight = bodyStyle.lineHeight;
  data.typography.bodyFontFamily = bodyStyle.fontFamily;
  data.spacing.bodyPaddingHorizontal = bodyStyle.paddingLeft;

  var fontSizeMap = {}, fontWeightMap = {}, fontFamilySet = new Set(), lineHeightMap = {};
  var textColorMap = {}, bgColorMap = {}, paddingMap = {}, marginMap = {}, gapMap = {};
  var maxContentW = 0, contrastPairs = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  var node, seen = new Set();
  while (node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    var el = node.parentElement;
    if (!el || !isVisible(el)) continue;
    if (seen.has(el)) continue;
    seen.add(el);
    var style = getComputedStyle(el);
    var fg = parseColor(style.color);
    if (!fg) continue;
    var fgB = blendOnWhite(fg);
    var bg = getEffectiveBg(el);
    var ratio = contrastRatio(fgB, bg);
    var fontSize = parseFloat(style.fontSize);
    var fontWeight = parseInt(style.fontWeight) || 400;
    var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    var threshold = isLarge ? 3 : 4.5;
    if (ratio < 7.5) {
      contrastPairs.push({ fg: rgbStr(fgB), bg: rgbStr(bg), ratio: Math.round(ratio * 100) / 100, needed: threshold, passes: ratio >= threshold, fontSize: Math.round(fontSize), fontWeight: fontWeight, isLarge: isLarge, text: node.textContent.trim().substring(0, 50), selector: cssSelector(el) });
    }
    var charWidth = fontSize * 0.5;
    var charsPerLine = Math.round(el.getBoundingClientRect().width / charWidth);
    if (charsPerLine > data.typography.maxLineLength.chars && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && !el.closest('pre') && !el.closest('code')) {
      data.typography.maxLineLength = { chars: charsPerLine, element: cssSelector(el) };
    }
  }
  contrastPairs.sort(function(a, b) { return a.ratio - b.ratio; });
  data.colors.contrastPairs = contrastPairs.slice(0, 50);

  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') continue;
    if (!isVisible(el)) continue;
    var s = getComputedStyle(el);
    fontSizeMap[s.fontSize] = (fontSizeMap[s.fontSize] || 0) + 1;
    fontWeightMap[s.fontWeight] = (fontWeightMap[s.fontWeight] || 0) + 1;
    fontFamilySet.add(s.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
    var lh = s.lineHeight;
    if (lh !== 'normal') { var lhR = parseFloat(lh) / parseFloat(s.fontSize); lineHeightMap[Math.round(lhR * 100) / 100] = (lineHeightMap[Math.round(lhR * 100) / 100] || 0) + 1; }
    if (s.color) textColorMap[s.color] = (textColorMap[s.color] || 0) + 1;
    var bgColor = s.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') bgColorMap[bgColor] = (bgColorMap[bgColor] || 0) + 1;
    [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].filter(function(v) { return v !== '0px'; }).forEach(function(v) { paddingMap[v] = (paddingMap[v] || 0) + 1; });
    [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].filter(function(v) { return v !== '0px' && v !== 'auto'; }).forEach(function(v) { marginMap[v] = (marginMap[v] || 0) + 1; });
    if (s.gap && s.gap !== 'normal' && s.gap !== '0px') gapMap[s.gap] = (gapMap[s.gap] || 0) + 1;
    var w = el.getBoundingClientRect().width;
    if (w > maxContentW && w < window.innerWidth * 0.95) maxContentW = w;
  }
  function mapToSorted(map) { return Object.keys(map).map(function(k) { return { value: k, count: map[k] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 30); }
  data.typography.fontSizes = mapToSorted(fontSizeMap);
  data.typography.fontWeights = mapToSorted(fontWeightMap);
  data.typography.fontFamilies = Array.from(fontFamilySet).slice(0, 10);
  data.typography.lineHeights = mapToSorted(lineHeightMap);
  data.colors.textColors = mapToSorted(textColorMap);
  data.colors.bgColors = mapToSorted(bgColorMap);
  data.spacing.paddings = mapToSorted(paddingMap);
  data.spacing.margins = mapToSorted(marginMap);
  data.spacing.gaps = mapToSorted(gapMap);
  data.spacing.maxContentWidth = Math.round(maxContentW) + 'px';

  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function(h) {
    var hs = getComputedStyle(h);
    data.typography.headings.push({ tag: h.tagName.toLowerCase(), text: h.textContent.trim().substring(0, 60), fontSize: hs.fontSize, fontWeight: hs.fontWeight, lineHeight: hs.lineHeight, fontFamily: hs.fontFamily.split(',')[0].trim().replace(/['"]/g, '') });
    data.accessibility.headingHierarchy.push(h.tagName.toLowerCase());
  });

  var interactive = document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]');
  var touchIssues = [];
  interactive.forEach(function(el) {
    if (!isVisible(el)) return;
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width), h = Math.round(rect.height);
    if (w < 44 || h < 44) touchIssues.push({ element: el.tagName.toLowerCase(), width: w, height: h, text: (el.textContent || el.getAttribute('aria-label') || '').trim().substring(0, 40), selector: cssSelector(el), passes: false });
  });
  touchIssues.sort(function(a, b) { return (a.width * a.height) - (b.width * b.height); });
  data.interaction.touchTargets = touchIssues.slice(0, 40);
  var transitionSet = new Set();
  for (var i = 0; i < allElements.length && transitionSet.size < 20; i++) { var t = getComputedStyle(allElements[i]).transitionDuration; if (t && t !== '0s') transitionSet.add(t); }
  data.interaction.transitions = Array.from(transitionSet);
  data.accessibility.semanticElements = { header: document.querySelectorAll('header').length, nav: document.querySelectorAll('nav').length, main: document.querySelectorAll('main').length, footer: document.querySelectorAll('footer').length, section: document.querySelectorAll('section').length, article: document.querySelectorAll('article').length, aside: document.querySelectorAll('aside').length };
  var noAlt = 0; document.querySelectorAll('img').forEach(function(img) { if (!img.hasAttribute('alt')) noAlt++; }); data.accessibility.imagesWithoutAlt = noAlt;
  var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea');
  var labeled = 0;
  inputs.forEach(function(inp) { data.accessibility.formLabels.total++; if ((inp.id && document.querySelector('label[for="' + inp.id + '"]')) || inp.closest('label') || inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby')) labeled++; });
  data.accessibility.formLabels.withLabel = labeled;
  data.accessibility.formLabels.withoutLabel = data.accessibility.formLabels.total - labeled;
  Array.from(interactive).slice(0, 10).forEach(function(el) { if (!isVisible(el)) return; var s = getComputedStyle(el); data.accessibility.focusIndicators.push({ element: cssSelector(el), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset }); });
  data.accessibility.hasFocusVisibleCSS = Array.from(document.styleSheets).some(function(ss) { try { return Array.from(ss.cssRules).some(function(r) { return r.selectorText && r.selectorText.indexOf('focus-visible') !== -1; }); } catch(e) { return false; } });

  parent.postMessage({ type: 'milg-analyzer-preview', data: data }, '*');
})();
`;

function analyzeCurrentPreview() {
  const btn = document.getElementById('analyzePreviewBtn');
  btn.classList.add('active');

  try {
    // Get HTML from the editor (same content rendered in preview)
    var html = editor.value;
    if (!html || html.trim().length < 10) { btn.classList.remove('active'); alert('No content to analyze. Add some HTML first.'); return; }

    // Store HTML + current rendering context in localStorage. Use localStorage (not
    // sessionStorage) because the analyzer opens in a NEW tab: Chrome clones
    // sessionStorage to window.open'd tabs but Firefox/Safari don't, so sessionStorage
    // silently arrives empty there. localStorage is shared across same-origin tabs.
    localStorage.setItem('milg-preview-html', html);
    // Pass dark mode and effect CSS so the analyzer renders the same way the preview does
    localStorage.setItem('milg-preview-context', JSON.stringify({
      dark: darkMode,
      effectCSS: visualStyles[currentStyleIndex] ? visualStyles[currentStyleIndex].css : '',
      effectName: visualStyles[currentStyleIndex] ? visualStyles[currentStyleIndex].name : 'None'
    }));
    window.open('analyzer.html#analyze-html', '_blank');
    btn.classList.remove('active');
  } catch(e) {
    btn.classList.remove('active');
    alert('Could not analyze: ' + e.message);
  }
}

// --- Contrast checker removed ---
// The full Design Analyzer (analyzer.html) now handles contrast checking
// with gradient support, APCA, filter math, CVD simulation, and more.
// Use the "Analyze preview" button (lightbulb icon) instead.

// --- Init ---
function startApp() {
  applyDarkMode();
  initMonaco();
  initMobile();
  loadFromHash().then(function() {
    // Check after a short delay to ensure Monaco has settled
    setTimeout(function() { autoLoadTemplate(); }, 300);
    setTimeout(function() {
      if (!window.location.hash && localStorage.getItem('milg-template-chooser-dismissed') !== 'true') {
        openTemplateChooser();
      }
    }, 650);
  });
}

// Auto-load a template if the editor is empty (no hash preset, first visit)
async function autoLoadTemplate() {
  var val = editor.value;
  if (val && val.trim().length > 0) return; // Already has content

  console.log('[milg] Editor empty, auto-loading template...');
  try {
    var manifest = await loadManifest();
    if (!manifest || !manifest.elements) {
      console.warn('[milg] No manifest — empty preview');
      updatePreview();
      return;
    }
    var elements = Object.keys(manifest.elements);
    // Pick a random template from preferred list (shuffle first)
    var preferred = ['landing', 'dashboard', 'cards', 'form', 'project', 'pricing', 'portfolio'];
    var available = preferred.filter(function(p) { return elements.indexOf(p) !== -1; });
    if (available.length === 0) available = elements;
    var pick = available[Math.floor(Math.random() * available.length)];
    var pers = manifest.elements[pick].personalities || {};
    var persNames = Array.isArray(pers) ? pers : Object.keys(pers);
    var personality = persNames.indexOf('clean') !== -1 ? 'clean' : (persNames[0] || 'clean');

    console.log('[milg] Loading:', pick + '/' + personality);

    // Fetch the HTML directly as a fallback that always works
    var html = await fetchPreset(pick, personality);
    if (html && html.length > 10) {
      editor.value = html;
      currentElement = pick;
      currentPersonality = personality;
      currentPresetName = pick;
      originalPresetHtml = html;
      userEdited = false;
      updateTemplateName();
      try { renderPersonalityButtons(pick, personality); } catch(e) {}
      try { renderThemeSwatches(pick, personality); } catch(e) {}
      try { renderStyleButtons(pick); } catch(e) {}
      try { syncMobileToolbar(); } catch(e) {}
      updatePreview();
      console.log('[milg] Template loaded:', pick + '/' + personality, html.length, 'chars');
    } else {
      console.warn('[milg] Fetch returned empty for', pick + '/' + personality);
      updatePreview();
    }
  } catch(e) {
    console.warn('[milg] Auto-load failed:', e);
    updatePreview();
  }
}

// Monaco loads async via require() — wait for it, with timeout fallback
var _appStarted = false;
function safeStartApp() {
  if (_appStarted) return;
  _appStarted = true;
  startApp();
}
if (window._monacoReady) {
  safeStartApp();
} else {
  window.addEventListener('monaco-ready', safeStartApp);
  // Fallback: start without Monaco after 5s (mobile/slow connections)
	  setTimeout(function() {
	    if (!_appStarted) {
	      console.warn('Monaco editor did not load — starting without code editor');
	      ensureFallbackEditor('Monaco is unavailable, likely because cdnjs was blocked or slow. Editing still works here.');
	      safeStartApp();
	    }
	  }, 5000);
}
