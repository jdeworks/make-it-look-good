# E2E Test: Raw JSON Data → Status Page UI

> Generated from [make-it-look-good](https://github.com/jdeworks/make-it-look-good) knowledge base

## Overview
- **What:** Public-facing system status page built from raw API JSON data
- **Stack:** No existing code — user provides only JSON data
- **Input type:** Raw JSON data → Step 1D (Structure)
- **Date:** 2026-03-17

## Conversation Flow

### User Input

```
"Here's my API response. I need to display this to users."

{
  "server_status": {
    "overall": "healthy",
    "uptime": "99.97%",
    "response_time_ms": 142,
    "active_connections": 1847
  },
  "services": [
    { "name": "API Gateway", "status": "operational", "latency": 45, "region": "us-east-1" },
    { "name": "Database Primary", "status": "operational", "latency": 12, "region": "us-east-1" },
    { "name": "Cache Layer", "status": "degraded", "latency": 89, "region": "us-west-2" },
    { "name": "Search Index", "status": "operational", "latency": 34, "region": "eu-west-1" },
    { "name": "File Storage", "status": "maintenance", "latency": null, "region": "us-east-1" },
    { "name": "Email Service", "status": "operational", "latency": 156, "region": "eu-west-1" }
  ],
  "incidents": [
    { "id": "INC-2847", "title": "Cache Layer Elevated Latency", "severity": "warning", "started": "2026-03-17T13:22:00Z", "status": "investigating" },
    { "id": "INC-2846", "title": "File Storage Scheduled Maintenance", "severity": "info", "started": "2026-03-17T10:00:00Z", "status": "in_progress" }
  ]
}
```

### Step 0 — Classify

- Plain text / JSON data → **Step 1D (Structure)**
- No existing code, no framework, no design — just raw API data

### Step 1D — Structure the Data

1. **Data shape:** Nested object with aggregate metrics (`server_status`) + list of services (6 items) + list of incidents (2 items)
2. **Use case:** Status page for end users / customers — public-facing
3. **Component pattern:**
   - Stat cards (uptime, response time, active connections) — aggregate metrics at a glance
   - Service list (status table/list) — each service with name, status badge, latency, region
   - Incident timeline — active incidents with severity, timestamps, progress
   - Overall status banner — single "all good" / "partial degradation" indicator
4. **Actions:** View only, subscribe to updates (email)

### LLM Clarifying Question

> "This looks like a system status page. Should this be public-facing (like status.stripe.com) or internal (ops team only)?"

**User:** "Public-facing status page for our customers"

This answer drives several decisions:
- **Tone:** Corporate, trustworthy, calm — not playful or data-dense
- **Information density:** Show what matters to customers, not ops details
- **Latency values:** Show but don't emphasize — customers care about status, not milliseconds
- **Region tags:** Include for transparency but keep subtle
- **Subscribe CTA:** Essential for public status pages

### Step 2 — Knowledge File Selection

| File | Why |
|------|-----|
| `components/tables-and-lists.md` | Service list rendering — row height, alignment, responsive |
| `components/cards.md` | Stat card pattern — layout, hierarchy, sizing |
| `layout/spacing-system.md` | Consistent spacing scale for page structure |
| `color/color-blind-safety.md` | Status indicators MUST use icon+text+color (not color alone) |
| `interaction/feedback.md` | Status badge patterns, severity indicators |
| `layout/visual-hierarchy.md` | Overall page structure, what to emphasize first |
| `workflows/quick-reference.md` | Fast lookup for contrast ratios, spacing values, font sizes |

### Step 3 — Generate Output

Output: `e2e-status-page.html` — self-contained HTML with Tailwind CSS CDN

**Stack decision:** User has no existing code. Tailwind CDN is the fastest path to a polished, responsive page with no build step.

---

## Design Review Notes

### Design Decisions

#### Color Palette
- Background: `#f8fafc` (slate-50) — light, clean, professional
- Cards/sections: `#ffffff` with subtle border `#e2e8f0` (slate-200)
- Text: `#0f172a` (slate-900) primary, `#64748b` (slate-500) secondary
- Status colors (all meet 4.5:1 on white):
  - Operational: `#16a34a` (green-600) — checkmark icon + "Operational" text + green badge
  - Degraded: `#d97706` (amber-600) — warning triangle icon + "Degraded" text + amber badge
  - Maintenance: `#2563eb` (blue-600) — wrench icon + "Maintenance" text + blue badge
  - Outage: `#dc2626` (red-600) — x-circle icon + "Outage" text + red badge
- Overall status banner: green bg when all operational, amber bg when any degraded/maintenance

#### Typography
- Font: Inter / system-ui — professional, highly legible
- Base: 16px (public-facing, not data-dense)
- Page title: 24px semibold
- Stat values: 32px bold
- Stat labels: 13px uppercase tracking-wide slate-500
- Service names: 16px medium
- Incident titles: 16px semibold
- Timestamps/metadata: 14px slate-500
- Line height: 1.5

#### Spacing System
- Base unit: 4px
- Page max-width: 960px centered (status pages are narrow, content-focused)
- Section spacing: 32px between major blocks
- Card padding: 24px
- Service row height: 56px (comfortable click/scan target)
- Stat cards gap: 16px (3 across on desktop, stack on mobile)
- Incident card padding: 20px

#### Layout Structure
1. **Header** — Company name + "System Status" + overall status banner
2. **Stat cards** — 3 across: Uptime, Response Time, Active Connections
3. **Services list** — Each service as a row with status badge, name, latency, region
4. **Active incidents** — Timeline-style cards with severity stripe
5. **Subscribe section** — Email input + Subscribe button
6. **Footer** — Branding + last updated timestamp

#### Status Indicator Pattern (Color-Blind Safety)
Every status uses a **triple redundancy** approach:
- **Icon:** Checkmark (operational), Warning triangle (degraded), Wrench (maintenance), X-circle (outage)
- **Text label:** Always shown alongside icon — never icon-only
- **Color:** Green/amber/blue/red background tint on badge
- Reference: `color/color-blind-safety.md` — "never use color as the sole indicator"

#### Responsive Behavior
- **Desktop (≥768px):** 3 stat cards in a row, service rows with all columns
- **Mobile (<768px):** Stat cards stack vertically, service rows simplify (latency/region wrap below name)
- Max-width container keeps content readable on ultrawide screens

### Component Mapping (JSON → UI)

| JSON Field | UI Component | Notes |
|------------|-------------|-------|
| `server_status.overall` | Overall status banner | Maps "healthy" → green banner; if any service degraded/maintenance → amber |
| `server_status.uptime` | Stat card #1 | Large value "99.97%" with "Uptime" label |
| `server_status.response_time_ms` | Stat card #2 | "142ms" with "Response Time" label |
| `server_status.active_connections` | Stat card #3 | "1,847" (formatted) with "Active Connections" label |
| `services[].name` | Service row — primary text | Left-aligned, medium weight |
| `services[].status` | Service row — status badge | Icon + text + color badge |
| `services[].latency` | Service row — secondary metric | "45ms" or "—" if null |
| `services[].region` | Service row — tag | Subtle pill: "us-east-1" |
| `incidents[].title` | Incident card — heading | Semibold, with severity color stripe on left |
| `incidents[].severity` | Incident card — severity indicator | "warning" → amber, "info" → blue |
| `incidents[].started` | Incident card — timestamp | Relative or formatted time |
| `incidents[].status` | Incident card — status label | "investigating", "in_progress" as badge |

### Accessibility Checklist
- [x] All text meets 4.5:1 contrast ratio on backgrounds
- [x] Status indicators use icon + text + color (triple redundancy)
- [x] Touch targets ≥ 44px for interactive elements (subscribe button, email input)
- [x] Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`
- [x] Input has associated label (or aria-label)
- [x] Responsive from 320px to ultrawide
- [x] Subscribe button has clear affordance (filled, high contrast)

### Knowledge Files Referenced
- `components/tables-and-lists.md` — Service list row height (48-56px), alignment patterns
- `components/cards.md` — Stat card layout, padding (20-24px), value hierarchy
- `layout/spacing-system.md` — 4px base unit, consistent scale
- `color/color-blind-safety.md` — Triple redundancy for status (icon+text+color)
- `interaction/feedback.md` — Status badge patterns, severity color mapping
- `layout/visual-hierarchy.md` — Banner → stats → list → incidents priority order
- `workflows/quick-reference.md` — 4.5:1 contrast, 44px touch targets, 16px base font
