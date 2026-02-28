# UI/UX Pages Implementation Plan — 4626 (4626.fun)

> Companion to `uiux-pages-audit.md`. Specifies what to build, why it matters, and which files are touched.

---

## Prioritized Backlog

### P0 — Correctness + Clarity + Transaction Flows

These must be done first. They represent broken or confusing states that block users.

| ID | Task | Expected UX Outcome | Files |
|----|------|---------------------|-------|
| P0-X1 | Create shared `Button` primitive | Consistent loading/disabled states everywhere | `src/components/ui/Button.tsx` |
| P0-X2 | Create shared `Alert` primitive | Uniform info/warn/error/success messaging | `src/components/ui/Alert.tsx` |
| P0-X3 | Create shared `Skeleton` primitive | Stable layout, no blank flashes during load | `src/components/ui/Skeleton.tsx` |
| P0-X4 | Add `sonner` toast infrastructure | Global notification layer for tx outcomes | `App.tsx`, `package.json` |
| P0-S1 | Translate Swap errors to human-readable messages | Users know exactly what went wrong and what to do | `src/pages/Swap.tsx`, `src/hooks/useSwapExecution.ts` |
| P0-S2 | Replace "Fallback active" badge with clear Alert | Users understand Smart Wallet is unavailable, not broken | `src/components/trade/SwapPanel.tsx` |
| P0-V1 | Add Vault transaction error surfacing | Failed transactions are never silent | `src/pages/Vault.tsx` |
| P0-V2 | Replace Vault `—` stats with Skeleton | Stats grid never looks broken | `src/pages/Vault.tsx` |
| P0-V3 | Add Vault amount input validation | Users cannot enter invalid amounts | `src/pages/Vault.tsx` |
| P0-V4 | Refresh Vault balances after transactions | Balances always reflect latest state | `src/pages/Vault.tsx` |
| P0-P1 | Add Portfolio query error UI + retry | Users know when data failed and can recover | `src/pages/Portfolio.tsx` |
| P0-P2 | Fix Portfolio dead tabs with "Coming soon" states | No broken/empty tabs | `src/pages/Portfolio.tsx` |
| P0-P3 | Fix disabled Portfolio buttons | No dead buttons without explanation | `src/pages/Portfolio.tsx` |
| P0-A1 | Add Account page loading skeleton | Professional load state instead of blank | `src/pages/AccountSettings.tsx` |
| P0-A2 | Add CSW failure guidance Alert | Users know what to do when wallet resolution fails | `src/pages/AccountSettings.tsx` |
| P0-A3 | Add owner revocation confirmation Modal | Prevent accidental owner removal | `src/pages/AccountSettings.tsx` |

### P1 — Consistency Pass + Component Standardization

| ID | Task | Expected UX Outcome | Files |
|----|------|---------------------|-------|
| P1-X1 | Create `Input` primitive | Consistent form elements with labels/errors/helpers | `src/components/ui/Input.tsx` |
| P1-X2 | Create `Card` primitive | Uniform panel container | `src/components/ui/Card.tsx` |
| P1-X3 | Create `Spinner` primitive | Consistent loading indicator | `src/components/ui/Spinner.tsx` |
| P1-X4 | Create `Badge` primitive | Consistent status pills | `src/components/ui/Badge.tsx` |
| P1-X5 | Create `Modal` primitive with focus trap | Accessible modals across all pages | `src/components/ui/Modal.tsx` |
| P1-X6 | Create `AccountModeIndicator` component | All 4 pages show EOA/Smart Wallet status | `src/components/ui/AccountModeIndicator.tsx` |
| P1-X7 | Add `aria-live` region for transaction status | Screen readers announce tx outcomes | `src/components/trade/TransactionLifecycle.tsx` |
| P1-S5 | Add `AccountModeIndicator` to Swap page | Execution mode always visible | `src/pages/Swap.tsx` |
| P1-S6 | Migrate Swap buttons to `Button` primitive | Consistent interactive states | `src/pages/Swap.tsx`, `src/components/trade/` |
| P1-S7 | Add Skeleton to Swap quote loading | No blank output slot during fetch | `src/components/trade/TokenAmountSurface.tsx` |
| P1-S8 | Improve Swap settings `Input` + slippage `Alert` | Professional settings form | `src/components/trade/SwapSettingsSheet.tsx` |
| P1-V5 | Add `AccountModeIndicator` to Vault + CSW nudge | EOA users see upgrade path | `src/pages/Vault.tsx` |
| P1-V6 | Add Vault contract read Skeletons | Balance panels never appear blank | `src/pages/Vault.tsx` |
| P1-V7 | Add Vault post-success confirmation card | Users get clear confirmation of completed actions | `src/pages/Vault.tsx` |
| P1-P4 | Add `AccountModeIndicator` to Portfolio | Portfolio shows active execution context | `src/pages/Portfolio.tsx` |
| P1-P5 | Add Portfolio `Skeleton` rows | Professional load state matching final layout | `src/pages/Portfolio.tsx` |
| P1-P6 | Mobile-friendly Portfolio table layout | Table usable on 375px screens | `src/pages/Portfolio.tsx` |
| P1-P7 | Add Portfolio empty state with CTAs | New users have clear next steps | `src/pages/Portfolio.tsx` |
| P1-A4 | Add `AccountModeIndicator` hero to Account page | Account is the primary mode-switching surface | `src/pages/AccountSettings.tsx` |
| P1-A5 | Extract Account sub-components | Maintainable, scannable component tree | `src/pages/AccountSettings.tsx` |
| P1-A6 | Migrate Account form elements to primitives | Consistent form UX | `src/pages/AccountSettings.tsx` |

### P2 — Polish + Microinteractions + Copy

| ID | Task | Expected UX Outcome | Files |
|----|------|---------------------|-------|
| P2-S9 | Audit mobile safe-area on Swap CTA | No overlap on 375px | `src/pages/Swap.tsx` |
| P2-S10 | Improve route comparison copy | Users understand the experimental feature | `src/components/trade/RouteCompareCard.tsx` |
| P2-S11 | Add `prefers-reduced-motion` guards | Respects user accessibility preferences | All pages with framer-motion |
| P2-V8 | Vault chat "Coming soon" treatment | Chat card doesn't mislead users | `src/pages/Vault.tsx` |
| P2-V9 | Vault auction panel unavailable guidance | Contextual help instead of dead state | `src/components/cca/CcaAuctionPanel.tsx` |
| P2-P8 | Sparkline "Simulated" label | Honest data labeling | `src/pages/Portfolio.tsx` |
| P2-P9 | Portfolio "show more" for large lists | Performance + UX for power users | `src/pages/Portfolio.tsx` |
| P2-A7 | Account "Show advanced" toggle | Simplified default view | `src/pages/AccountSettings.tsx` |

---

## Implementation Order

```
Phase 2: Shared Primitives
  → Button, Alert, Skeleton (P0 unblocks pages)
  → sonner toast
  → Input, Card, Spinner, Badge, Modal, AccountModeIndicator (P1)

Phase 3A: Swap (best foundation, least risk)
  → P0 error translation, Alert usage
  → P1 AccountModeIndicator, Button migration, Skeleton, Input
  → P2 motion guards, mobile audit

Phase 3B: Vault (most missing states)
  → P0 error surfacing, balance refresh, validation, Skeleton stats
  → P1 AccountModeIndicator, contract read Skeletons, post-success card

Phase 3C: Portfolio (dead states)
  → P0 error UI, dead tab/button fixes
  → P1 AccountModeIndicator, Skeleton rows, mobile table, empty state

Phase 3D: Account (monolith refactor)
  → P0 Skeleton, CSW Alert, revocation Modal
  → P1 AccountModeIndicator, sub-component extraction, form primitives
```

---

## Non-Regression Checklist

Before any page edit:
- [ ] The page renders without console errors
- [ ] Existing happy-path flows are documented (what the flow does now)
- [ ] No contract logic, ABI, or hook core logic is modified
- [ ] No URL/route changes

After each page edit:
- [ ] `pnpm -C frontend lint` passes
- [ ] `pnpm -C frontend typecheck` passes (ignoring pre-existing errors in `tradingApi.checkDelegation.test.ts`)
- [ ] `pnpm -C frontend test` passes
- [ ] Page renders and primary action is reachable
