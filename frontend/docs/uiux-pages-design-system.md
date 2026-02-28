# UI/UX Design System Rules — 4626 (4626.fun)

> Source of truth for shared primitives used across Swap, Vault, Portfolio, and Account pages.
> Token values are never invented here — they are sourced from `tailwind.config.js` and `src/index.css`.

---

## Philosophy

- **Glass & Steel**: Dark backgrounds, electric blue accents, glassmorphism surfaces. Already documented in `design-system.md`.
- **Premium Minimalism**: Remove chrome, not content. Every element must earn its place.
- **Progressive Disclosure**: Show the most important information first; details on demand.
- **Uniswap-like Structure**: Maintain familiar swap-centric layout. Don't redesign, polish.

---

## Typography

| Class/Usage | Tailwind | When to Use |
|-------------|----------|-------------|
| Page title | `text-2xl sm:text-3xl font-light tracking-tight text-vault-text` | H1 of each page |
| Section title | `text-base font-medium text-vault-text` | Card/section headers |
| Body | `text-sm font-light text-vault-text` (default body weight is 300) | General content |
| Caption / label | `.label` → `text-[9px] uppercase tracking-[0.2em] text-vault-subtext font-medium` | Data labels, stat headings |
| Monospace numbers | `.mono` → `font-mono tabular-nums` | Addresses, amounts, prices |
| Value / numeric | `.value` → `font-light tabular-nums text-vault-text` | Token amounts |

**Font families:**
- Primary: `font-sans` (Inter) — UI text
- Display: `font-display` (Space Grotesk) — page titles, brand moments
- Mono: `font-mono` (JetBrains Mono) — addresses, tx hashes, amounts

---

## Color Tokens

All colors from `tailwind.config.js` and CSS variables in `src/index.css`.

| Token | Value | Usage |
|-------|-------|-------|
| `vault-bg` | `rgb(2,2,2)` (dark) | Page background |
| `vault-card` | `rgb(10,10,10)` (dark) | Card/panel background |
| `vault-border` | `rgba(255,255,255,0.08)` (dark) | Card borders |
| `vault-text` | `rgb(237,237,237)` (dark) | Primary text |
| `vault-subtext` | `rgb(102,102,102)` (dark) | Secondary text, labels |
| `brand-primary` | `#0052FF` | Primary CTAs, focus rings |
| `brand-hover` | `#004AD9` | Button hover |
| `brand-accent` | `#3B82F6` | Secondary accents |
| `signal-cyan` | `#06b6d4` | Info states |
| `signal-pulse` | `#22d3ee` | Info hover |
| `copper-bright` | `#f59e0b` | Warning states |
| `magma-mint` | `#00ffa3` | Success states |

**Semantic status colors:**
- Success: `text-emerald-400 bg-emerald-400/10 border-emerald-400/20`
- Warning: `text-amber-400 bg-amber-400/10 border-amber-400/20`
- Error: `text-rose-400 bg-rose-400/10 border-rose-400/20`
- Info: `text-cyan-400 bg-cyan-400/10 border-cyan-400/20`
- Neutral: `text-zinc-400 bg-zinc-400/10 border-zinc-400/20`

---

## Spacing

Tailwind default scale. Common patterns in this app:

| Context | Value |
|---------|-------|
| Page horizontal padding (mobile) | `px-4` |
| Page horizontal padding (desktop) | `sm:px-6` |
| Card padding | `p-4 sm:p-6` |
| Section gap | `gap-4` or `gap-6` |
| Between label and value | `gap-1` or `gap-2` |
| Input height | `h-11` (44px — minimum touch target) |
| Button height | `h-11` (44px — minimum touch target) |

---

## Border Radius

| Context | Value |
|---------|-------|
| Cards / panels | `rounded-2xl` |
| Inputs | `rounded-xl` |
| Buttons | `rounded-xl` |
| Pills / badges | `rounded-full` |
| Small chips | `rounded-lg` |

---

## Shadows

From `tailwind.config.js`:
- Card depth: `shadow-void` (`0 20px 50px rgba(0,0,0,0.8)`)
- Brand glow: `shadow-[0_0_20px_rgba(0,82,255,0.3)]`
- Cyan accent: `shadow-glow-cyan`

---

## Component Primitives (`src/components/ui/`)

### Button

```tsx
// Variants: primary | secondary | ghost | destructive
// Sizes: sm | md | lg
// States: loading (inline Spinner), disabled
<Button variant="primary" size="md" loading={isBusy}>Swap</Button>
```

Rules:
- Minimum height `h-11` (44px) for touch targets
- Show `Spinner` when `loading` is true; disable interaction
- Never remove a button from DOM during loading — replace content with spinner
- `disabled` state: `opacity-50 cursor-not-allowed`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1`

### Input

```tsx
// Props: label, helperText, error, maxButton (optional slot)
<Input label="Amount" helperText="Balance: 1.23 ETH" error="Exceeds balance" />
```

Rules:
- Always include a visible `<label>` (not just `placeholder`)
- Error message displayed below input in `text-rose-400 text-xs`
- Height `h-11` for single-line; auto for multi-line
- Focus: `focus:ring-2 focus:ring-brand-primary`

### Card

```tsx
// Variants: default (`.card`) | glass (`.glass-card`)
<Card variant="glass">...</Card>
```

Rules:
- Use `.card` class from `index.css` as base
- Prefer `glass-card` for top-level panels (swap panel, vault panel)
- Always `rounded-2xl`

### Alert

```tsx
// Variants: info | warning | error | success
<Alert variant="warning" title="High price impact" onDismiss={...}>
  Your trade will move the price by 3.2%. Consider reducing the amount.
</Alert>
```

Rules:
- Include an icon (lucide-react): Info, AlertTriangle, XCircle, CheckCircle2
- Title is bold, description is normal weight
- Optional `onDismiss` renders an X button
- Optional `action` prop for inline CTA (e.g., "Retry", "Switch network")

### Skeleton

```tsx
// Respects prefers-reduced-motion: no shimmer animation when motion is reduced
<Skeleton className="h-4 w-24 rounded" />
<Skeleton className="h-10 w-full rounded-xl" />
```

Rules:
- Use `bg-zinc-800` base with shimmer overlay
- `animate-shimmer` only when `!window.matchMedia('(prefers-reduced-motion: reduce)').matches`
- Match the exact shape/height of the content it replaces

### Spinner

```tsx
<Spinner size="sm" />  // 16px
<Spinner size="md" />  // 20px
<Spinner size="lg" />  // 24px
```

Rules:
- Use `brand-primary` color border with transparent base
- `animate-spin` (Tailwind default)
- Always pair with `aria-label="Loading"` or surrounding text

### Badge

```tsx
// Variants: default | success | warning | error | info | canonical | eoa
<Badge variant="canonical">Smart Wallet</Badge>
<Badge variant="eoa">EOA</Badge>
```

### Modal

```tsx
<Modal open={open} onClose={onClose} title="Confirm Revoke">
  <p>Are you sure?</p>
  <Modal.Footer>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button variant="destructive" onClick={onConfirm}>Revoke</Button>
  </Modal.Footer>
</Modal>
```

Rules:
- Focus trap: Tab key cycles within modal; Escape closes
- `aria-modal="true"` on overlay container
- `aria-labelledby` pointing to title element
- Backdrop: `bg-black/70 backdrop-blur-sm`
- Animation: `scaleIn` (0.3s) with `prefers-reduced-motion` fallback

### AccountModeIndicator

```tsx
<AccountModeIndicator />
// Shows: "Acting as: Smart Wallet" | "EOA" + "1-click available" | "Limited mode"
```

Rules:
- Always visible on Swap, Vault, Portfolio, Account pages
- Uses `useCanonicalWallet` hook + `walletMode.ts`
- Compact pill layout — never takes more than one line
- Smart Wallet: `Badge variant="canonical"` + green dot
- EOA: `Badge variant="eoa"` + neutral dot
- AA available: show "1-click" label
- Clicking opens Account page or a tooltip explaining the modes

---

## Transaction UX Pattern

All transaction flows follow this state machine:

```
idle → review → signing → pending → success
                        ↘ error → retry / cancel
```

| State | Visual | Copy |
|-------|--------|------|
| `idle` | Normal CTA button | "Swap", "Deposit", "Withdraw" |
| `review` | Modal/drawer open | Summary of what will happen |
| `signing` | Button loading + status text | "Waiting for wallet…" |
| `pending` | Hash link + spinner | "Transaction submitted — confirming on Base" |
| `success` | Green check + hash link | "Done — [action] complete" |
| `error` | Red alert | Human-readable error + retry action |

Error messages translation table:
| Raw condition | User copy |
|---------------|-----------|
| `insufficient_funds` | "Not enough ETH for gas. Add ETH to continue." |
| `user rejected` / `ACTION_REJECTED` | "Transaction cancelled." |
| `chain mismatch` / wrong chain | "Switch to Base to continue. [Switch network]" |
| Allowance error | "Token approval needed. [Approve]" |
| `UNPREDICTABLE_GAS_LIMIT` | "Transaction may fail — check your balance and try again." |
| RPC timeout / network error | "Network error — please try again. [Retry]" |
| Unknown contract revert | "Transaction failed. Check the details and try again." |

---

## Motion Rules

- All framer-motion animations must check `prefers-reduced-motion`:
  ```tsx
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const variants = prefersReducedMotion ? {} : { hidden: {...}, visible: {...} }
  ```
- Max animation duration: 300ms for UI interactions, 500ms for page transitions
- No looping animations on core content (only allowed on brand/marketing elements)
- Loading spinners are exempt from the motion rule

---

## Accessibility Checklist

For every interactive component:
- [ ] Keyboard accessible (Tab, Enter/Space, Escape)
- [ ] Visible focus ring (`focus-visible:ring-2 focus-visible:ring-brand-primary`)
- [ ] Minimum 44×44px touch target
- [ ] `aria-label` on icon-only buttons
- [ ] `aria-live="polite"` on status regions (transaction state, error messages)
- [ ] `aria-modal="true"` on modal overlays
- [ ] `aria-busy="true"` on loading sections
- [ ] Color is never the only means of conveying information

---

## Responsiveness Rules

| Breakpoint | Width | Patterns |
|------------|-------|---------|
| Default (mobile) | 0–639px | Single column, full-width inputs, no multi-column tables |
| `sm` | 640px+ | Two-column layouts, horizontal tabs |
| `md` | 768px+ | Desktop nav, sticky elements switch to inline |
| `lg` | 1024px+ | Multi-column grid, expanded panels |

Tables on mobile: always use stacked card layout, never horizontal scroll.
Action buttons: always `w-full` on mobile, `w-auto` on `sm+`.
