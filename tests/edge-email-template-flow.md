# Edge Case: HTML Email Template Flow

> **TL;DR:** HTML email is a fundamentally different medium from web pages. Email clients have wildly inconsistent rendering engines (Outlook uses Word's HTML renderer). This flow documents designing a welcome email for "Streamline" using table-based layout, inline styles, and email-specific accessibility techniques.

## User Request

**User:** "I need a welcome email template for new users signing up to our app"

## Step 0 — Classify the Request

**Classification:** Vague idea (has a goal but no specifics) -> Step 1C

## Step 1 — Clarifying Questions

**Q1: What type of deliverable?**
Email template (special case — different rules than web). This is NOT a web page. Email clients strip most modern CSS, ignore JavaScript entirely, and many (Outlook 2007-2021) render HTML using Microsoft Word's engine.

**Q2: Who is the audience?**
General public — new users who just signed up. Mix of email clients: Gmail (web + mobile), Apple Mail, Outlook (desktop + web), Yahoo Mail, various Android clients. Must work everywhere.

**Q3: What visual tone?**
Clean and minimal. Welcome emails should feel warm but professional. No heavy graphics that trigger spam filters.

**Q4: What technology/medium?**
HTML email with table-based layout required for email client compatibility. No CSS Grid. No Flexbox (partially supported but unreliable). No JavaScript. Inline styles mandatory.

**Q5: What content sections are needed?**
- Logo area (text-based for reliability)
- Welcome heading with personalization ({{name}})
- 3-step onboarding guide
- Primary CTA button ("Get Started")
- Secondary help link
- Footer with company address (CAN-SPAM compliance) and unsubscribe link

**Q6: Brand constraints?**
- Brand color: blue (#2563eb)
- Company name: "Streamline"
- Tone: professional, friendly, concise

## CRITICAL: Email-Specific Constraints

These constraints do NOT apply to web pages but are mandatory for email:

### Layout
- **Must use TABLE-based layout** — no CSS Grid, no Flexbox in many email clients (Outlook, older Gmail)
- **Max width 600px** — standard for email readability across devices; wider emails get clipped or require horizontal scrolling
- **Inline styles required** — Gmail, Outlook.com, and many clients strip `<style>` blocks entirely; every visual property must be on the element
- **No JavaScript** — all email clients strip `<script>` tags; zero interactivity beyond links

### Typography
- **System fonts only** — `@font-face` and Google Fonts are partially supported (Apple Mail, iOS Mail, some Android) but fail silently elsewhere; use Arial/Helvetica/sans-serif as the stack
- **Explicit font sizing on every text element** — inheritance is unreliable across email clients
- **Line-height as a multiplier or px** — percentage-based line-height breaks in some Outlook versions

### Images
- **Images need absolute URLs** — relative paths don't resolve in email; use full `https://` URLs (placeholders during development)
- **Always include alt text and dimensions** — many users have images blocked by default; alt text IS the first impression
- **Use transparent PNGs for dark mode compatibility** — JPEGs with white backgrounds look broken in dark mode

### Buttons / CTAs
- **CTA buttons must use the VML/table-cell technique** — Outlook strips padding and background-color from `<a>` tags; a styled link will appear as plain blue underlined text in Outlook
- **MSO conditional comments** — `<!--[if mso]>` blocks provide Outlook-specific table-based button rendering
- **Minimum touch target: 44x44px** — same as web, but even more critical since many emails are read on mobile

### Dark Mode
- **Add `color-scheme: light dark` meta tag** — tells Apple Mail and Outlook.com that the email supports dark mode
- **Use `prefers-color-scheme` media query in `<style>`** — for clients that support embedded styles AND dark mode (Apple Mail, some Outlook versions)
- **Transparent PNGs over JPEGs** — logos on white JPG backgrounds look broken in dark mode
- **Avoid pure white (#ffffff) text on dark backgrounds** — use #f0f0f0 to reduce eye strain

### Compliance & Deliverability
- **Include preheader text** — hidden text that appears in inbox preview; if omitted, email clients pull the first visible text (often "View in browser" or garbage)
- **CAN-SPAM requires physical mailing address** — must be in footer
- **Unsubscribe link required** — both CAN-SPAM (US) and GDPR (EU) mandate easy unsubscribe
- **Include plain text alternative** — note in HTML that a plain text version should be generated; improves deliverability and accessibility
- **Keep HTML under 102KB** — Gmail clips emails larger than this

### Accessibility
- **Use `role="presentation"` on layout tables** — screen readers should not announce table structure for layout-only tables
- **Semantic elements where possible** — `<h1>`, `<p>`, `<a>` are well-supported in email
- **lang attribute on `<html>`** — screen readers need this for correct pronunciation
- **Sufficient contrast ratios still apply** — 4.5:1 for body text, 3:1 for large text, same as web

## Step 2 — Knowledge Files Referenced

| File | What was used |
|------|--------------|
| [typography/readability.md](../typography/readability.md) | Font sizing (16px body, 24px headings), line-height (1.5-1.6), system font stacks |
| [color/contrast-and-accessibility.md](../color/contrast-and-accessibility.md) | Contrast ratios: #333 on white = 12.6:1 (passes AAA), #2563eb on white = 4.6:1 (passes AA), white on #2563eb = 4.6:1 (passes AA for large text/buttons) |
| [components/buttons.md](../components/buttons.md) | Button sizing (min 44px height for touch), padding ratios, contrast requirements — adapted for email's table-cell button technique |
| [layout/spacing-system.md](../layout/spacing-system.md) | 8px spacing scale (8, 16, 24, 32, 40) used for padding and margins throughout the email |

## Design Review Notes

### Decisions Made

1. **Text logo instead of image logo** — Images are blocked by default in many corporate email clients. A styled text logo (`<h1>` with brand color) ensures the brand is always visible. If a real logo is needed later, include it as an image WITH descriptive alt text that still communicates the brand.

2. **Single-column layout** — Email is consumed on mobile 60%+ of the time. A single column at 600px max-width is responsive by default — it simply shrinks. Multi-column layouts require nested tables and media queries that many clients ignore.

3. **Vertical step layout instead of horizontal** — Three onboarding steps stacked vertically. Horizontal layouts require complex table structures and break on mobile. Vertical is simpler, more reliable, and easier to scan.

4. **MSO conditional button technique** — The CTA button uses a dual approach:
   - For modern clients: a styled `<a>` tag with padding and background-color
   - For Outlook: a VML `<v:roundrect>` wrapped in MSO conditional comments
   - This ensures the button looks correct everywhere

5. **Preheader text strategy** — Hidden preheader reads: "Here's how to get started in 3 simple steps." This gives inbox previews useful context instead of pulling random text from the email body.

6. **Dark mode approach** — Conservative strategy:
   - Meta tag declares dark mode support
   - `<style>` block with `prefers-color-scheme` for Apple Mail
   - Transparent images where possible
   - NOT relying on dark mode styles — the email must look acceptable even if dark mode inverts colors without our styles

7. **Footer compliance** — Includes physical address (CAN-SPAM), unsubscribe link (CAN-SPAM + GDPR), and company info. Uses smaller text (#999, 12px) to visually de-emphasize without hiding.

8. **No web fonts** — Arial/Helvetica stack only. While Apple Mail supports web fonts, the visual inconsistency between clients that do and don't support them creates a jarring brand experience. System fonts are predictable.

### What This Flow Exposes About the Knowledge Base

This edge case reveals a gap: the current knowledge files are web-focused. Email HTML is a parallel universe with different rules. Key gaps:

- No dedicated `components/email-patterns.md` file covering email-specific component techniques (VML buttons, table layouts, preheader patterns)
- No `responsive/email-responsive.md` covering fluid-hybrid email techniques, media query support matrix
- Typography and layout files assume CSS Grid/Flexbox availability
- Button component file doesn't cover the MSO/VML technique

**Recommendation:** Consider adding an `email/` directory or at minimum a `components/email-patterns.md` file for email-specific guidance.

## Template Output

See: [edge-email-template.html](./edge-email-template.html)
