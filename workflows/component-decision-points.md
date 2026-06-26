# Component Decision Points

> **TL;DR:** Before generating any interactive component, read its section below. Ask the user the open questions, or pick the preset default and state the assumption explicitly in your Design Review Notes. Undisclosed defaults are invisible design decisions — naming them makes the design reviewable.

Every component listed here has a corresponding preset at `docs/presets/<id>/clean.html`. The defaults described below are read directly from that HTML — not assumed. If you customize away from a preset default, say so in the Design Review Notes.

**How to use this file.** For each component you build, read its section. If you are working quickly, default to all italicized preset values, then add a "Component assumptions" block to your Design Review Notes listing each assumption. This takes 2 minutes and saves a review cycle.

## Quick Navigator

| Component | Element ID | Primary decision | Preset default |
|-----------|-----------|-----------------|----------------|
| Accordion | `accordion` | One-open vs. multi-open | Ships both |
| Data Table | `data-table` | Mobile strategy | Stack to cards < 640px |
| Dropdown | `dropdown` | Action menu vs. value-select | Action menu |
| Form | `form` | Validation timing; single vs. multi-step | On submit; single step |
| Tabs | `tabs` | URL sync vs. local state | Local state only |
| Pagination | `pagination` | Numbered vs. load-more | Numbered with ellipsis |
| Shell Sidebar | `shell-sidebar` | Mobile: overlay vs. push | Overlay with backdrop |
| Shell Dashboard | `shell-dashboard` | Stat count; trend deltas | 4 stats with deltas |
| Shell Form | `shell-form` | Login vs. signup; social auth | Login, no social auth |
| Shell Marketing | `shell-marketing` | Sticky nav; CTA in nav | Sticky; CTA in both nav + hero |
| Hero | `hero` | CTA buttons vs. email capture | Two CTA buttons |
| Stats Row | `stats-row` | Trend deltas; stat count | Deltas on all 4 stats |
| Avatars | `avatars` | Overflow threshold; status dots | 4 visible + "+N"; status dots |

## Accordion

An accordion collapses multiple content sections behind trigger buttons, trading immediate visibility for vertical space. Decide the open-behavior before building — it affects the ARIA pattern.

- Allow only one section open at a time (FAQ style), or allow multiple sections open simultaneously? *(preset ships both: a single-open group labeled "General" and a multi-open group labeled "Account & Billing")*
- Start with the first item pre-expanded, or all items collapsed? *(preset: first item of the single-open group starts expanded; multi-open group starts fully collapsed)*
- Animate panel height with a CSS transition, or show/hide instantly? *(preset: 200ms grid-rows transition; includes `motion-reduce:transition-none`)*
- Use a rotating chevron icon for open/closed state, or a +/− icon swap? *(preset: rotating chevron — 0° closed, 180° open)*
- Group items under a section label, or no grouping labels at all? *(preset: uppercase tracking-wider section labels — "General", "Account & Billing")*
- **Common mistake:** Building single-open behavior when the content works better multi-open (e.g., settings panels where users adjust multiple fields simultaneously).
- **Use accordion when:** content is too long to show at once and users will read one section then stop. Use Tabs instead when users switch between sections repeatedly.

## Data Table

A data table displays structured, comparable rows of information. The mobile strategy is the most impactful decision — specify it before writing any markup.

- Make all columns sortable by clicking their header, or display-only? *(preset: all 5 columns have sort buttons with up/down arrow icons)*
- Show all rows at once, or paginate / load-more when row count exceeds a threshold? *(preset: all rows shown, no pagination)*
- Add row checkboxes for bulk selection, or no selection? *(preset: no row selection)*
- Sticky column headers while scrolling vertically, or non-sticky? *(preset: non-sticky)*
- On mobile (< 640px): stack each row into a labeled card, or allow horizontal scroll? *(preset: stacks to cards — `<thead>` hidden, each row becomes a block with label/value pairs via `data-label`)*
- Per-row actions as inline buttons, as a "..." context menu, or none? *(preset: no per-row actions)*
- Right-align numeric / currency columns? *(preset: Amount column uses `text-right tabular-nums`; text columns are left-aligned)*
- **Common mistake:** Leaving all columns sortable when only 1–2 columns are actually useful to sort by — sortable headers add visual noise on every column.

## Dropdown

A dropdown can serve two very different roles: an action menu (command dispatcher) or a value select (option picker). These have different ARIA roles, keyboard behaviors, and close-on-select logic.

- Action menu (contextual commands like Edit / Archive / Delete), or value-select (pick one option)? *(preset: action menu — `role="menu"` with Edit, Duplicate, Archive, Share, Favorite, Delete grouped by separator)*
- Single-select, or multi-select with checkboxes? *(preset: single action, no multi-select)*
- Searchable / filterable list inside the dropdown, or flat list only? *(preset: flat list only)*
- Close automatically on item selection, or stay open for multi-select? *(preset: action menus close on item selection; value-selects may stay open — specify)*
- Load options asynchronously on open, or all options in markup at load time? *(preset: all options in markup)*
- Trigger on click only, or also on hover? *(preset: click-only — hover triggers are hostile on touch devices)*
- **Common mistake:** Using `role="menu"` (action menu) for a value-select scenario — these require different ARIA patterns and keyboard behaviors.

## Form

The two most impactful decisions are validation timing and step count. Inline-on-blur validation reduces error rates; more than 7 fields per step increases abandonment.

- Validate each field on blur (when user leaves the field), or only on final submit? *(preset: HTML5 `required` constraint only — no JS inline validation shown; add blur-based validation for production)*
- Mark optional fields with "(optional)" text, or mark required fields with an asterisk? *(preset: optional fields labeled "(optional)" — e.g., Company field; required fields are unmarked)*
- Single-step form, or multi-step wizard with a step indicator? *(preset: single step — 5 fields)*
- On successful submit: inline success state, toast notification, or redirect? *(preset: no success state shown — choose based on context and reversibility)*
- Include social OAuth buttons (Google, GitHub), or credentials only? *(preset: email + password only)*
- Password field: show/hide toggle, or always masked? *(preset: always masked — add a show/hide toggle for production login forms)*
- **Common mistake:** Disabling the submit button before the user has attempted to submit — this is confusing because users don't know why it is disabled. Show inline errors on submit instead.

## Tabs

Tabs segment content into panels behind a persistent tab bar. URL sync is the key structural decision — it determines whether panel state survives reload and can be shared as a link.

- Sync the active tab to the URL hash, or local UI state only? *(preset: local state only — add hash routing for content that should be deep-linkable or bookmarkable)*
- Lazy-render each panel on first activation, or render all panels in the DOM upfront (hidden)? *(preset: all panels rendered at load; inactive ones hidden with `class="hidden" aria-hidden="true"`)*
- On mobile: let the tab bar overflow-scroll horizontally, or collapse to a `<select>` dropdown? *(preset: horizontal overflow scroll with `overflow-x-auto whitespace-nowrap`)*
- Which tab is active by default? *(preset: first tab — "Overview")*
- Arrow-key navigation between tabs (WAI-ARIA tablist pattern)? *(preset: yes — Left/Right/Home/End keys cycle tabs)*
- **Common mistake:** Building tabs where the correct component is an accordion — Tabs are for switching between alternative views, not for reading through sequential content sections.
- **Use tabs when:** users need to switch between views repeatedly. Use Accordion when reading one section and stopping is the typical pattern.

## Pagination

Pagination is a navigation pattern with consequences for user orientation and back-button behavior. The choice between numbered, load-more, and infinite scroll depends on task type — browsing vs. finding a specific item.

- Numbered page buttons, load-more button, or infinite scroll? *(preset: numbered — shows pages 1–5, ellipsis, and last page number)*
- Show a total results count ("Showing 1–20 of 342"), or omit it? *(preset: no results count in the pagination bar — add when users need to gauge dataset size)*
- Include a per-page size selector (10 / 25 / 50 rows), or fixed page size? *(preset: no page-size control)*
- On mobile: show the full numbered bar, or condense to "Page N of M" text? *(preset: "Page 1 of 10" text indicator below `sm`; numbered buttons at `sm` and above)*
- Always show the last page button, or only when far from the last page? *(preset: last page number always shown as a button)*
- **Common mistake:** Using infinite scroll for task-oriented lists (e.g., admin tables) — infinite scroll works for browsing, not for finding a specific row.

## Shell Sidebar

A sidebar shell is a full-page layout — the sidebar behavior on mobile is as important as the desktop experience. A full-width fixed sidebar on a 375px phone blocks all content.

- Fixed full-width sidebar on desktop, or collapsible to an icon-only rail? *(preset: fixed 240px sidebar, no icon-only collapse — always visible at lg+)*
- On mobile: overlay the sidebar over content with a backdrop, or push content to the right? *(preset: overlay — `bg-slate-900/50` backdrop, hamburger button in topbar)*
- Flat navigation list, or support nested / grouped secondary sections? *(preset: flat — no nested items, no group headers)*
- Active item style: filled pill background, or left border accent? *(preset: filled pill — `bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`)*
- Sidebar footer area (settings link, user profile), or no footer? *(preset: footer row with a Settings link at the bottom)*
- **Common mistake:** Not implementing mobile behavior at all — `lg:hidden` on the sidebar makes it disappear on mobile without providing any alternative navigation.

## Shell Dashboard

A dashboard shell is a composed layout — sidebar, topbar, stat cards, and table. The stat card count and density drive the entire visual weight of the screen.

- How many stat cards across the top row? *(preset: 4 — Revenue, Customers, Orders, Conversion; grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)*
- Show period-over-period trend deltas on each stat, or plain current values only? *(preset: trend deltas on all 4 cards — green badge for positive, red for negative, "vs last month" label)*
- Include a data table below the stats, or a cards-only layout? *(preset: includes a full sortable data table below the stat row)*
- Comfortable row density or compact? *(preset: comfortable — `p-5` on stat cards, `py-4` table cells)*
- Topbar right side: notification bell, search bar, or user-profile avatar? *(preset: placeholder profile avatar button on the right of the topbar)*
- **Common mistake:** Showing more than 5–7 stat cards — Miller's Law applies; users cannot track more than 7 metrics at a glance.

## Shell Form

A centered form shell is a minimal layout: branded header, single card, centered on a neutral background. The form purpose drives the field set and CTA labels.

- Login (sign in to existing account), signup (create new account), or another purpose (password reset, invite accept)? *(preset: login — "Welcome back / Sign in to your account")*
- Include social OAuth buttons (Google, GitHub), or credentials only? *(preset: credentials only — email + password)*
- Include "Remember me" checkbox or "Forgot password?" link? *(preset: neither shown — always add "Forgot password?" for a production login)*
- Single centered card, or two-column with a feature / brand illustration panel on the left? *(preset: single centered card, `max-w-md`)*
- Show a "Sign up" / "Sign in" cross-link for users who land on the wrong form? *(preset: yes — "Don't have an account? Sign up" link below the card)*
- Submit button loading state: spinner, disabled text, or immediate redirect? *(preset: no loading state — add a spinner for any form with a server round-trip longer than 300ms)*
- **Common mistake:** Omitting "Forgot password?" on a login form — this is the single most requested feature in post-launch feedback.

## Shell Marketing

A marketing shell frames landing content. Sticky navigation and CTA placement are the two decisions with the largest effect on conversion rates.

- Sticky header on scroll, or static (scrolls away with content)? *(preset: sticky — `sticky top-0 z-40` with `backdrop-blur-md`)*
- CTA in the navigation bar, in the hero only, or in both? *(preset: CTA in both — "Get Started" in desktop nav and "Get Started Free" in the hero)*
- Footer: minimal (brand + copyright), or multi-column with organized link sections? *(preset: multi-column footer — `grid-cols-2 md:grid-cols-4` with Product / Company / Developers / Legal)*
- Mobile navigation: hamburger opening a full-screen drawer overlay, or in-page expandable menu below the header bar? *(preset: in-page expandable accordion below the header)*
- How many navigation links? *(preset: 4 — Features, Pricing, About, Blog; cap at 5–7 per Hick's Law)*
- **Common mistake:** Putting more than one primary CTA in the hero — a primary and a ghost/secondary is fine, but two equally-weighted buttons reduce click-through on both.

## Hero

A hero sets user expectations in the first second. Visual treatment and CTA style should match product tone and primary conversion goal.

- CTA buttons only, email-capture input inline, or a search input? *(preset: two CTA buttons — primary "Get started free" + ghost "See how it works"; no email capture)*
- Visual: background image with overlay, gradient, or clean white/dark surface? *(preset: clean — no image or gradient, white light / `dark:bg-slate-900`)*
- Layout: centered text and CTAs, or split (copy left, visual right)? *(preset: centered — `text-center max-w-3xl mx-auto`)*
- Include above-the-fold social proof (logo strip, user count, star rating), or none? *(preset: none — add real social proof when available; avoid placeholder logos)*
- Badge / eyebrow label above the headline ("New: feature →"), or plain headline? *(preset: plain headline — add a badge when announcing something specific)*
- Above the fold on a 768px tablet: does the hero still look intentional, or is it a clipped desktop layout? *(preset: fully responsive — `text-4xl sm:text-5xl lg:text-6xl` headline scales to every breakpoint)*
- **Common mistake:** Using an email-capture input as the primary CTA for a product that requires a full signup flow — this creates a dead end when the user discovers they still need to register.

## Stats Row

A stats row surfaces key metrics. Trend deltas dramatically increase information density but require real data — placeholder deltas ("↑ 12.5%") with no real backing undermine trust.

- Show period-over-period trend deltas (arrow badge + percentage), or current value only? *(preset: trend deltas on all 4 cards — green badge for positive, red for negative, "vs last month" context)*
- How many stats? *(preset: 4 — Total Revenue, Active Users, Bounce Rate, Conversion Rate)*
- Make stat cards linkable (clicking goes to a detail view), or static display only? *(preset: static — no links)*
- Include a sparkline or mini bar chart inside each card, or numbers + delta badge only? *(preset: numbers + delta badge only; no embedded chart)*
- Use standalone or embedded inside `shell-dashboard`? *(preset exists as both: standalone `stats-row/` and embedded in `shell-dashboard/`)*
- Grid layout on mobile: single-column stack or 2×2 grid? *(preset: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — single column at xs, 2×2 at sm, 4-across at lg)*
- **Common mistake:** Showing "↑ 0%" or blank deltas when real data is not yet available — use plain numbers without deltas until trend data exists.

## Avatars

An avatar group represents a team or collaborator list. The overflow threshold and status indicators are the main product decisions; size is a pure visual decision.

- How many avatars visible before collapsing to a "+N more" chip? *(preset: 4 visible avatars + "+3" chip; overlap uses `-space-x-3` at lg, `-space-x-2` at md and sm)*
- Show a presence / status dot per avatar (online / offline / busy), or plain avatars? *(preset: status dot on every avatar — `bg-green-500` online, `bg-slate-300` offline)*
- Reveal the person's name on hover via `title` attribute (native tooltip) or a custom popover? *(preset: `title` attribute — native browser tooltip)*
- Support photo images with an initials fallback, or initials-only colored circles? *(preset: initials-only — colored background + 2-letter initials; no `<img>` elements)*
- Size: lg (w-12 / 48px), md (w-9 / 36px), or sm (w-7 / 28px)? *(preset demos all three; pick one for production use)*
- Are the avatars interactive (clicking opens a profile card), or a static visual only? *(preset: static — no click handlers; add `button` wrapper and keyboard support if interactive)*
- **Common mistake:** Using initials-only in a context where users need to identify individuals at a glance — consider real photos or at minimum a color-coded initial system with consistent assignment.

---

## Decision Tree

Unsure which option to pick? Use the preset default and state it in the Design Review Notes. Example: "Tabs use local state — add URL hash routing if panels should be bookmarkable." A named assumption is reviewable. A silent assumption is a bug.

**Component vs. component tradeoffs:**
- Accordion vs. Tabs: Tabs for repeatedly-switched views; Accordion for read-once-and-stop content.
- Data Table vs. Card Grid: Table when users compare column values; Card Grid when they browse individual items.
- Numbered Pagination vs. Load-More: Numbered when users need to jump to a specific page; Load-More when sequential reading is natural and all results are roughly equivalent.
- Dropdown (action menu) vs. Inline buttons: Inline buttons when there are 1–3 actions; dropdown when 4+ actions would clutter the row.
- Shell Sidebar vs. Shell Marketing: Sidebar for authenticated app experiences; Marketing for public-facing landing pages.

**Framework variants.** All presets in the Related Presets section have `clean.html`, `minimalist.html`, and `playful.html` personality variants. Interactive components (accordion, tabs, dropdown, form, pagination, data-table, shell-sidebar, shell-dashboard, shell-form, shell-marketing, avatars) also have React, Vue, and/or Svelte variants — see [`docs/presets/FRAMEWORKS.md`](../docs/presets/FRAMEWORKS.md) and the `frameworks` key in [`docs/presets/index.json`](../docs/presets/index.json).

**Composing multiple components.** Several presets embed more than one component: `shell-dashboard` nests `stats-row` and `data-table`; `shell-sidebar` hosts any content area. When composing, resolve each nested component's decision points independently — the outer shell's choices do not automatically apply to inner components.

## Sources

- [WAI-ARIA Authoring Practices — Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- [WAI-ARIA Authoring Practices — Tab Panel](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WAI-ARIA Authoring Practices — Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- Baymard Institute. [Form Usability](https://baymard.com/research) — step count, validation timing, label placement
- WCAG 2.2. [SC 2.5.8 — Target Size (Minimum)](https://www.w3.org/TR/WCAG22/#target-size-minimum) — 44×44px minimum
- Nielsen Norman Group. [Pagination vs. Infinite Scroll](https://www.nngroup.com/articles/infinite-scrolling-tips/)

## Related Presets

- [`accordion/`](../docs/presets/accordion/) — Single-open + multi-open groups, animated height, reduced-motion safe
- [`data-table/`](../docs/presets/data-table/) — Sortable, responsive, stack-to-cards below 640px
- [`dropdown/`](../docs/presets/dropdown/) — Action menu with keyboard navigation, outside-click, and Escape close
- [`form/`](../docs/presets/form/) — Signup form with (optional) field pattern and HTML5 validation
- [`tabs/`](../docs/presets/tabs/) — Local-state tabs with full keyboard navigation (arrow keys)
- [`pagination/`](../docs/presets/pagination/) — Numbered pages with ellipsis and mobile "Page N of M" fallback
- [`shell-sidebar/`](../docs/presets/shell-sidebar/) — Sidebar shell with mobile overlay drawer
- [`shell-dashboard/`](../docs/presets/shell-dashboard/) — Dashboard shell with 4-stat row + sortable data table
- [`shell-form/`](../docs/presets/shell-form/) — Centered login shell
- [`shell-marketing/`](../docs/presets/shell-marketing/) — Marketing page with sticky nav and multi-column footer
- [`hero/`](../docs/presets/hero/) — Centered CTA hero
- [`stats-row/`](../docs/presets/stats-row/) — 4-stat row with trend delta badges
- [`avatars/`](../docs/presets/avatars/) — Overlapping avatar group with status dots and initials
