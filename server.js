#!/usr/bin/env node
// make-it-look-good — Local analyzer dev server
// Serves the static analyzer UI from docs/ AND provides a permissive CORS proxy
// that (unlike the production Cloudflare worker) CAN reach localhost / private IPs.
// Node built-ins only (http, fs, path, url) — no npm dependencies. Requires Node 18+.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// --- Config ---
function parsePort() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--port');
  if (i !== -1 && args[i + 1]) {
    const p = parseInt(args[i + 1], 10);
    if (!Number.isNaN(p)) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(p)) return p;
  }
  return 8765;
}

const PORT = parsePort();

// Bind to loopback by default: the /proxy endpoint is intentionally
// unrestricted (it can reach localhost/private IPs), so it must not be
// exposed to a shared network unless explicitly opted in via --host/HOST.
function parseHost() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--host');
  if (i !== -1 && args[i + 1]) return args[i + 1];
  if (process.env.HOST) return process.env.HOST;
  return '127.0.0.1';
}

const HOST = parseHost();
const DOCS_ROOT = path.join(__dirname, 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// The local proxy base the analyzer should use. The analyzer appends '?url=' itself
// (see docs/analyzer-proxy.js buildProxyList), so this is the bare base.
const LOCAL_PROXY_URL = `http://localhost:${PORT}/proxy`;
const LOCAL_PROXY_B64 = Buffer.from(LOCAL_PROXY_URL).toString('base64');

// --- In-memory transform of analyzer.js so it points at THIS server's proxy ---
// Matches the specific assignment: var _pe = '<base64>';
const PE_RE = /var _pe = '[^']*';/;
function transformAnalyzerJs(src) {
  return src.replace(PE_RE, `var _pe = '${LOCAL_PROXY_B64}';`);
}

// --- CORS proxy: server-side fetch any URL (including localhost) ---
async function handleProxy(req, res, reqUrl) {
  const target = reqUrl.searchParams.get('url');
  if (!target) {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Missing ?url= parameter');
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Invalid url');
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.writeHead(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Only http/https targets are allowed');
    return;
  }

  try {
    const upstream = await fetch(target, { redirect: 'follow' });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    const ct = upstream.headers.get('content-type');
    headers['Content-Type'] = ct || 'application/octet-stream';
    res.writeHead(upstream.status, headers);
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('Proxy fetch failed: ' + (e && e.message ? e.message : 'unknown error'));
  }
}

// --- Static file serving with path-traversal protection ---
function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  if (rel === '/' || rel === '') rel = '/index.html';

  // Normalize and join, then verify the resolved path stays within DOCS_ROOT.
  const resolved = path.resolve(DOCS_ROOT, '.' + path.posix.normalize('/' + rel));
  const rootWithSep = DOCS_ROOT.endsWith(path.sep) ? DOCS_ROOT : DOCS_ROOT + path.sep;
  if (resolved !== DOCS_ROOT && !resolved.startsWith(rootWithSep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    // Special-case analyzer.js: transform in-memory to repoint the proxy.
    if (path.basename(resolved) === 'analyzer.js') {
      fs.readFile(resolved, 'utf8', (rErr, data) => {
        if (rErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Read error');
          return;
        }
        const out = transformAnalyzerJs(data);
        res.writeHead(200, {
          'Content-Type': contentType(resolved),
          'Cache-Control': 'no-store',
        });
        res.end(out);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(resolved) });
    fs.createReadStream(resolved).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let reqUrl;
  try {
    reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  // Preflight for the proxy endpoint.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    });
    res.end();
    return;
  }

  if (reqUrl.pathname === '/proxy') {
    handleProxy(req, res, reqUrl);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  serveStatic(req, res, reqUrl.pathname);
});

server.listen(PORT, HOST, () => {
  console.log('make-it-look-good — local analyzer server (bound to ' + HOST + ')');
  console.log('  Analyzer:      http://localhost:' + PORT + '/analyzer.html');
  console.log('  Live preview:  http://localhost:' + PORT + '/index.html');
  console.log('  Proxy:         http://localhost:' + PORT + '/proxy?url=<target>');
  console.log('  Note: any http://localhost:* page can be entered as a target URL — the local proxy reaches localhost/private IPs.');
});
