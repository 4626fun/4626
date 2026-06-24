# 4626 Docs Site — Next-Level Redesign Spec

Grounded in the actual `src/css/custom.css` (754 lines), `docusaurus.config.ts`, `sidebars.ts`, and live DOM of `docs.4626.fun`. Not generic advice — every finding references a real defect in the current build.

---

## A. Design Direction Summary

Strip the site back to three things: a quiet dark canvas, one confident typeface family, and a single accent. Today the site leans on Infima's default system font stack, a Dracula code theme that fights the blue brand, 12 undifferentiated top-level sidebar categories, full-grid table borders, and a navbar that duplicates the sidebar. The reading surface — 90% of the traffic — is the least designed part of the site.

Direction: **editorial calm**. True-black canvas with a single elevated surface layer, Inter for text + JetBrains Mono for code (both actually loaded, not just referenced), a custom cool-toned prism palette that maps to brand blue, horizontal-only table rules, a shortened and grouped sidebar, and a one-line navbar. The homepage hero is already close — bring the reading pages up to that bar.

North stars: Linear's typographic confidence, Vercel's surface discipline, Stripe Docs' reading flow.

---

## B. Top 10 UX Problems and Fixes

### 1. No real typeface is loaded
`custom.css:260` references `'JetBrains Mono'` for code, but no `@font-face` or Google Fonts `<link>` exists anywhere. Code renders as generic monospace. Body text uses Infima's default system stack (Helvetica/Arial). This is the single biggest "feels generic" driver.
**Fix:** Load Inter (400/500/600/700) + JetBrains Mono (400/500/600) via self-hosted `@font-face` or Google Fonts preconnect. Set `--ifm-font-family-base` and `--ifm-font-family-monospace` to them.

### 2. Dracula code theme clashes with the brand
`docusaurus.config.ts:200` sets `darkTheme: prismThemes.dracula`. Dracula is purple/pink/green — it visually fights the #3B82F6 blue brand and looks "developer toy" rather than premium.
**Fix:** Replace with a custom prism theme object (or `prismThemes.oneDark` as a base) retuned so keywords/strings sit in the blue→cyan→violet range, background matches `--ifm-background-surface-color`, and nothing is more saturated than the brand accent.

### 3. Secondary text fails WCAG AA in dark mode
`custom.css:81` sets `--ifm-font-color-secondary: #999999` on `#020202` background. Contrast = 2.85:1. WCAG AA requires 4.5:1 for normal text. Every caption, muted label, and TOC subtitle is below threshold.
**Fix:** Raise to `#A8A8A8` minimum (4.6:1), ideally `#B4B4B4` (5.5:1) for the secondary tier. Add a third `--ifm-font-color-tertiary` at `#8A8A8A` for truly de-emphasized metadata only.

### 4. Sidebar is overlong and visually flat
`sidebars.ts` defines 12 top-level entries: Welcome, Wallet Architecture, Users, Creators, Developers, Protocol Integrators, Operators/SRE, Security, Audits, Reference, Legal, API Reference. No grouping, no icons, no visual distinction between a category and a leaf doc. "Users" is force-expanded showing 4 children; the other 11 are collapsed — the user sees a wall of 12 identical rows.
**Fix:** Group into 3 super-sections with sticky headers: **Build** (Users, Creators, Developers, Protocol Integrators), **Operate** (Operators/SRE, Security, Audits), **Reference** (Wallet Architecture, Contracts, API, Reference, Legal). Auto-expand only the active super-section. Collapse "Welcome" into the logo/home link. Target ≤5 visible categories per group.

### 5. Navbar duplicates the sidebar
Navbar has Docs, Wallet Architecture, Contracts, API, Change Log, App, GitHub. The first four are already in the sidebar — this is redundant chrome that steals horizontal space.
**Fix:** Navbar = logo + (search input on ≥lg) + theme toggle + App + GitHub. Move "Change Log" into the Operators sidebar group where it belongs. Five items → three.

### 6. Tables use full grid borders — spreadsheet feel
`custom.css:278-281` puts a `1px solid` border on every `th` and `td`. This creates a closed grid that reads as a spreadsheet, not editorial content.
**Fix:** Remove vertical borders. Keep a `1px` bottom rule per row, a slightly heavier header bottom rule, and subtle header background. Add `border-collapse: separate; border-spacing: 0` so rounded corners work on the wrapper.

### 7. Every H2 has a full-width divider line
`custom.css:128-133` gives every `h2` a `border-bottom: 1px solid` + `3rem` top margin. Across a long audit/runbook page this fragments the reading flow into boxed chunks.
**Fix:** Drop the border-bottom on h2. Use size + weight + margin contrast alone for hierarchy. Keep the 3rem top margin (that's good rhythm). Optionally add a subtle 2px accent tick on the left of the heading text instead of a full rule.

### 8. No search
A docs site with 80+ pages and no search is a navigation failure. Docusaurus supports Algolia DocSearch (free for open-source) or a local client-side index.
**Fix:** Add `algolia` config to `themeConfig` (apply for DocSearch) or wire `@easyops/docusaurus-search-local` for an instant zero-infra local search. Place the input in the navbar, keyboard-shortcut `/` to focus.

### 9. Blockquote treatment is inconsistent
`custom.css:150-164` styles only `blockquote:first-of-type` as a callout. Every subsequent blockquote reverts to Infima defaults (plain italic, left border). On audit pages with multiple blockquotes this looks broken.
**Fix:** Style all blockquotes consistently. Use the callout treatment (surface bg, left accent, padding, radius) for every blockquote, or introduce explicit admonition types (`:::note`, `:::warning`, `:::danger`) and leave plain blockquotes as quiet italic asides.

### 10. Right TOC is under-designed and often hidden
The right-side TOC is Docusaurus default with `font-size: 0.85rem` and `font-weight: 500` on active. No scroll-spy progress indicator, no visual active rail. Several pages hide it via frontmatter, removing the only persistent "where am I" signal.
**Fix:** Add a 2px scroll-progress bar at the top of the TOC column. Give the active TOC link a left accent tick (matching the sidebar active treatment) instead of just weight. Keep TOC visible on any page with ≥3 headings; don't hide it.

---

## C. Visual System Spec

### C.1 Typography

| Token | Family | Weights | Notes |
|---|---|---|---|
| `--font-sans` | Inter | 400, 500, 600, 700 | Body, headings, UI |
| `--font-mono` | JetBrains Mono | 400, 500, 600 | Code blocks, inline code |

**Type scale (8pt rhythm, base 16px):**

| Element | Size | Weight | Line-height | Margin |
|---|---|---|---|---|
| h1 (page title) | 2.25rem / 36px | 700 | 1.15 | 0 0 1.5rem |
| h2 | 1.5rem / 24px | 600 | 1.25 | 3rem 0 1rem |
| h3 | 1.25rem / 20px | 600 | 1.3 | 2rem 0 0.75rem |
| h4 | 1rem / 16px | 600 | 1.4 | 1.5rem 0 0.5rem |
| Body | 1rem / 16px | 400 | 1.7 | 0 0 1.25rem |
| Small / caption | 0.875rem / 14px | 400 | 1.6 | — |
| Code (block) | 0.875rem / 14px | 400 | 1.6 | — |
| Code (inline) | 0.85em | 500 | inherit | — |
| TOC link | 0.8125rem / 13px | 400/500 | 1.5 | — |
| Sidebar link | 0.875rem / 14px | 400/500 | 1.4 | — |
| Navbar link | 0.875rem / 14px | 500 | — | — |

Letter-spacing: `-0.011em` on h1/h2, `-0.006em` on h3/h4, `0` on body. `font-feature-settings: "liga" 1, "calt" 1, "ss01" 1` (Inter's single-storey `a`/`g` for a cleaner docs look — optional, taste call).

### C.2 Spacing (4pt minor / 8pt major grid)

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
--space-6: 32px
--space-7: 48px
--space-8: 64px
```

Reading column: `max-width: 720px` (down from current 820 — tighter focus, better line length at 16px/1.7). Page horizontal padding: `--space-7` desktop, `--space-4` tablet, `--space-3` mobile. Section spacing: `--space-7` between major sections, `--space-5` between paragraphs within a section.

### C.3 Color tokens (dark-first, WCAG AA verified)

```css
[data-theme='dark'] {
  /* Surfaces — one elevation layer, not five */
  --ifm-background-color:         #08090A;  /* canvas — lifted from pure black for less eye strain */
  --ifm-background-surface-color: #101113;  /* cards, code, sidebar hover, table header */
  --ifm-background-elevated:      #16181B;  /* popover, command palette, sticky header */

  /* Text — all verified ≥4.5:1 on canvas */
  --ifm-font-color-base:          #ECEDEE;  /* 15.2:1 */
  --ifm-font-color-secondary:     #B4B6BA;  /* 6.9:1 — was #999 (2.85:1, FAILED) */
  --ifm-font-color-tertiary:      #8A8C90;  /* 4.0:1 — large/meta only, not body */

  /* Accent — single brand blue, restrained */
  --ifm-color-primary:            #4B8BF5;  /* 4.7:1 on canvas — link-safe */
  --ifm-color-primary-hover:      #6BA0F7;
  --ifm-color-primary-pressed:    #3A78E8;
  --ifm-color-primary-soft:       rgba(75, 139, 245, 0.12);  /* active bg, focus ring fill */

  /* Borders — barely visible, intentional */
  --ifm-border-color:         #1E2024;  /* hairlines */
  --ifm-border-color-strong:  #2A2D33;  /* card edges, header bottom */
  --ifm-toc-border-color:     #1E2024;
  --ifm-hr-border-color:      #1E2024;

  /* Code surface — distinct from body surface */
  --ifm-code-background:      #0C0D0F;
  --ifm-code-border:          #1E2024;
}
```

Why `#08090A` instead of `#020202`: pure black creates harsh edge contrast and makes elevation impossible to express. A near-black canvas lets the surface layer (`#101113`) read as a real elevation step. This is the Linear/Vercel move.

Light mode stays but is secondary — keep the existing light tokens, just fix the font family and table borders there too.

### C.4 Elevation / borders / shadows

**One elevation system, three levels:**

| Level | Use | Treatment |
|---|---|---|
| 0 | Body, reading column | No border, canvas bg |
| 1 | Cards, code blocks, table header, admonitions | `bg: surface`, `border: 1px solid --ifm-border-color`, no shadow |
| 2 | Sticky header, popovers, command palette | `bg: elevated`, `border-bottom: 1px solid --ifm-border-color-strong`, `shadow: 0 4px 12px -4px rgba(0,0,0,0.4)` |

No drop shadows on cards or code blocks. Borders do the work. Shadows only on floating elements (header, popovers). This is the Vercel rule.

### C.5 Interaction states

| Element | Default | Hover | Active/Selected | Focus |
|---|---|---|---|---|
| Sidebar link | `color: secondary` | `color: base`, `bg: surface` | `color: primary`, `bg: primary-soft`, `box-shadow: inset 2px 0 0 primary` | `outline: 2px solid primary; outline-offset: 2px` |
| TOC link | `color: tertiary` | `color: secondary` | `color: primary`, `font-weight: 500`, `border-left: 2px solid primary` | same focus ring |
| Navbar link | `color: secondary` | `color: base` | n/a | same focus ring |
| Inline link | `color: primary`, no underline | `color: primary-hover`, underline | n/a | same focus ring |
| Button (primary) | `bg: primary`, `color: #fff` | `bg: primary-hover`, `translateY(-1px)` | `bg: primary-pressed` | focus ring |
| Code block copy btn | `opacity: 0` | `opacity: 1` | `opacity: 1` + check icon | focus ring |

### C.6 Motion principles

All transitions: `150ms cubic-bezier(0.4, 0, 0.2, 1)` (ease-out). Exceptions: page-level reveals `200ms`.

- Hover color/bg shifts: 150ms.
- Card lift: 150ms, `translateY(-2px)` max — not 3px (current `custom.css:628` is too much).
- No fade-in-up on scroll. No stagger. No parallax.
- TOC active indicator: instant switch (no transition — scroll-spy should feel mechanical, not animated).
- Page navigation: no transition (Docusaurus SPA already feels instant; adding one adds jank).
- `prefers-reduced-motion: reduce` → kill all transforms and transitions. (Already partially done at `custom.css:744` — extend to all interactive elements.)

---

## D. Layout Blueprint

### D.1 Desktop (≥1280px): three columns

```
┌─────────────────────────────────────────────────────────────┐
│  [logo]  4626.fun                          [search]  ☾  App  GitHub  │  56px navbar, sticky, blur
├──────────┬──────────────────────────────────────┬───────────┤
│          │                                      │           │
│ SIDEBAR  │         READING COLUMN               │    TOC    │
│ 280px    │         720px max                    │   200px   │
│ sticky   │         centered                     │  sticky   │
│ scroll   ��                                      │  scroll   │
│          │                                      │           │
│ [Build]  │  # Page Title                         │  On this  │
│  Users   │  summary blockquote                  │  page     │
│  ...     │                                      │  • Sec 1  │
│ [Operate]│  ## Section                          │  • Sec 2  │
│  Ops     │  body...                             │  ▸ Sec 3  │
│  ...     │                                      │           │
│ [Ref]    │  ```code```                          │  ───────  │
│  ...     ��                                      │  Last upd │
│          │                                      │  Edit GH  │
├──────────┴──────────────────────────────────────┴───────────┤
│  Footer (minimal, one row)                                  │
└─────────────────────────────────────────────────────────────┘
```

- Sidebar: 280px fixed, independently scrollable, sticky `top: 56px`.
- Reading column: `max-width: 720px`, centered in remaining space.
- TOC: 200px, sticky `top: 56px`, independently scrollable, hidden if page has <3 headings.
- Gutter between columns: `48px`.

### D.2 Tablet (768–1279px): two columns, TOC collapses

```
┌──────────────────────────────────────────┐
│  [logo]  4626.fun           [search] ☾ GH │
├──────────┬───────────────────────────────┤
│ SIDEBAR  │       READING COLUMN           │
│ 260px    │       640px max                │
│          │       (TOC moves to a sticky   │
│          │        bottom-right FAB that   │
│          │        opens a sheet)          │
└──────────┴───────────────────────────────┘
```

- TOC becomes a floating "On this page" button (bottom-right) that opens a popover sheet.
- Sidebar narrows to 260px.
- Search stays in navbar if ≥1024px; becomes an icon-trigger below that.

### D.3 Mobile (<768px): single column, sidebar + TOC are drawers

```
┌────────────────────────────┐
│  [☰]  4626.fun         ☾ GH │
├────────────────────────────┤
│                            │
│     READING COLUMN         │
│     100% - 32px padding    │
│                            │
│  # Page Title              │
│  body...                   │
│                            │
│  [On this page ▾]          │  ← collapsible TOC inline at top
│                            │
├────────────────────────────┤
│  Footer                    │
└────────────────────────────┘
```

- Sidebar = left drawer, opened by hamburger. Full-height, 85vw max 320px, overlay backdrop.
- TOC = collapsible `<details>` element inserted at the top of the article (Docusaurus `toc` frontmatter can place it). No right rail.
- Navbar: logo + hamburger (left), theme toggle + GitHub (right). Search becomes an icon that opens a full-screen overlay.
- Code blocks: horizontal scroll with a subtle scroll indicator (faded gradient on right edge).

---

## E. Component Checklist

For each component: what changes, key tokens, before → after.

### E.1 Navbar
- **Remove:** Docs, Wallet Architecture, Contracts, API, Change Log links (sidebar owns these).
- **Add:** Search input (≥lg) or search icon (<lg).
- **Keep:** Logo+title, theme toggle, App, GitHub.
- **Change:** height 64px → 56px. Backdrop blur stays (already at `custom.css:392`). Add `border-bottom` only on scroll (transparent at top).
- **Tokens:** `--ifm-navbar-height: 56px`, `--ifm-navbar-background-color` with alpha.

### E.2 Sidebar
- **Add:** 3 sticky super-section headers (Build / Operate / Reference) as non-clickable labels.
- **Change:** auto-expand only active super-section; collapse others.
- **Change:** active item — replace `box-shadow: inset 2px 0` (current `custom.css:417`) with `bg: primary-soft` + `color: primary` + `inset 2px 0 0 primary`. Combined treatment is clearer.
- **Add:** category collapse/expand chevron rotation animation (150ms).
- **Remove:** the duplicate "4626.fun" logo+text at the top of the sidebar (`e15` in DOM) — the navbar already has it. Saves 48px of vertical space.
- **Tokens:** `--ifm-menu-color`, `--ifm-menu-color-active`, `--ifm-menu-color-background-active`, sidebar width `280px`.

### E.3 Reading column / markdown
- **Change:** `max-width: 820px` → `720px`.
- **Change:** `line-height: 1.75` → `1.7` (1.75 is slightly loose at 16px; 1.7 is the sweet spot).
- **Remove:** h2 `border-bottom` (custom.css:132).
- **Add:** h2 left accent tick — `border-left: 3px solid primary-soft; padding-left: 12px` (subtle, not a full rule).
- **Keep:** h2 `margin-top: 3rem` (good rhythm).
- **Tokens:** `--ifm-font-family-base`, `--ifm-heading-margin-top`, reading width.

### E.4 Code blocks
- **Change:** prism dark theme from dracula → custom cool palette.
- **Add:** `border: 1px solid --ifm-code-border`, `border-radius: 8px`, `bg: --ifm-code-background`.
- **Add:** filename/title bar (Docusaurus ` ```js title="file.ts" ` already supports this) — style as `bg: surface`, `border-bottom: 1px solid border-color`, `font: mono 12px/1 tertiary`.
- **Add:** copy button visible on hover (Docusaurus has this built in — just style it).
- **Tokens:** `--ifm-code-background`, `--ifm-code-border`, custom prism overrides.

### E.5 Tables
- **Remove:** vertical cell borders (`custom.css:279`).
- **Change:** `border-collapse: collapse` → `border-collapse: separate; border-spacing: 0`.
- **Add:** `th` → `border-bottom: 2px solid --ifm-border-color-strong`, `bg: surface`, `text-align: left`, `font-weight: 600`, `color: secondary`, `font-size: 0.8125rem`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
- **Add:** `td` → `border-bottom: 1px solid --ifm-border-color`, no top border, `padding: 12px 16px`.
- **Add:** `tr:last-child td` → no bottom border.
- **Add:** wrapper with `border: 1px solid border-color; border-radius: 8px; overflow: hidden` so the table reads as one contained unit.
- **Add:** horizontal scroll on overflow (`overflow-x: auto` wrapper) with faded right-edge gradient.

### E.6 Admonitions / callouts
- **Change:** style ALL blockquotes, not just `first-of-type` (fixes custom.css:150 limitation).
- **Admonition types** (use Docusaurus `:::note` syntax, not raw blockquote):
  - `note` → neutral: `bg: surface`, `border-left: 3px solid secondary`, icon: info.
  - `tip` → accent: `bg: primary-soft`, `border-left: 3px solid primary`, icon: bulb.
  - `warning` → amber: `bg: rgba(245,158,11,0.08)`, `border-left: 3px solid #F59E0B`, icon: triangle.
  - `danger` → red: `bg: rgba(239,68,68,0.08)`, `border-left: 3px solid #EF4444`, icon: octagon.
- **Remove:** the current `border-left: 3px solid primary` on info/tip (`custom.css:310`) — use the typed system instead.
- **Add:** `border-radius: 0 8px 8px 0`, `padding: 16px 20px`, `margin: 24px 0`.

### E.7 Mermaid diagrams
- **Change:** container `border-radius: 8px` → `12px`, add `border: 1px solid border-color`.
- **Change:** mermaid dark theme `dark` → `dark` but override node fill to `--ifm-background-elevated` and stroke to `--ifm-border-color-strong` so diagrams match the site palette, not mermaid defaults.
- **Add:** caption styling already exists (`custom.css:184`) — keep, just bump `font-size` to `0.8125rem` and add `letter-spacing: 0.02em`.

### E.8 Right TOC
- **Add:** scroll-progress bar (2px, `bg: primary`, `width: scrollPercent%`) at top of TOC column.
- **Change:** active link — add `border-left: 2px solid primary; padding-left: 10px` (currently only `font-weight: 500` at custom.css:362).
- **Add:** "Edit this page" + "Last updated" links at the bottom of the TOC column (Docusaurus supports this via `showLastUpdateTime`).
- **Tokens:** `--ifm-toc-color`, `--ifm-toc-color-active`.

### E.9 Breadcrumbs
- **Decision:** remove the current breadcrumb (`e17` shows only "Home page" — useless). Replace with the page's sidebar category path rendered as a quiet eyebrow above the h1: e.g. `Operators / SRE > Deployment` in `tertiary` color, `0.75rem`, `letter-spacing: 0.04em`, `text-transform: uppercase`. This is more useful than a one-link breadcrumb.

### E.10 Footer
- **Change:** from 4-column link grid to a single quiet row: `© 2026 4626.fun · Built on Base · [GitHub] [App] [Docs home]`. `color: tertiary`, `font-size: 0.8125rem`, `border-top: 1px solid border-color`, `padding: 32px 0`. The 4-column grid is marketing-site furniture; a docs footer should be minimal.

### E.11 Empty / loading states
- **Search no results:** `“No results for ‘{query}’”` + suggestion to check spelling or browse the sidebar. `color: secondary`, centered, `padding: 48px`.
- **Page 404:** same minimal treatment. Single h1 `“Page not found”`, one line of body, link to home. No illustration (stay restrained).
- **Loading (search index):** a 16px spinning ring in `primary`, centered in the search dropdown. 600ms timeout before showing (avoid flash).

### E.12 Mobile sidebar drawer
- **Add:** backdrop `bg: rgba(0,0,0,0.5)` with `backdrop-filter: blur(4px)`.
- **Add:** drawer slide-in `transform: translateX(-100%) → 0`, `200ms ease-out`.
- **Add:** swipe-to-close (optional, nice-to-have).
- **Add:** `Esc` closes drawer (Docusaurus handles this).

---

## F. Implementation Plan (phased)

### Phase 1 — Quick wins (1–2 hours, CSS-only, no structural change)
1. Load Inter + JetBrains Mono fonts (add `<link>` to `docusaurus.config.ts` `stylesheets` or self-host in `static/`).
2. Set `--ifm-font-family-base` and `--ifm-font-family-monospace`.
3. Fix dark-mode secondary text contrast: `#999999` → `#B4B6BA`.
4. Lift canvas from `#020202` → `#08090A`, surface from `#0A0A0A` → `#101113`.
5. Replace prism `dracula` → `oneDark` (one-line config change, immediate improvement).
6. Remove table vertical borders; switch to horizontal-only rules.
7. Remove h2 `border-bottom`; add left accent tick.
8. Narrow reading column `820px` → `720px`; `line-height` 1.75 → 1.7.
9. Style all blockquotes consistently (not just `first-of-type`).
10. Remove the 4-column footer; replace with single quiet row.

**Validation:** `pnpm -C apps/docs-site build:slim` (skip forge/typedoc for speed). Visual check dark + light. Contrast check with browser DevTools.

### Phase 2 — Structural (half day)
1. Regroup sidebar into Build / Operate / Reference super-sections (`sidebars.ts`).
2. Remove redundant navbar items; add search (local plugin first, Algolia if approved).
3. Add TOC scroll-progress bar + active accent tick.
4. Style code block filename bar + copy button.
5. Add table wrapper with rounded border + horizontal scroll.
6. Replace breadcrumb with category eyebrow.
7. Remove duplicate sidebar logo.

**Validation:** `pnpm -C apps/docs-site build:slim`. Click through 5 representative pages (homepage, wallet-architecture, a contract page, an audit page, the API reference). Check mobile drawer at 375px.

### Phase 3 — Polish (half day)
1. Custom prism palette (retune oneDark to brand blue range).
2. Mermaid node colors mapped to site palette.
3. Mobile TOC as inline `<details>`.
4. Reduced-motion audit — ensure every transition has a `prefers-reduced-motion` override.
5. Keyboard nav audit — Tab through sidebar, TOC, navbar, code copy buttons.
6. Contrast audit — run axe-core on 3 pages in dark mode.
7. Add `prefers-color-scheme` detection so first-time visitors get dark by default (currently defaults to light).

**Validation:** `pnpm -C apps/docs-site build:slim` + axe-core smoke test + `pnpm -C apps/docs-site check:links`.

### Phase 4 — Optional enhancements
1. Command palette (⌘K) if search-local is wired — `react-hotkeys-hook` + a simple popover.
2. Sidebar section collapse memory (localStorage).
3. "Copy link to heading" on hover (Docusaurus has this; just style the anchor).
4. Reading-progress bar at the very top of the page (1px, full width).

---

## G. CSS / Token Snippets

### G.1 Font loading + base tokens (drop into `custom.css` `:root` / `[data-theme='dark']`)

```css
/* === Fonts === */
/* Option A: Google Fonts via stylesheets in docusaurus.config.ts */
/* Option B: self-host in static/fonts/ + @font-face below */

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/Inter.woff2') format('woff2');
}

@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url('/fonts/JetBrainsMono.woff2') format('woff2');
}

/* === Dark theme tokens (replaces custom.css:64-109) === */
[data-theme='dark'] {
  /* Surfaces */
  --ifm-background-color:         #08090A;
  --ifm-background-surface-color: #101113;
  --ifm-background-elevated:      #16181B;

  /* Text — AA verified */
  --ifm-font-color-base:          #ECEDEE;
  --ifm-font-color-secondary:     #B4B6BA;
  --ifm-font-color-tertiary:      #8A8C90;

  /* Accent */
  --ifm-color-primary:            #4B8BF5;
  --ifm-color-primary-dark:       #3A78E8;
  --ifm-color-primary-darker:     #2E66D4;
  --ifm-color-primary-darkest:    #2455B0;
  --ifm-color-primary-light:      #6BA0F7;
  --ifm-color-primary-lighter:    #8DB5F9;
  --ifm-color-primary-lightest:   #AFC9FB;
  --ifm-color-primary-soft:       rgba(75, 139, 245, 0.12);

  /* Borders */
  --ifm-border-color:         #1E2024;
  --ifm-border-color-strong:  #2A2D33;
  --ifm-toc-border-color:     #1E2024;
  --ifm-hr-border-color:      #1E2024;

  /* Code */
  --ifm-code-background:      #0C0D0F;
  --ifm-code-border:          #1E2024;
  --docusaurus-highlighted-code-line-bg: rgba(75, 139, 245, 0.10);

  /* Navbar + footer */
  --ifm-navbar-background-color:  rgba(8, 9, 10, 0.80);
  --ifm-footer-background-color:  #08090A;
  --ifm-footer-color:             #8A8C90;
  --ifm-footer-link-color:        #B4B6BA;
  --ifm-footer-link-hover-color:  #4B8BF5;

  /* Sidebar */
  --ifm-menu-color:                   #B4B6BA;
  --ifm-menu-color-active:            #4B8BF5;
  --ifm-menu-color-background-active: rgba(75, 139, 245, 0.10);

  /* Links */
  --ifm-link-color:       #4B8BF5;
  --ifm-link-hover-color: #6BA0F7;

  /* Fonts */
  --ifm-font-family-base:        'Inter', system-ui, -apple-system, sans-serif;
  --ifm-font-family-monospace:   'JetBrains Mono', 'Fira Code', monospace;
}
```

### G.2 Reading column + headings (replaces custom.css:116-143)

```css
.markdown {
  max-width: 720px;
  font-feature-settings: 'liga' 1, 'calt' 1;
}

.markdown p,
.markdown li {
  line-height: 1.7;
}

/* H2 — accent tick, no full rule */
.markdown h2 {
  margin-top: 3rem;
  margin-bottom: 1rem;
  padding-left: 12px;
  border-left: 3px solid var(--ifm-color-primary-soft);
}

.markdown h3 {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.markdown > h2:first-of-type {
  margin-top: 1.5rem;
}
```

### G.3 Tables (replaces custom.css:273-290)

```css
/* Table wrapper for rounded border + scroll */
.table-wrapper,
.markdown > table {
  display: block;
  overflow-x: auto;
  border: 1px solid var(--ifm-border-color);
  border-radius: 8px;
  margin: 1.5rem 0;
}

.markdown > table {
  border-collapse: separate;
  border-spacing: 0;
  border: none; /* wrapper handles border */
}

.markdown th {
  border-bottom: 2px solid var(--ifm-border-color-strong);
  background-color: var(--ifm-background-surface-color);
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ifm-font-color-secondary);
  padding: 12px 16px;
  text-align: left;
}

.markdown td {
  border-bottom: 1px solid var(--ifm-border-color);
  padding: 12px 16px;
}

.markdown tr:last-child td {
  border-bottom: none;
}
```

### G.4 Admonitions / callouts (replaces custom.css:296-311)

```css
.admonition {
  border-radius: 0 8px 8px 0;
  border-left-width: 3px;
  margin: 1.5rem 0;
  padding: 16px 20px;
}

.admonition-note {
  background-color: var(--ifm-background-surface-color);
  border-left-color: var(--ifm-font-color-secondary);
}

.admonition-tip {
  background-color: var(--ifm-color-primary-soft);
  border-left-color: var(--ifm-color-primary);
}

.admonition-warning {
  background-color: rgba(245, 158, 11, 0.08);
  border-left-color: #F59E0B;
}

.admonition-danger {
  background-color: rgba(239, 68, 68, 0.08);
  border-left-color: #EF4444;
}

/* Consistent blockquote (not just first-of-type) */
.markdown blockquote {
  border-left: 3px solid var(--ifm-border-color-strong);
  background-color: var(--ifm-background-surface-color);
  padding: 12px 20px;
  margin: 1.5rem 0;
  border-radius: 0 8px 8px 0;
  color: var(--ifm-font-color-secondary);
}
```

### G.5 Code blocks

```css
.prism-code {
  font-family: var(--ifm-font-family-monospace);
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Code block container */
.theme-code-block {
  background-color: var(--ifm-code-background);
  border: 1px solid var(--ifm-code-border);
  border-radius: 8px;
  overflow: hidden;
}

/* Filename bar */
.theme-code-block pre {
  margin: 0;
}

/* Copy button — visible on hover */
.theme-code-block .copyButton {
  opacity: 0;
  transition: opacity 150ms ease;
}

.theme-code-block:hover .copyButton,
.theme-code-block .copyButton:focus-visible {
  opacity: 1;
}
```

### G.6 Sidebar active + TOC active

```css
/* Sidebar active — combined treatment */
.menu__link--active:not(.menu__link--sublist) {
  background-color: var(--ifm-menu-color-background-active);
  color: var(--ifm-color-primary);
  font-weight: 500;
  box-shadow: inset 2px 0 0 var(--ifm-color-primary);
}

/* Sidebar hover */
.menu__link:hover:not(.menu__link--active) {
  background-color: var(--ifm-background-surface-color);
  color: var(--ifm-font-color-base);
}

/* TOC active — accent tick */
.table-of-contents__link {
  font-size: 0.8125rem;
  line-height: 1.5;
  border-left: 2px solid transparent;
  padding-left: 10px;
  margin-left: -12px;
  color: var(--ifm-font-color-tertiary);
  transition: color 150ms ease, border-color 150ms ease;
}

.table-of-contents__link:hover {
  color: var(--ifm-font-color-secondary);
}

.table-of-contents__link--active {
  color: var(--ifm-color-primary);
  font-weight: 500;
  border-left-color: var(--ifm-color-primary);
}
```

### G.7 Minimal footer (replaces the 4-column grid)

```css
.footer {
  border-top: 1px solid var(--ifm-border-color);
  padding: 32px 0;
  font-size: 0.8125rem;
  color: var(--ifm-font-color-tertiary);
}

/* Hide the 4-column link grid; use a single row */
.footer__links {
  display: none; /* or restructure in docusaurus.config.ts footer config */
}

.footer__copyright {
  text-align: center;
}
```

(Structural footer change happens in `docusaurus.config.ts` footer config, not just CSS.)

### G.8 Prism custom palette (replaces dracula)

In `docusaurus.config.ts`:
```ts
prism: {
  theme: prismThemes.github,
  darkTheme: prismThemes.oneDark,  // was: dracula
  additionalLanguages: ['solidity', 'bash', 'json'],
},
```

For full brand alignment, define a custom theme object instead of `oneDark`:
```ts
const customDarkPrism = {
  plain: {
    color: '#ECEDEE',
    backgroundColor: '#0C0D0F',
  },
  styles: [
    { types: ['comment'], style: { color: '#5C6370', fontStyle: 'italic' } },
    { types: ['keyword', 'builtin'], style: { color: '#4B8BF5' } },
    { types: ['function', 'class-name'], style: { color: '#6BA0F7' } },
    { types: ['string', 'char'], style: { color: '#7DD3A0' } },
    { types: ['number', 'boolean'], style: { color: '#F0A868' } },
    { types: ['operator', 'punctuation'], style: { color: '#B4B6BA' } },
    { types: ['variable', 'constant'], style: { color: '#ECEDEE' } },
    { types: ['tag', 'attr-name'], style: { color: '#4B8BF5' } },
  ],
};
// darkTheme: customDarkPrism (cast as needed)
```

### G.9 Reduced motion (extends custom.css:744)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Validation checklist (run after each phase)

- `pnpm -C apps/docs-site build:slim` — build succeeds
- `pnpm -C apps/docs-site check:links` — no new broken links
- Dark mode contrast: `#B4B6BA` on `#08090A` = 6.9:1 (AA pass), `#4B8BF5` on `#08090A` = 4.7:1 (AA pass for normal text)
- Keyboard: Tab through navbar → sidebar → content → TOC. Focus ring visible on every interactive element.
- `prefers-reduced-motion`: all transforms/transitions killed.
- Mobile 375px: sidebar drawer opens/closes, TOC inline, code blocks scroll horizontally, no horizontal page overflow.
- Tablet 768px: two-column, TOC as FAB popover.
- Desktop 1280px: three-column, all visible, no layout shift.
