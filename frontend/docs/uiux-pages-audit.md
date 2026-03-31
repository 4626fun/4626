# UI/UX Pages Audit — 4626 (4626.fun)

> Audit date: 2026-02-26
> Stack: Vite + React 19 + TypeScript, Tailwind CSS v4, framer-motion, lucide-react, wagmi/viem, Privy, @tanstack/react-query
> Theme sources: `tailwind.config.js`, `src/index.css`, `src/lib/theme.tsx`, `docs/design-system.md`

---

## Cross-Cutting Issues

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| X1 | No shared primitive components (Button, Input, Card, Alert, Skeleton, Spinner, Badge, Modal) — every page reimplements inline Tailwind | P0 | All 4 pages |
| X2 | No toast/notification system — zero global feedback layer for transactions, errors, or success | P0 | All 4 pages |
| X3 | No `AccountModeIndicator` — users never know if they are acting as EOA or Smart Wallet | P0 | All 4 pages |
| X4 | Accessibility: no generic focus trap in modals/sheets, no `aria-live` for transaction status, icon-only buttons lack `aria-label` | P0 | All 4 pages |
| X5 | No `prefers-reduced-motion` guard on framer-motion animations | P1 | All 4 pages |
| X6 | Inconsistent loading states: some pages use "Loading…" text, others show partial skeletons, others show nothing | P1 | All 4 pages |
| X7 | Inconsistent error handling: some queries show errors inline, others fail silently | P1 | Portfolio, Vault |

---

## Swap Page (`src/pages/Swap.tsx` + `src/components/trade/`)

### P0 — Blocking / Confusing

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| S1 | Raw contract errors and RPC errors surfaced verbatim — "execution reverted", long hex strings — not translated to user language | `Swap.tsx`, `useSwapExecution.ts` | Parse error codes → human-readable messages: "Insufficient balance", "Switch to Base", "Transaction rejected", "Network error — retry" |
| S2 | "Fallback active" badge is cryptic — users don't know why Smart Wallet is unavailable or what to do | `SwapPanel.tsx` | Replace with `Alert` component: "Smart Wallet unavailable — using connected wallet" |
| S3 | Permit signature banners use technical copy ("permit2 signature required") without explaining what it means | `Swap.tsx` | Rewrite copy: "One-time token approval needed — no gas required" |
| S4 | All error states look the same — insufficient balance, chain mismatch, user rejection, RPC failure are visually indistinguishable | `Swap.tsx` | Differentiate with icons + actionable copy per error type |

### P1 — Polish / Consistency

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| S5 | No `AccountModeIndicator` — swap mode switching is buried in `WalletModeToggle` only | `Swap.tsx` | Add `AccountModeIndicator` near execution bar |
| S6 | Action buttons are inline Tailwind — no consistent disabled/loading state | `Swap.tsx`, `SwapPanel.tsx` | Migrate to `Button` primitive |
| S7 | Quote loading shows blank output slot — no skeleton during fetch | `TokenAmountSurface.tsx` | Add `Skeleton` rows in output area during quote fetch |
| S8 | Settings sheet inputs are unstyled HTML inputs — no label/error/helper text pattern | `SwapSettingsModal.tsx` | Migrate to `Input` primitive with slippage warning `Alert` |
| S9 | Mobile: sticky CTA at `bottom-[calc(env(safe-area-inset-bottom)+4.35rem)]` may overlap on small viewports | `Swap.tsx` | Test and adjust safe area calculation |

### P2 — Nice-to-Have

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| S10 | Route comparison card copy is terse — users don't know what "compare routes" means | `RouteCompareCard.tsx` | Improve labels and tooltip copy |
| S11 | No `prefers-reduced-motion` on slide-up/scale-in animations for settings/confirm modals | `SwapConfirmModal.tsx`, `SwapSettingsModal.tsx` | Wrap animations in `useReducedMotion()` guard |

---

## Vault Page (`src/pages/Vault.tsx`)

### P0 — Blocking / Confusing

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| V1 | Failed `approve`/`deposit`/`withdraw` transactions produce zero visible feedback — error is caught but not surfaced to the user | `Vault.tsx` lines ~620–700 | Add `onError` to `useWriteContract` + `Alert` + sonner toast |
| V2 | Stats grid shows bare `—` for APY/Global Jackpot/Trade Fee with no skeleton or context — looks broken | `Vault.tsx` stats grid | Wrap in `Skeleton` during load; show `—` only after confirmed unavailable with tooltip "Data not yet available" |
| V3 | Amount input has no validation — accepts negative numbers, excessive decimals, amounts exceeding balance silently | `Vault.tsx` deposit/withdraw form | Add validation: non-negative, max decimals from contract, balance check with inline error |
| V4 | Balances do not refresh after successful deposit/withdraw — user sees stale numbers | `Vault.tsx` | Call `queryClient.invalidateQueries` + wagmi `refetch` on `onSuccess` |

### P1 — Polish / Consistency

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| V5 | No `AccountModeIndicator` — Vault uses EOA-only flow with no CSW awareness | `Vault.tsx` | Add indicator + non-blocking nudge for EOA users: "Switch to Smart Wallet for 1-click deposits" |
| V6 | Contract read loading states show nothing — balance panels appear blank during initial load | `Vault.tsx` | Add `Skeleton` rows during `isLoading` for balances |
| V7 | No post-success state — after a successful deposit the page just resets with no confirmation | `Vault.tsx` | Show inline success card: "Deposit confirmed — your position has been updated" |
| V8 | Chat card "Open Chat" is incomplete (comment: "for now we just connect") but shows as active CTA | `VaultChatCard` | Style as "Coming soon" with a tooltip |

### P2 — Nice-to-Have

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| V9 | Auction panel "not available" message has no guidance | `CcaAuctionPanel.tsx` | Add context: "Auction activates once vault reaches minimum TVL" |
| V10 | Mobile deposit/withdraw form is cramped — amount input and action button stack awkwardly | `Vault.tsx` | Improve spacing, full-width input on mobile |

---

## Portfolio Page (`src/pages/Portfolio.tsx`)

### P0 — Blocking / Confusing

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| P1 | All three data queries (`portfolioQuery`, `tokenListQuery`, `zoraCoinsQuery`) use `retry: 0` with no error UI — blank table with no feedback | `Portfolio.tsx` | Add `onError` handlers + `Alert error` + retry button |
| P2 | `nfts` and `activity` tabs render placeholder text with no explanation or CTA — looks broken | `Portfolio.tsx` tabs | Replace with "Coming soon" empty state with relevant CTAs (Swap/Vault) |
| P3 | Send/Receive/Buy/More action buttons are disabled (`disabled` attr) with no tooltip or explanation — appear non-functional | `Portfolio.tsx` lines ~730–760 | Add `title="Coming soon"` tooltip or hide buttons; never show dead buttons |

### P1 — Polish / Consistency

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| P4 | `AccountModeIndicator` absent — portfolio reflects balances for an address but not the active execution mode | `Portfolio.tsx` | Add indicator near wallet/address section |
| P5 | Token table shows "Loading balances…" text — no skeleton that matches final layout | `Portfolio.tsx` `TokensTable` | Replace with `Skeleton` rows matching row height |
| P6 | Token table has no mobile-friendly layout — `grid-cols-[minmax(0,1fr)_92px_92px_104px]` overflows on small screens | `Portfolio.tsx` `TokensTable` | Stacked card layout on < `sm` breakpoint |
| P7 | No empty state when user has no positions | `Portfolio.tsx` | Show "Start here" CTA cards (Swap, Vault) with brief descriptions |

### P2 — Nice-to-Have

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| P8 | Sparkline uses seeded pseudo-random data — not real price history; no label to indicate this | `Portfolio.tsx` `seededSeries` | Add "Simulated" badge on chart or replace with flat line |
| P9 | No pagination or "show more" for large token lists | `Portfolio.tsx` | Soft "Show more" button after N rows |

---

## Account Page (`src/pages/AccountSettings.tsx`)

### P0 — Blocking / Confusing

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| A1 | Loading state shows plain "Loading account…" text — no skeleton that communicates structure | `AccountSettings.tsx` line ~1039 | Full-page skeleton layout matching the card structure |
| A2 | CSW resolution failures (multiple fallback paths) produce no clear user guidance | `AccountSettings.tsx` lines ~519–555 | Show `Alert error`: "Could not load Smart Wallet details — try reconnecting" |
| A3 | Owner revocation has no confirmation step — one click irrevocably removes an owner | `AccountSettings.tsx` | Confirmation `Modal`: "Remove this owner? This can't be undone without adding it back." |

### P1 — Polish / Consistency

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| A4 | No `AccountModeIndicator` hero section — Account page should be the primary place to see and switch execution mode | `AccountSettings.tsx` | Add `AccountModeIndicator` as prominent hero section at top |
| A5 | 1,510-line monolith — no sub-components; impossible to maintain | `AccountSettings.tsx` | Extract: `WalletSection`, `OwnersSection`, `IdentitySection`, `NotificationsSection`, `DangerZone` |
| A6 | All form elements are raw HTML — inconsistent labels, no error states, no helper text | `AccountSettings.tsx` | Migrate to `Input`, `Button` primitives |

### P2 — Nice-to-Have

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| A7 | Advanced wallet details (owner slots, provider labels) shown by default — overwhelming for non-technical users | `AccountSettings.tsx` | Collapse behind "Show advanced" toggle |

---

## Accessibility Issues Summary

| Page | Issue | Fix |
|------|-------|-----|
| All | Modal/sheet components lack focus trap — Tab key escapes overlay | Add focus trap (manual or `focus-trap-react`) |
| All | Transaction status updates not announced to screen readers | Add `aria-live="polite"` region |
| All | Icon-only buttons (copy, flip, settings) lack accessible name | Add `aria-label` to each |
| Swap | Token selector search input has no visible label | Add `<label>` or `aria-label` |
| Vault | Deposit/Withdraw tab buttons lack `aria-selected` | Add ARIA tab pattern |
| Account | Revoke button lacks accessible description | Add `aria-description` |

---

## Mobile Issues Summary

| Page | Issue |
|------|-------|
| Swap | Sticky CTA may overlap input on very small screens; settings sheet height needs testing |
| Vault | Deposit form cramped on 375px; stats grid overflows on 320px |
| Portfolio | Token table overflows horizontally on mobile; no stacked layout |
| Account | Dense wallet address rows overflow on 375px; action buttons too small (< 44px touch target) |
