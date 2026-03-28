# CORS Proxy Worker

A lightweight Cloudflare Worker that proxies HTTP requests with CORS headers, used by the Design Analyzer's URL input mode.

## Why

Browsers block cross-origin requests (CORS). To fetch and analyze external websites from a client-side app, we need a proxy that adds `Access-Control-Allow-Origin: *` headers.

## Deploy your own

1. [Sign up for Cloudflare](https://dash.cloudflare.com/sign-up) (free, no credit card)
2. Install Wrangler: `npm install -g wrangler`
3. Login: `wrangler login`
4. Deploy:
   ```bash
   cd proxy
   npx wrangler deploy
   ```
5. Copy the `*.workers.dev` URL from the output
6. Update `CORS_PROXY_URL` in `docs/analyzer.js` with your URL

## Free tier limits

- **100,000 requests/day** (resets at midnight UTC)
- 10ms CPU time per request
- Hard stop when exceeded (returns 5XX until reset)
- $5/month paid plan gives 10M requests/month if you outgrow free tier

## Safety features

- Only GET requests allowed
- Only http/https URLs (no file://, ftp://, etc.)
- SSRF protection: blocks localhost, private IPs, .local domains
- 10 MB max response size
- Custom User-Agent for transparency

## Configuration

Edit `worker.js` to customize:

- `ALLOWED_ORIGINS` — restrict to your domain (default: `'*'`)
- `MAX_RESPONSE_SIZE` — max proxied response (default: 10 MB)
- `USER_AGENT` — the User-Agent sent to target servers
