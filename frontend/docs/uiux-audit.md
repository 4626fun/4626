# UI/UX Audit — 4626 (4626.fun)

> Generated 2026-02-25. Source of truth for theme tokens: `tailwind.config.js` + `src/index.css`.
>
> Historical note (2026-03-20): this audit predates the email-first account-model reset. Any references below to wallet-first signup copy or "Zora canonical wallet" phrasing are superseded by [account-auth-invariants.md](account-auth-invariants.md).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + Vite 7 + TypeScript |
| Styling | Tailwind CSS v4 (utility-first) + CSS custom properties |
| Animation | Framer Motion |
| Routing | React Router v7 |
| Auth | Privy (embedded EOA) + SIWE + Farcaster AuthKit |
| Web3 | Wagmi + Viem (Base chain) |
| Icons | Lucide React |
| Fonts | Inter / Space Grotesk / JetBrains Mono / Doto |
| Theme | Dark mode enforced (`src/lib/theme.tsx`) |

### Token file locations

- **Tailwind config**: `tailwind.config.js` — colors, fonts, animations, shadows
- **CSS variables**: `src/index.css` — `--vault-*`, `--brand-primary`, `--privy-*`
- **Theme context**: `src/lib/theme.tsx` — React context (dark enforced)
- **Design docs**: `DESIGN_SYSTEM.md`, `docs/design-system.md`

---

## Severity Scale

- **S0 — Blocker**: prevents completion of the primary flow (waitlist join)
- **S1 — Major**: causes confusion, drop-off, or accessibility failure
- **S2 — Minor**: inconsistency, polish, or secondary screen issue

---

## Top 10 Issues (cross-screen)

| # | Sev | Screen | Issue | File(s) |
|---|-----|--------|-------|---------|
| 1 | S1 | Waitlist | Stepper bar ("CONNECT → RESERVE SPOT → BOOST RANK → DEPLOY") is purely decorative — steps don't map to user actions and can't be clicked. Creates false expectation of multi-step flow. | `steps/VerifyStep.tsx`, `WaitlistFlow.tsx` |
| 2 | S1 | Waitlist | "Wallet sign-in is unavailable. Try another way." error appears on fresh load before user attempts anything, eroding trust. | `steps/VerifyStep.tsx` (line ~719–723) |
| 3 | S1 | Waitlist | Modal has no focus trap — Tab key escapes modal to background content. Missing `role="dialog"`, `aria-modal="true"`, and return-focus-on-close. | `WaitlistModal.tsx` |
| 4 | S1 | All | No `prefers-reduced-motion` media query — all Framer Motion and CSS animations run unconditionally. | `index.css`, all motion components |
| 5 | S2 | Waitlist | Auto-submit after wallet verify has no visible progress or "what's happening" messaging — screen just jumps from verify to done. | `WaitlistFlow.tsx` (~autoSubmit logic) |
| 6 | S2 | All | Buttons defined only as CSS classes (`.btn-primary`, `.btn-secondary`) — no React component with loading/disabled/icon props. Every call-site reimplements states. | `index.css` lines 105–202 |
| 7 | S2 | All | Typography sizes are hardcoded (`text-[12px]`, `text-[13px]`, `text-[9px]`) instead of a consistent scale. Same semantic level uses different sizes across screens. | Throughout `src/` |
| 8 | S2 | All | No Toast/notification system — success/error feedback is inline only, inconsistent placement, and disappears on navigation. | N/A (missing) |
| 9 | S2 | Waitlist | Email input has no `<label>` element (only visual label via text), failing a11y. | `steps/VerifyStep.tsx` lines 294–305, 683–695 |
| 10 | S2 | Layout | Mobile bottom nav icons lack `aria-label` and don't indicate current route to screen readers. | `Layout.tsx` lines 29–34 |

---

## By Screen

### 1. Waitlist (P0)

**Components**: `WaitlistModal.tsx`, `WaitlistFlow.tsx`, `WaitlistFlowWithProviders.tsx`, `steps/VerifyStep.tsx`, `steps/DoneStep.tsx`

#### Flow structure
Current steps: `'persona' | 'verify' | 'email' | 'done'` — in practice only `verify → done`.

| Issue | Severity | Detail |
|-------|----------|--------|
| Decorative stepper bar misleads | S1 | Shows 4 steps but flow is effectively 2. Users don't know where they are. |
| "Wallet sign-in is unavailable" on load | S1 | Shown when `showPrivy` is false — before user attempts login. Looks like an error. |
| No focus trap in modal | S1 | Tab key reaches page behind modal. |
| Missing `role="dialog"` / `aria-modal` | S1 | Screen readers don't announce modal context. |
| Auto-submit has no progress UX | S2 | After wallet verify, background API call fires but user sees no intermediate state. `simpleVerifiedMode` checklist exists but isn't the default path for all users. |
| Error messages are technical | S2 | "ERC-1271 signature confirmed on Base" means nothing to non-technical users. |
| Email field lacks `<label>` | S2 | Only decorative label text, no `htmlFor` / `id` association. |
| No "back" or "reset" button | S2 | If wallet verify fails, user has no clear way to restart. |
| Loading fallback for lazy component is plain text | S2 | "Loading waitlist…" text only — no skeleton or spinner. |
| CSW mismatch message is jargon-heavy | S2 | "The connected wallet doesn't match your creator profile" is still too vague without clearer recovery guidance. |

#### Good patterns to keep
- One-tap "Sign up" CTA as primary action
- Auto-progression after verification (reduces steps)
- Zora sync info banner is a nice trust signal
- Creator coin card with key metrics is well-designed
- "Need help?" sheet with actionable troubleshooting

### 2. Swap (P1)

**Components**: `pages/Swap.tsx`, `components/trade/SwapPanel.tsx`, `SwapConfirmModal.tsx`, `SwapSettingsModal.tsx`, `TransactionLifecycle.tsx`

| Issue | Severity | Detail |
|-------|----------|--------|
| No empty state when not connected | S2 | Swap form renders but inputs are non-functional without wallet. |
| Settings sheet lacks focus trap | S2 | Same modal pattern issue as waitlist. |
| Token selector needs keyboard nav | S2 | Token list is scrollable but not keyboard-navigable. |
| Swap confirm modal should explain gas/fees in plain terms | S2 | Shows raw values without context. |

### 3. Vault (P2)

**Components**: `pages/Vault.tsx`, `components/cca/CcaAuctionPanel.tsx`

| Issue | Severity | Detail |
|-------|----------|--------|
| Dense information without hierarchy | S2 | All data shown at once — no progressive disclosure. |
| Auction panel terms are unexplained | S2 | "CCA", "clearing price" need inline definitions. |
| No loading skeleton for vault data | S2 | Content pops in without transition. |

### 4. Portfolio (P2)

**Components**: `pages/Portfolio.tsx`

| Issue | Severity | Detail |
|-------|----------|--------|
| Empty state when no assets | S2 | No guidance on what to do next. |
| Table not responsive on mobile | S2 | Horizontal scroll with no indicator. |

### 5. Account (P2)

**Components**: `pages/AccountSettings.tsx`

| Issue | Severity | Detail |
|-------|----------|--------|
| Settings page structure is flat | S2 | All settings in one scrollable list — no sections or grouping. |
| No confirmation for destructive actions | S2 | Disconnect wallet has no "are you sure?" step. |

---

## Accessibility Summary

| Category | Status | Notes |
|----------|--------|-------|
| Keyboard navigation | Partial | Escape closes modal, but no focus trap. Nav items focusable. |
| Screen reader | Needs work | Missing dialog roles, ARIA labels on icon buttons, form labels. |
| Color contrast | Mostly OK | `text-zinc-500` on `bg-vault-bg` (dark) may fail AA for small text. |
| Reduced motion | Missing | No `prefers-reduced-motion` handling anywhere. |
| Focus indicators | Good | `.btn-primary:focus-visible` and `.btn-secondary:focus-visible` defined. |
| Semantic HTML | Partial | Good use of `<button>` vs `<a>`. Forms need proper label association. |
