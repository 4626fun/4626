# UI/UX Design System — 4626 (4626.fun)

> Living reference for design tokens + component conventions.
> Token source of truth: `tailwind.config.js` + `src/index.css`.

---

## Color Tokens

### Brand

| Token | Value | Usage |
|-------|-------|-------|
| `brand-primary` | `#0052FF` | Primary CTA background, links |
| `brand-hover` | `#004AD9` | Button hover |
| `brand-accent` | `#3B82F6` | Secondary accent, badges |
| `brand-glow` | `rgba(0,82,255,0.15)` | Glow effects |

### Semantic (CSS variables — theme-aware)

| Token | Dark value | Usage |
|-------|-----------|-------|
| `--vault-bg` | `2 2 2` (#020202) | Page background |
| `--vault-card` | `10 10 10` (#0A0A0A) | Card/panel background |
| `--vault-border` | `31 31 31` (#1F1F1F) | Borders |
| `--vault-text` | `237 237 237` (#EDEDED) | Primary text |
| `--vault-subtext` | `102 102 102` (#666666) | Secondary text |

### Feedback

| Role | Color | Tailwind |
|------|-------|----------|
| Success | `#10B981` | `emerald-500` |
| Warning | `#F59E0B` | `amber-500` |
| Error | `#EF4444` | `red-500` |
| Info | `#0052FF` | `brand-primary` |

---

## Typography Scale

| Role | Class | Size | Weight | Font |
|------|-------|------|--------|------|
| Display | `text-2xl sm:text-3xl font-bold` | 24–30px | 700 | Doto / Inter |
| Heading | `text-lg sm:text-xl font-semibold` | 18–20px | 600 | Inter |
| Subheading | `text-base font-medium` | 16px | 500 | Inter |
| Body | `text-sm` | 14px | 300 | Inter |
| Caption | `text-xs` | 12px | 400 | Inter |
| Micro | `text-[11px]` | 11px | 500 | Inter |
| Label | `text-[11px] uppercase tracking-[0.14em]` | 11px | 500 | Inter |
| Mono | `font-mono text-xs` | 12px | 400 | JetBrains Mono |

### Rules
- Minimum readable size: 11px (`.label` class). Never go below.
- Use `tabular-nums` for any numeric display.
- Use `font-doto` only for page-level display headings in the waitlist.

---

## Spacing

Use Tailwind's default 4px grid. Standard gaps:

| Context | Value |
|---------|-------|
| Inside micro-panel | `p-3` (12px) |
| Inside card | `p-4 sm:p-5` (16–20px) |
| Between sections | `space-y-6 sm:space-y-8` (24–32px) |
| Between items in a list | `space-y-3` (12px) |
| Page padding | `px-4 sm:px-6` (16–24px) |

---

## Border Radius

| Component | Value |
|-----------|-------|
| Button (primary) | `rounded-2xl` (16px) |
| Button (secondary) | `rounded-xl` (12px) |
| Card / Panel | `rounded-2xl` (16px) |
| Micro-panel (nested) | `rounded-xl` (12px) |
| Input | `rounded-xl` (12px) |
| Badge / Pill | `rounded-full` |
| Modal | `rounded-3xl` (24px) |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-void` | `0 20px 50px rgba(0,0,0,0.8)` | Elevated cards |
| Primary button | `0 8px 32px -8px rgba(0,82,255,0.5)` | CTA emphasis |
| Modal backdrop | `bg-black/75 backdrop-blur-sm` | Overlay dimming |

---

## Component Conventions

### Button

Variants: `primary` | `secondary` | `ghost` | `danger`

| Variant | Background | Border | Text |
|---------|-----------|--------|------|
| primary | `#0052FF` | `white/10` | white |
| secondary | `zinc-900/40` | `zinc-700` | `zinc-300` |
| ghost | transparent | none | `zinc-400` |
| danger | `red-500/10` | `red-500/20` | `red-200` |

States: `hover` (lighter bg, stronger shadow) → `active` (scale 0.99) → `focus-visible` (2px ring) → `disabled` (opacity 0.55, no pointer) → `loading` (spinner replaces icon, text changes to gerund)

Sizes: `default` (48px min-height) | `compact` (36px) | `lg` (56px)

### Card

```
bg-vault-card/40 border border-white/[0.06] rounded-2xl backdrop-blur-sm
```

Nested micro-panels:
```
rounded-xl border border-white/4 bg-white/[0.01]
```

### Modal

- Background: `bg-[#0d0d0f]/95 backdrop-blur-2xl border border-white/[0.06] rounded-3xl`
- Overlay: `bg-black/75 backdrop-blur-sm`
- Focus trap: Tab cycles within modal
- Close: Escape key + backdrop click + X button
- ARIA: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Animation: fade + scale-in, respects `prefers-reduced-motion`

### Alert (inline feedback)

| Type | Border | Background | Icon color |
|------|--------|-----------|------------|
| success | `emerald-500/20` | `emerald-500/5` | `emerald-400` |
| warning | `amber-500/20` | `amber-500/5` | `amber-400` |
| error | `red-500/20` | `red-500/5` | `red-400` |
| info | `brand-primary/20` | `brand-primary/6` | `brand-accent` |

### Step Indicator

Horizontal stepper for multi-step flows.

States per step: `pending` (muted) → `active` (brand color, pulse) → `complete` (emerald check)

Visual: circle + label, connected by lines. Completed lines are solid, pending lines are dashed/muted.

---

## Motion

### Defaults

| Property | Value |
|----------|-------|
| Duration (UI feedback) | 150–200ms |
| Duration (page transition) | 200–300ms |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` |

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Framer Motion components should use `useReducedMotion()` to skip animate variants.

---

## Accessibility Checklist

- [ ] Every interactive element is keyboard-reachable
- [ ] Focus indicators are visible (`focus-visible` ring)
- [ ] Modals trap focus and have `role="dialog"`
- [ ] Form inputs have associated `<label>` elements
- [ ] Error messages use `role="alert"` or `aria-live`
- [ ] Icon-only buttons have `aria-label`
- [ ] Color contrast meets WCAG AA (4.5:1 for text, 3:1 for large text)
- [ ] Animations respect `prefers-reduced-motion`
