# Edge Case Test: CLI/Terminal Output to Web Dashboard

## Initial Request

**User:** "Here's my deploy script output. Can you make a web dashboard for this?"

```
$ deploy-manager status
┌─────────────────────────────────────────────────────────┐
│ DEPLOYMENT STATUS - production                          │
├──────────────┬──────────┬─────────┬──────────┬─────────┤
│ Service      │ Version  │ Status  │ CPU      │ Memory  │
├──────────────┼──────────┼─────────┼──────────┼─────────┤
│ web-frontend │ v2.14.3  │ RUNNING │ 23%      │ 412MB   │
│ api-server   │ v2.14.1  │ RUNNING │ 67%      │ 1.2GB   │
│ worker       │ v2.14.3  │ RUNNING │ 45%      │ 890MB   │
│ scheduler    │ v2.13.0  │ STALE   │ 12%      │ 256MB   │
│ ml-pipeline  │ v1.8.2   │ STOPPED │ 0%       │ 0MB     │
└──────────────┴──────────┴─────────┴──────────┴─────────┘

Last deploy: 2026-03-17 09:42:13 UTC by sarah@acme.com
Next scheduled: 2026-03-18 02:00:00 UTC (maintenance window)
Alerts: scheduler version behind (v2.13.0 < v2.14.3)
```

---

## Step 0 — Classify

**Input type:** Plain text / terminal output (ASCII table with box-drawing characters, metadata footer, no code, no wireframe, no design spec).

**Result:** Step 1D (Structure) — the input contains structured data that needs to be parsed and transformed into a UI. Not vague (Step 1C) because the data shape is concrete. Not existing code (Step 1A/1B) because there is no HTML/CSS/JS.

---

## Step 1D — Structure Analysis

### 1. Data Shape

- **Primary data:** Tabular — 5 service rows with 5 columns (Service, Version, Status, CPU, Memory)
- **Secondary data:** Metadata footer with 3 key-value pairs (last deploy, next scheduled, alerts)
- **Implicit data:** Aggregate stats derivable from the table (total services: 5, running: 3, stale: 1, stopped: 1)
- **Status enum:** RUNNING, STALE, STOPPED — a finite set that maps to semantic colors

### 2. Use Case

Deployment monitoring dashboard for an engineering team. The CLI tool already exists; the user wants a visual equivalent. This is an **internal tool** — not customer-facing, not marketing. Priority is information density and scannability over visual polish.

### 3. Component Pattern Mapping

| CLI Element | UI Component | Rationale |
|---|---|---|
| Table header "DEPLOYMENT STATUS - production" | Page header with environment badge | Environment context is critical — must be visible at all times |
| Table rows | Data table on dark surface | Engineers expect tabular data; don't break the mental model |
| Status column (RUNNING/STALE/STOPPED) | Icon + text + color badge | Color alone fails color-blind users; icon adds a second channel |
| CPU column (percentages) | Horizontal bar + percentage label | Bars make relative comparison instant; numbers give precision |
| Memory column | Formatted text value | No bar needed — memory values aren't relative to a known max |
| Footer metadata | Metadata row below table or stat cards | Secondary info, don't compete with the table |
| "Alerts" line | Alert banner at top of page | Alerts demand attention — position above all content |
| Aggregate counts | Stat cards row | Quick glance at overall health before diving into the table |

### 4. Potential Actions

For a static snapshot (per user's request):
- View service details (visual only, no interactivity required)
- Scan for problems (alert banner + status colors handle this)

Future interactive version could add: trigger redeploy, acknowledge alerts, filter by status, sort columns.

---

## Guided Follow-Up Questions

**LLM asks:** "Is this for your engineering team (internal) or public-facing?"
**User:** "Internal engineering team"

> **Impact:** Internal = higher information density is acceptable. No need for onboarding/explanation. Can use technical jargon (CPU, MB/GB). Dark theme is appropriate — matches terminal aesthetic engineers are used to.

**LLM asks:** "Want it to be a real-time dashboard or static snapshot?"
**User:** "Static for now, just make it look good"

> **Impact:** No WebSocket/polling needed. No loading states. No skeleton screens. Focus purely on visual design and data presentation. Single HTML file is fine.

---

## Step 2 — Knowledge Files Consulted

| File | Why |
|---|---|
| `color/color-psychology.md` | Dark theme palette selection; status color semantics (green=healthy, amber=warning, red=error) |
| `color/accessibility.md` | Contrast ratios for light text on dark backgrounds; color-blind safe status indicators |
| `typography/type-scale.md` | Monospace font for technical values (versions, memory); scale for stat card numbers |
| `typography/readability.md` | Line height and spacing for table rows; monospace readability on dark backgrounds |
| `layout/visual-hierarchy.md` | Alert banner > stat cards > table ordering; visual weight distribution |
| `layout/spacing-system.md` | Consistent 4px-base spacing for the dark surface cards and table cells |
| `components/buttons.md` | Focus states on interactive elements (even for static, buttons may exist for future use) |
| `responsive/mobile-first.md` | Stat cards stack on mobile; table scrolls horizontally |

---

## Design Review Notes

### Theme: Dark Technical Vibe

**Rationale:** Deploy dashboards are engineering tools. Engineers spend hours in terminals and dark-themed IDEs. A dark UI:
1. Matches the mental context of the CLI tool being replaced
2. Reduces eye strain during extended monitoring sessions
3. Makes color-coded status indicators pop (green/amber/red on dark > on white)
4. Signals "this is an internal power tool" not "this is a marketing page"

**Background hierarchy:**
- Page background: `slate-950` (#020617) — deepest layer
- Card/table surface: `slate-900` (#0f172a) — elevated surface
- Table header row: `slate-800/50` — subtle differentiation
- Hover row: `slate-800/30` — interaction feedback

### Color Palette Decisions

| Role | Color | Tailwind Class | Contrast on slate-900 | Rationale |
|---|---|---|---|---|
| Primary text | `#f1f5f9` | `slate-100` | 14.5:1 (AAA) | High-contrast light text for primary content |
| Secondary text | `#94a3b8` | `slate-400` | 6.4:1 (AA) | Labels, metadata, column headers |
| Status: RUNNING | `#22c55e` | `green-500` | 5.1:1 (AA) | Healthy/active — universally understood |
| Status: STALE | `#f59e0b` | `amber-500` | 5.8:1 (AA) | Warning — needs attention but not broken |
| Status: STOPPED | `#ef4444` | `red-500` | 4.6:1 (AA large) | Error/down — immediate concern |
| Alert banner bg | `#78350f` | `amber-900` | n/a (container) | Dark amber surface for warning banner |
| Alert banner text | `#fef3c7` | `amber-100` | 12.1:1 on amber-900 | High contrast within alert |
| Version badge bg | `slate-800` | `slate-800` | n/a (container) | Subtle pill background for version numbers |
| CPU bar fill | `#3b82f6` | `blue-500` | n/a (decorative) | Neutral metric color — not good/bad, just data |

**Color-blind safety:** Every status uses icon + text + color (three channels). RUNNING gets a checkmark icon, STALE gets a warning triangle, STOPPED gets an X-circle. Even in grayscale, the icons differentiate states. The amber vs red distinction (deuteranopia concern) is mitigated by the icon shapes.

### Typography Decisions

| Element | Font | Size | Weight | Rationale |
|---|---|---|---|---|
| Page title ("Deploy Manager") | Inter | 1.5rem (24px) | 700 | Clean, authoritative header |
| Environment badge | JetBrains Mono | 0.75rem (12px) | 500 | Monospace reinforces "this is a system value" |
| Stat card label | Inter | 0.75rem (12px) | 600, uppercase | Small, non-competing label |
| Stat card value | Inter | 1.875rem (30px) | 700 | Large for quick scanning |
| Table header | Inter | 0.75rem (12px) | 600, uppercase | Standard table convention |
| Service name | JetBrains Mono | 0.875rem (14px) | 500 | Monospace = "this is a system identifier" |
| Version number | JetBrains Mono | 0.75rem (12px) | 400 | Monospace in a pill badge |
| Status text | Inter | 0.75rem (12px) | 600 | Paired with icon; slightly bold for emphasis |
| CPU percentage | JetBrains Mono | 0.875rem (14px) | 500 | Monospace for numeric alignment |
| Memory value | JetBrains Mono | 0.875rem (14px) | 500 | Monospace for technical values |
| Metadata footer | Inter | 0.875rem (14px) | 400 | Secondary information, normal weight |

**Key decision:** JetBrains Mono for all "system-generated" values (service names, versions, CPU, memory). Inter for all "human" text (labels, headers, descriptions). This creates a clear visual distinction between data and chrome.

### Layout Decisions

- **Alert banner:** Full width at top, above stat cards. Uses amber background with warning icon. Position signals urgency — it's the first thing you see.
- **Stat cards:** 4-column grid on desktop, 2x2 on tablet, stacked on mobile. Cards: Total Services (5), Running (3), Last Deploy (timestamp), Next Scheduled (timestamp).
- **Services table:** Full width below stat cards. Dark surface (`slate-900`) with subtle row borders (`slate-800`). Horizontal scroll on mobile with `-webkit-overflow-scrolling: touch`.
- **Metadata footer:** Below table, muted text. Includes deployer identity and schedule info.
- **Container max-width:** `max-w-7xl` (80rem / 1280px) — dashboard needs horizontal space for the table.
- **Padding:** `p-6` on desktop, `p-4` on mobile.

### Component Decisions

- **Rounded corners:** `rounded-xl` (12px) on cards and table container. Slightly less round than the cafe site — this is a tool, not a consumer product. Still warmer than sharp corners.
- **Borders:** `border border-slate-800` on cards — subtle separation without heavy shadows. On dark backgrounds, borders work better than shadows for surface elevation.
- **CPU bars:** Horizontal bar with `blue-500` fill on `slate-700` track. Height 8px, rounded-full. Percentage label sits to the right of the bar in monospace.
- **Status badges:** Pill-shaped (`rounded-full`) with tinted background (e.g., `green-500/10` for RUNNING). Icon + text inside. The tinted background is subtle on dark — just enough to create a "zone" for the status.
- **Version badges:** `slate-800` background pill with monospace text. No semantic color — version numbers are informational, not status.

### Spacing Decisions

- **Base unit:** 4px (Tailwind default)
- **Stat card padding:** `p-5` (20px) — enough breathing room without wasting space
- **Table cell padding:** `px-5 py-4` (20px horizontal, 16px vertical) — comfortable row height for scanning
- **Gap between stat cards:** `gap-4` (16px)
- **Gap between sections (alert > cards > table):** `space-y-6` (24px)
- **Alert banner padding:** `px-4 py-3` (16px/12px) — compact but readable

### Mobile-First Considerations

1. **Stat cards:** 1 column on mobile (`grid-cols-1`), 2 on `sm:` (640px+), 4 on `lg:` (1024px+)
2. **Table:** Horizontally scrollable container. No column hiding — all data is important for an engineering dashboard. Minimum column widths prevent text wrapping.
3. **Alert banner:** Text wraps naturally. Icon stays at the start.
4. **Header:** Title and badge stack if needed; no hamburger menu (single-page dashboard).
5. **Font sizes:** No text below 12px. Monospace can be harder to read small, so minimum 12px for JetBrains Mono.

### Accessibility Decisions

1. **Status indicators use three channels:** Color + icon + text. Satisfies WCAG 1.4.1 (Use of Color).
2. **All text passes WCAG AA** on its background (see contrast table above).
3. **Focus states:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400` on any interactive element. Visible focus ring that works on dark backgrounds.
4. **Semantic HTML:** `<table>` for tabular data (not div grid). Proper `<thead>`, `<tbody>`, `<th scope="col">`.
5. **Alert banner:** Uses `role="alert"` for screen reader announcement.
6. **CPU bars:** `aria-label` with percentage value so screen readers get the number, not just a decorative bar.

---

## Expected Output

A single self-contained HTML file (`edge-cli-output.html`) that:
- Uses dark theme (`slate-950` background) appropriate for engineering audience
- Renders the CLI table data as a proper data table with status indicators
- Shows an alert banner for the scheduler version warning
- Includes stat cards for quick health overview
- Uses JetBrains Mono for technical values, Inter for UI chrome
- All status indicators are color-blind safe (icon + text + color)
- Passes WCAG AA contrast on all text
- Responsive from 375px mobile to 1440px+ desktop
- Uses only Tailwind CSS CDN + Google Fonts (no other dependencies)
- Focus states on all interactive elements
