# CORS Proxy Worker

A lightweight Cloudflare Worker that proxies HTTP requests with CORS headers, used by the Design Analyzer's URL input mode.

## Why

Browsers block cross-origin requests (CORS). To fetch and analyze external websites from a client-side app, we need a proxy that adds `Access-Control-Allow-Origin: *` headers. This self-hosted worker replaces dependency on third-party CORS proxies.

## Deploy your own

### 1. Deploy the Worker

1. [Sign up for Cloudflare](https://dash.cloudflare.com/sign-up) (free, no credit card)
2. Install Wrangler (Cloudflare's CLI): `npm install -g wrangler`
3. Login: `wrangler login`
4. Deploy:
   ```bash
   cd proxy
   npx wrangler deploy
   ```
5. Copy the `*.workers.dev` URL from the output (e.g. `https://milg-cors-proxy.your-sub.workers.dev`)
6. **Set `ALLOWED_ORIGINS`** in `worker.js` to your GitHub Pages domain:
   ```js
   const ALLOWED_ORIGINS = ['https://yourusername.github.io'];
   ```
   Then redeploy: `npx wrangler deploy`

### 2. Connect to the Analyzer (via GitHub Actions)

The proxy URL is **not hardcoded in the repo** — it's injected at deploy time via a GitHub repository secret.

1. Base64-encode your worker URL:
   ```bash
   echo -n "https://milg-cors-proxy.your-sub.workers.dev" | base64
   ```
2. Go to your repo's **Settings > Secrets and variables > Actions**
3. Add a new secret named `PROXY_URL` with the base64 value
4. Go to **Settings > Pages** and change **Build and deployment** source to **GitHub Actions**
5. Push to the `dev` branch — the workflow at `.github/workflows/deploy-pages.yml` will inject the URL and deploy

If the `PROXY_URL` secret is not set, the analyzer gracefully falls back to third-party proxies (allorigins, codetabs, corsproxy.io).

## Free tier limits

- **100,000 requests/day** (resets at midnight UTC)
- 10ms CPU time per request
- **Hard stop** when exceeded (returns 5XX until reset — no surprise bills)
- $5/month paid plan gives 10M requests/month if you outgrow free tier

## Safety features

- **Origin checking** — only browsers on your domain can use the proxy (unforgeable by browsers)
- **Per-IP rate limiting** — 30 requests/minute per IP address
- **SSRF protection** — blocks localhost, private IPs, .local domains
- Only GET requests, only http/https URLs
- 10 MB max response size
- Custom User-Agent for transparency

## Configuration

Edit `worker.js` to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `null` (any) | Array of allowed Origin domains, or `null` for any |
| `RATE_LIMIT` | `30` | Max requests per IP per minute |
| `MAX_RESPONSE_SIZE` | `10 MB` | Max proxied response body |
| `USER_AGENT` | `MilgAnalyzer/1.0` | User-Agent sent to target servers |

## How the URL stays out of git

```
Git repo (public)
  └── docs/analyzer.js contains: __PROXY_ENCODED__ (placeholder)

GitHub Actions (on push to dev)
  └── Reads PROXY_URL secret, replaces placeholder, deploys to Pages

Deployed site (public, but URL is base64-encoded in JS)
  └── Runtime: atob() decodes → fetch to your worker
```

The URL is visible in the browser's Network tab (unavoidable for any client-side app), but:
- Not in the git history (scrapers/bots can't find it by searching the repo)
- Not as a plain string in the deployed JS (stops automated URL pattern matching)
- Rate-limited and origin-locked in the worker itself (caps abuse even if found)
