// CodeMirror 6 initialization module
// All imports go through esm.sh which deduplicates shared dependencies
// (same @codemirror/state@^6.0.0 resolves to one instance across all packages)

import { EditorView, basicSetup, EditorState } from 'https://esm.sh/codemirror@6.0.1';
import { html } from 'https://esm.sh/@codemirror/lang-html@6.4.9';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6.1.2';

window._cmModules = { EditorView, EditorState, basicSetup, html, oneDark };
window.dispatchEvent(new Event('cm-ready'));
