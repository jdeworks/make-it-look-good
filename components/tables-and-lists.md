# Tables and Lists

> **TL;DR:** Use tables for comparing structured data, lists for scanning. Right-align numbers, left-align text. Minimum row height 48px for touch. Zebra striping or subtle borders — not both. On mobile below 640px, collapse tables into stacked cards.

## Core Principles

1. **Tables are for comparison** — if users need to compare values across rows or columns, use a table. If they just need to scan items, use a list.
2. **Alignment communicates data type** — left-align text, right-align numbers, center-align status icons/badges. Right-aligned numbers let users compare magnitudes by scanning the ones column.
3. **Visual noise kills scanning speed** — every border, stripe, and divider competes for attention. Use the minimum visual separation needed.
4. **Tables don't work on narrow screens** — horizontal scrolling is hostile. Transform tables into cards or stacked layouts below 640px.
5. **Lists imply sequence or grouping** — ordered lists for ranked/sequential items, unordered for non-hierarchical sets, definition lists for label-value pairs.

## Concrete Rules

### Data Tables
| Property | Value |
|----------|-------|
| Minimum row height | 48px (touch-friendly) |
| Row padding (vertical) | 12–16px |
| Cell padding (horizontal) | 12–16px |
| Header font weight | 600 (semi-bold) |
| Header background | Subtle tint — `hsl(0 0% 97%)` light / `hsl(0 0% 14%)` dark |
| Body font size | 14px (dense) or 16px (comfortable) |
| Header font size | 12–13px uppercase or 14px normal weight |
| Maximum columns before scroll | 6–7 on desktop, 2–3 on mobile |

### Text Alignment Rules
| Data Type | Alignment | Reason |
|-----------|-----------|--------|
| Text / names | Left | Natural reading direction |
| Numbers / currency | Right | Aligns decimal points for comparison |
| Dates | Left or right | Be consistent; right if comparing recency |
| Status badges | Center | Visual balance within column |
| Actions (buttons/links) | Right or center | Convention; keeps them out of data flow |

### Row Separation — Choose One
| Method | When to Use |
|--------|-------------|
| Zebra striping | Wide tables with many columns — helps eye track across |
| Horizontal borders only | Default choice — clean, minimal |
| Full grid borders | Spreadsheet-dense data with small cells |
| No separators | Short tables (< 5 rows) with generous padding |

### Sortable Columns
- Show a sort icon (arrow) on the currently sorted column
- Default sort: most useful order (often newest-first or alphabetical)
- Cycle: unsorted → ascending → descending → unsorted
- Use `aria-sort="ascending"`, `aria-sort="descending"`, or `aria-sort="none"` on `<th>`

### Lists
| List Type | Use Case |
|-----------|----------|
| `<ul>` | Non-sequential items — feature lists, nav menus, tag groups |
| `<ol>` | Ranked or step-by-step content — instructions, leaderboards |
| `<dl>` | Key-value pairs — metadata, glossaries, settings summaries |

- List item spacing: 8–12px between items (tight), 16px (comfortable)
- Nested list indent: 16–24px
- Bullet/number size should match body text weight

### Pagination
- Show 5–7 page numbers max, with ellipsis for gaps
- Always show first and last page
- Include Previous/Next buttons
- Show total count: "Showing 1–20 of 342 results"
- Default page size: 20–25 rows (50 max before performance suffers)

### Empty States
- Center an illustration or icon, a short message, and a primary action
- Message pattern: "No [items] yet" + "Create your first [item]" button
- Don't show an empty table with headers and no rows — it looks broken

## CSS/Implementation Patterns

### Responsive Table → Cards
```css
/* Base table styles */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 12px 16px;
  background: var(--surface-secondary);
  border-bottom: 2px solid var(--border-color);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.data-table tr { min-height: 48px; }

/* Right-align number columns */
.data-table .col-number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Collapse to cards on mobile */
@media (max-width: 639px) {
  .data-table thead { display: none; }

  .data-table tr {
    display: block;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .data-table td {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border: none;
  }

  .data-table td::before {
    content: attr(data-label);
    font-weight: 600;
    margin-right: 16px;
  }
}
```

### Sortable Column Header
```css
.sortable-header {
  cursor: pointer;
  user-select: none;
}

.sortable-header:hover {
  background: var(--surface-hover);
}

.sort-icon {
  display: inline-block;
  margin-left: 4px;
  opacity: 0.4;
  transition: opacity 150ms ease, transform 150ms ease;
}

.sortable-header[aria-sort="ascending"] .sort-icon,
.sortable-header[aria-sort="descending"] .sort-icon {
  opacity: 1;
}

.sortable-header[aria-sort="descending"] .sort-icon {
  transform: rotate(180deg);
}
```

### Definition List
```css
.dl-horizontal {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr;
  gap: 8px 16px;
}

.dl-horizontal dt {
  font-weight: 600;
  color: var(--text-secondary);
}

.dl-horizontal dd {
  margin: 0;
}
```

## Common Mistakes

1. **Not using `tabular-nums`** — proportional number fonts misalign digits in columns. Always use `font-variant-numeric: tabular-nums` for number columns.
2. **Horizontal scrolling as default** — hiding columns behind a scroll on mobile is lazy. Collapse to cards, or let users pick visible columns.
3. **Zebra striping AND borders** — pick one. Both together doubles the visual noise for no information gain.
4. **Missing `<caption>` or `aria-label`** — screen readers need a table description. Use `<caption>` (visible or `sr-only`) or `aria-label` on `<table>`.
5. **Missing `scope` on headers** — use `scope="col"` on column headers, `scope="row"` on row headers so assistive tech announces them correctly.
6. **Click targets too small on sortable headers** — ensure the entire `<th>` cell is clickable, not just a tiny icon.
7. **Showing an empty table skeleton** — headers with zero rows looks like a loading bug. Use a proper empty state.

## Decision Tree

```
Do I need a table or list?
├─ Users compare values across rows → Table
├─ Users scan a set of items → Unordered list
├─ Items have a defined order/ranking → Ordered list
├─ Displaying key-value pairs → Definition list
└─ Not sure → If data has 3+ attributes per item, table; otherwise list

How should I handle the table on mobile (< 640px)?
├─ 2–3 columns max → Keep as table, stack columns if needed
├─ 4+ columns → Collapse each row into a card
├─ Complex data with many columns → Let user choose visible columns
└─ Rarely viewed on mobile → Horizontal scroll (last resort)

Row separators?
├─ Wide table (6+ columns) → Zebra striping
├─ Standard table → Horizontal borders only
├─ Dense spreadsheet-like data → Full grid
└─ Short table (< 5 rows) → Extra padding, no separators
```

## Sources
- [Material Design 3 — Data Tables](https://m3.material.io/components/data-tables)
- [WCAG 1.3.1 — Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships) — table semantics
- [Adrian Roselli — Responsive Accessible Tables](https://adrianroselli.com/2017/11/a-responsive-accessible-table.html)
- [Nielsen Norman Group — Comparison Tables](https://www.nngroup.com/articles/comparison-tables/)
- [Inclusive Components — Data Tables](https://inclusive-components.design/data-tables/)

## Related Presets
- [`data-table/`](../docs/presets/data-table/) — Sortable data table with status badges ([React](../docs/presets/data-table/react.jsx), [Vue](../docs/presets/data-table/vue.vue), [Svelte](../docs/presets/data-table/svelte.svelte))
- [`card-grid/`](../docs/presets/card-grid/) — Responsive card grid (mobile-friendly table alternative)
