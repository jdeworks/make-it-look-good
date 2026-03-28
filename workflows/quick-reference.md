# Quick Reference — Critical Design Numbers

> **TL;DR:** The ~25 most important numbers in UI/UX design. Bookmark this file for fast lookups.

## Color & Contrast
| Rule | Value | Standard |
|------|-------|----------|
| Normal text contrast (AA) | **4.5:1** minimum | WCAG 2.2 |
| Large text contrast (AA) | **3:1** minimum | WCAG 2.2 |
| Normal text contrast (AAA) | **7:1** minimum | WCAG 2.2 |
| Large text threshold | **18pt** (24px) or **14pt bold** (18.5px) | WCAG 2.2 |
| UI component contrast | **3:1** minimum against adjacent colors | WCAG 2.2 |
| Focus indicator contrast | **3:1** minimum | WCAG 2.2 |
| APCA body text (supplementary) | **Lc 60+** | APCA-W3 (future WCAG 3.0) |
| APCA large/bold text | **Lc 45+** | APCA-W3 |

## Typography
| Rule | Value | Source |
|------|-------|--------|
| Body text size (web) | **16px** minimum | Browser default, accessibility best practice |
| Line height (body text) | **1.4–1.6** | WCAG 2.2 (1.5 recommended) |
| Line length (measure) | **45–75 characters** (ideal: 66) | Bringhurst, Butterick |
| Paragraph spacing | **0.75em–1em** below | Butterick |
| Heading scale ratio | **1.200–1.333** (minor third to perfect fourth) | Modular scale |
| Maximum font weights per page | **2–3** | Performance + visual clarity |
| Maximum typefaces per page | **2** (1 serif + 1 sans, or 2 from same superfamily) | Typography best practice |

## Spacing & Layout
| Rule | Value | Source |
|------|-------|--------|
| Base spacing unit | **4px** or **8px** | Material Design, most systems |
| Spacing scale | **4, 8, 12, 16, 24, 32, 48, 64, 96** (px) | 4px base system |
| Content max-width | **1200–1440px** | Common practice |
| Readable content width | **600–800px** (matches 45–75ch) | Readability research |
| Minimum padding (mobile) | **16px** horizontal | Material Design |
| Grid columns (desktop) | **12** | Bootstrap, Material, most systems |
| Grid columns (tablet) | **8** | Material Design |
| Grid columns (mobile) | **4** | Material Design |
| Grid gutter | **16–24px** | Common practice |

## Touch & Interaction
| Rule | Value | Standard |
|------|-------|----------|
| Minimum touch target | **44×44px** (CSS) / **48×48dp** | WCAG 2.2 / Material Design |
| Minimum touch target spacing | **8px** between targets | WCAG 2.2 |
| Click target (desktop) | **24×24px** minimum | WCAG 2.2 |
| System response time | **<400ms** for perceived immediacy | Doherty Threshold |
| Hover transition duration | **150–200ms** | Material Design |
| Enter/appear animation | **200–300ms** | Material Design |
| Exit/disappear animation | **150–200ms** | Material Design |
| Maximum animation duration | **500ms** (users perceive as slow beyond this) | UX research |
| Loading spinner delay | **300ms–1s** before showing | Nielsen |
| Skeleton screen | Show **immediately** for loads >300ms | UX best practice |

## Reading & Scanning
| Rule | Value | Source |
|------|-------|--------|
| Users who scan vs. read | **79%** scan, only **16%** read word-by-word | Nielsen Norman Group |
| Word count reduction benefit | Cut to **50%** → **58%** usability improvement | Nielsen Norman Group |
| Scannable layout benefit | Headings + bullets + highlights → **47%** improvement | Nielsen Norman Group |
| Combined writing improvements | Concise + scannable + objective → **124%** improvement | Nielsen Norman Group |

## Responsive Breakpoints
| Breakpoint | Value | Typical Use |
|------------|-------|-------------|
| Small mobile | **320px** | Minimum supported width |
| Mobile | **480px** | Large phones |
| Tablet | **768px** | Portrait tablets |
| Desktop | **1024px** | Landscape tablets, small laptops |
| Large desktop | **1280px** | Standard desktops |
| Extra large | **1536px** | Large monitors |

## Hick's Law — Choice Limits
| Rule | Value | Source |
|------|-------|--------|
| Navigation items | **5–7** top-level items | Hick's Law, Miller's Law |
| Form fields per step | **5–7** visible fields | Cognitive load research |
| Options in a dropdown | **≤15** before search is needed | UX best practice |
| Actions in a context menu | **≤10** | UX best practice |

## Z-Index Scale
| Layer | Value | Use |
|-------|-------|-----|
| Base | **0** | Default content |
| Dropdown | **100** | Dropdowns, tooltips |
| Sticky | **200** | Sticky headers |
| Overlay | **300** | Modal backdrops |
| Modal | **400** | Modal dialogs |
| Popover | **500** | Popovers above modals |
| Toast | **600** | Toast notifications |
| Maximum | **999** | System-level (skip links, etc.) |

## Border Radius
| Element | Value | Source |
|---------|-------|--------|
| Buttons | **4–8px** | Most design systems |
| Cards | **8–12px** | Material Design 3 |
| Input fields | **4–8px** | Common practice |
| Modals | **12–16px** | Material Design 3 |
| Chips/tags | **full (9999px)** or **4–8px** | Material Design 3 |
| Avatars | **full (50%)** | Common practice |

## Quick Preset Lookup

Need a starting point? Grab a preset from [`docs/presets/_index.md`](../docs/presets/_index.md):

| I need a... | Preset |
|-------------|--------|
| Dashboard layout | `docs/presets/shell-dashboard/` |
| Landing page | `docs/presets/shell-marketing/` + `docs/presets/hero/` |
| Login / signup page | `docs/presets/shell-form/` |
| Data browser | `docs/presets/shell-sidebar/` + `docs/presets/data-table/` |
| Pricing page | `docs/presets/pricing/` |
| Portfolio | `docs/presets/portfolio/` or `docs/presets/personal-hero/` |
| Agency portfolio | `docs/presets/agency-portfolio/` (scroll-shrink logo, marquee, project grid) |
| App / fintech showcase | `docs/presets/app-showcase/` (dark hero, phone mockup, stacking cards) |
| Education / content landing | `docs/presets/scroll-reveal-landing/` (sky gradient, line-by-line reveal) |
| Blog / editorial | `docs/presets/editorial-blog/` |
| SaaS features | `docs/presets/saas-features/` |
| Developer tool | `docs/presets/devtool-landing/` |
| Event / conference | `docs/presets/event-page/` |
| Documentation site | `docs/presets/docs-site/` |
| Product page | `docs/presets/product-page/` |
| Scroll-driven story | `docs/presets/scroll-story/` |

Each preset has clean, minimalist, and playful personality variants. React and Vue variants available for interactive components — see [`docs/presets/FRAMEWORKS.md`](../docs/presets/FRAMEWORKS.md).

## Sources
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Material Design 3](https://m3.material.io)
- [Laws of UX](https://lawsofux.com)
- [Nielsen Norman Group](https://www.nngroup.com)
- [Butterick's Practical Typography](https://practicaltypography.com)
- [The Elements of Typographic Style (Bringhurst)](https://en.wikipedia.org/wiki/The_Elements_of_Typographic_Style)
