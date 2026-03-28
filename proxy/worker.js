// make-it-look-good — CORS Proxy Worker
// Deploy: cd proxy && npx wrangler deploy
// Free tier: 100K requests/day on Cloudflare Workers

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_SCHEMES = ['http:', 'https:'];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Rate limit: requests per IP per minute
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

// Allowed origins — browsers cannot spoof Origin headers, so this reliably blocks hotlinking.
// Add 'http://localhost:3000' etc. for local dev if needed.
// Set to null to allow any origin (development only).
const ALLOWED_ORIGINS = ['https://jdeworks.github.io'];

// In-memory rate limiting (per-isolate, resets on cold start — good enough for abuse prevention)
const rateCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = Math.floor(now / RATE_WINDOW_MS);
  const key = ip + ':' + bucket;

  // Clean old entries periodically
  if (rateCounts.size > 10000) {
    for (const [k, v] of rateCounts) {
      if (v.bucket < bucket) rateCounts.delete(k);
    }
  }

  const entry = rateCounts.get(key);
  if (!entry) {
    rateCounts.set(key, { bucket, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS === null ? '*' : (origin || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

function errorResponse(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Only GET allowed
    if (request.method !== 'GET') {
      return errorResponse(405, 'Only GET requests are allowed', origin);
    }

    // Origin check — blocks other websites from using this proxy via their browsers
    if (ALLOWED_ORIGINS !== null) {
      if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        return errorResponse(403, 'Origin not allowed', origin);
      }
    }

    // Rate limit per IP
    if (!checkRateLimit(ip)) {
      return errorResponse(429, 'Rate limited — max ' + RATE_LIMIT + ' requests per minute', origin);
    }

    // Parse target URL from query parameter
    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');

    if (!target) {
      return errorResponse(400, 'Missing ?url= parameter', origin);
    }

    // Validate URL scheme
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return errorResponse(400, 'Invalid URL: ' + target, origin);
    }

    if (!ALLOWED_SCHEMES.includes(targetUrl.protocol)) {
      return errorResponse(400, 'Only http/https URLs are allowed', origin);
    }

    // Block private/local IPs to prevent SSRF
    const hostname = targetUrl.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)
    ) {
      return errorResponse(403, 'Private/local URLs are not allowed', origin);
    }

    // Fetch the target
    try {
      const resp = await fetch(targetUrl.href, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,text/css,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      if (!resp.ok) {
        return errorResponse(resp.status, 'Target returned ' + resp.status + ' ' + resp.statusText, origin);
      }

      // Read body and check size
      const body = await resp.arrayBuffer();

      if (body.byteLength > MAX_RESPONSE_SIZE) {
        return errorResponse(413, 'Response too large (' + Math.round(body.byteLength / 1024 / 1024) + ' MB, max ' + (MAX_RESPONSE_SIZE / 1024 / 1024) + ' MB)', origin);
      }

      // Return with CORS headers
      const responseHeaders = new Headers(corsHeaders(origin));
      responseHeaders.set('Content-Type', resp.headers.get('Content-Type') || 'text/html; charset=utf-8');

      // Pass through cache headers if present
      const cacheControl = resp.headers.get('Cache-Control');
      if (cacheControl) responseHeaders.set('Cache-Control', cacheControl);

      return new Response(body, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (err) {
      return errorResponse(502, 'Failed to fetch target: ' + (err.message || 'unknown error'), origin);
    }
  },
};
