# CORS Proxy Worker

A lightweight Cloudflare Worker that proxies HTTP requests with CORS headers, used by the Design Analyzer's URL input mode.

## Why

Browsers block cross-origin requests (CORS). To fetch and analyze external websites from a client-side app, we need a proxy that adds `Access-Control-Allow-Origin` headers. This self-hosted worker replaces dependency on third-party CORS proxies.

## Full setup (from scratch)

### 1. Deploy the Worker to Cloudflare

1. [Sign up for Cloudflare](https://dash.cloudflare.com/sign-up) (free, no credit card)
2. Install Wrangler (Cloudflare's deploy CLI):
   ```bash
   npm install -g wrangler
   ```
3. Login to Cloudflare:
   ```bash
   wrangler login
   ```
4. Deploy the worker:
   ```bash
   cd proxy
   npx wrangler deploy
   ```
5. Copy the `*.workers.dev` URL from the output — that's your proxy URL

### 2. Connect it to the Analyzer

1. Copy `.env.example` to `.env` at the repo root:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and set your worker URL:
   ```
   PROXY_URL=https://milg-cors-proxy.YOUR-SUB.workers.dev
   ```
3. Run the inject script:
   ```bash
   ./scripts/inject-proxy.sh
   ```
4. Commit and push:
   ```bash
   git add docs/analyzer.js
   git commit -m "Inject proxy URL"
   git push
   ```

GitHub Pages will serve the updated `docs/analyzer.js` with your proxy baked in.

### 3. If you need to change the URL

Edit `.env`, run `./scripts/inject-proxy.sh` again, commit and push.

### 4. If you want to remove the proxy

Delete `.env` (or clear `PROXY_URL`), run `./scripts/inject-proxy.sh` — it resets to the placeholder, falling back to third-party proxies.

## Setting up on a different computer

1. Clone the repo
2. Create `.env` with your `PROXY_URL=...` (the `.env` file is gitignored)
3. Run `./scripts/inject-proxy.sh`
4. That's it — the deployed `docs/analyzer.js` already has the URL from your last push

You only need to re-run the inject script if you want to change the URL or deploy from a fresh clone.

## Free tier limits

| | Free | Paid ($5/month) |
|---|---|---|
| Requests | 100K/day | 10M/month |
| CPU time | 10ms/request | 30ms/request |
| When exceeded | **Hard stop** (5XX until midnight UTC) | $0.30/million overage |

100K/day handles ~5,500 daily users doing 3 analyses each. For context, each analysis uses ~4-6 proxied requests (1 HTML page + 3-5 CSS files).

## Safety features

| Feature | What it does |
|---------|-------------|
| **Origin checking** | Only browsers on `jdeworks.github.io` can use the proxy (unforgeable by browsers) |
| **Rate limiting** | 30 requests/minute per IP address |
| **SSRF protection** | Blocks localhost, private IPs, `.local` domains |
| **Method restriction** | GET only, http/https only |
| **Size limit** | 10 MB max response |

## Configuration

Edit `proxy/worker.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `['https://jdeworks.github.io']` | Allowed Origin domains. Set to `null` for any (dev only). |
| `RATE_LIMIT` | `30` | Max requests per IP per minute |
| `MAX_RESPONSE_SIZE` | `10 MB` | Max proxied response body |
| `USER_AGENT` | `MilgAnalyzer/1.0` | User-Agent sent to target servers |

After changing, redeploy: `cd proxy && npx wrangler deploy`

## How the URL stays (mostly) hidden

```
.env (local, gitignored)
  └── PROXY_URL=https://your-worker.workers.dev

./scripts/inject-proxy.sh
  └── base64-encodes URL → patches docs/analyzer.js

docs/analyzer.js (committed)
  └── var _pe = 'aHR0cHM6Ly8uLi4=';  (not a recognizable URL pattern)

Browser (runtime)
  └── atob() decodes → fetches from your worker
```

The encoded URL is in the committed JS (unavoidable for a static site). But:
- The raw URL is never in git (`.env` is gitignored)
- The encoded string doesn't match URL patterns (stops automated scrapers)
- Origin checking + rate limiting in the worker caps abuse even if found
- Anyone with DevTools Network tab can see the decoded URL on requests (that's fine — can't prevent it)
