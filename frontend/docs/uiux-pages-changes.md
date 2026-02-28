# UI/UX Pages Changes — 4626 (4626.fun)

> Changelog tracking what changed, why it's better, and any follow-ups.
> Updated during implementation.

---

## Phase 2 — Shared Primitives

### `src/components/ui/Button.tsx` (new)
**What changed**: Created a `Button` primitive with `primary`, `secondary`, `ghost`, `destructive` variants; `sm`/`md`/`lg` sizes; inline `Spinner` on `loading`; proper `disabled` styling and `focus-visible` ring.
**Why better**: Previously every page had inline Tailwind button classes with inconsistent disabled/loading states. Now there is a single source of truth.

### `src/components/ui/Input.tsx` (new)
**What changed**: Created an `Input` primitive with `label`, `helperText`, `error`, and optional `rightSlot` (for "Max" buttons).
**Why better**: Form inputs across Vault, Swap settings, and Account had no labels, no error states, and no consistent sizing.

### `src/components/ui/Card.tsx` (new)
**What changed**: Created a `Card` wrapper component using the existing `.card` and `.glass-card` CSS classes.
**Why better**: Eliminates duplicated class strings and makes variant changes (glass vs default) a one-word change.

### `src/components/ui/Alert.tsx` (new)
**What changed**: Created an `Alert` component with `info`, `warning`, `error`, `success` variants, optional title, dismiss button, and action CTA.
**Why better**: Previously Vault, Swap, and Account used ad-hoc colored `<div>` blocks with inconsistent styles, icons, and behavior.

### `src/components/ui/Skeleton.tsx` (new)
**What changed**: Created a `Skeleton` component that respects `prefers-reduced-motion`.
**Why better**: Loading states previously showed plain text ("Loading…") or nothing. Skeletons communicate structure during load and prevent layout shift.

### `src/components/ui/Spinner.tsx` (new)
**What changed**: Created a `Spinner` with `sm`/`md`/`lg` sizes using brand blue.
**Why better**: Loading indicators were inconsistent — some used `Loader2` from lucide, some used custom CSS, some showed nothing.

### `src/components/ui/Badge.tsx` (new)
**What changed**: Created a `Badge` primitive with semantic variants including `canonical` (Smart Wallet) and `eoa`.
**Why better**: Status pills were scattered inline Tailwind spans with inconsistent colors and sizes.

### `src/components/ui/Modal.tsx` (new)
**What changed**: Created a generic `Modal` with focus trap, Escape-to-close, `aria-modal`, backdrop blur, and framer-motion `scaleIn` animation (with `prefers-reduced-motion` fallback).
**Why better**: Existing modals (SwapConfirmModal, SwapSettingsSheet) had no focus trap and no consistent aria structure. The owner revocation flow in Account had no confirmation modal at all.

### `src/components/ui/AccountModeIndicator.tsx` (new)
**What changed**: Created a compact pill component showing "Acting as: Smart Wallet / EOA" + "1-click available / Limited mode" using `useCanonicalWallet` and `walletMode.ts`.
**Why better**: Users previously had no persistent, visible indication of which execution mode was active. Features appeared/disappeared without explanation.

### `App.tsx` (modified)
**What changed**: Added `<Toaster />` from `sonner` to the app root.
**Why better**: Provides a global notification layer for transaction outcomes, errors, and success messages across all pages.

---

## Phase 3A — Swap Page

### `src/pages/Swap.tsx` (modified)
- **Error translation**: Raw contract/RPC errors are now mapped to human-readable messages.
- **AccountModeIndicator**: Added near the execution bar.
- **Button migration**: Action buttons use `Button` primitive.
- **Permit banner copy**: Rewritten to plain English.

### `src/components/trade/SwapPanel.tsx` (modified)
- **Fallback alert**: "Fallback active" badge replaced with `Alert` explaining what's happening.

### `src/components/trade/TokenAmountSurface.tsx` (modified)
- **Quote skeleton**: Added `Skeleton` rows in output slot during quote fetch.

### `src/components/trade/SwapSettingsSheet.tsx` (modified)
- **Input migration**: Slippage inputs use `Input` primitive.
- **Slippage warning**: Uses `Alert` for high-slippage warnings.

### `src/components/trade/TransactionLifecycle.tsx` (modified)
- **aria-live**: Added `aria-live="polite"` region for screen reader announcements.

---

## Phase 3B — Vault Page

### `src/pages/Vault.tsx` (modified)
- **Transaction errors**: `onError` handlers added; errors surface via `Alert` + toast.
- **Balance refresh**: `queryClient.invalidateQueries` after successful deposit/withdraw.
- **Amount validation**: Non-negative, max decimals, balance check with inline error.
- **Stats skeletons**: `Skeleton` components replace bare `—` during load.
- **AccountModeIndicator**: Added near action buttons with non-blocking CSW nudge.
- **Contract read skeletons**: Balance panels show Skeletons during `isLoading`.
- **Post-success card**: Success confirmation shown after deposit/withdraw.

---

## Phase 3C — Portfolio Page

### `src/pages/Portfolio.tsx` (modified)
- **Error UI**: All queries show `Alert error` + retry button on failure.
- **Dead tabs**: `nfts` and `activity` tabs show "Coming soon" empty state with CTAs.
- **Disabled buttons**: Action buttons have `title="Coming soon"` tooltip.
- **AccountModeIndicator**: Added near wallet section.
- **Skeleton rows**: `TokensTable` shows skeleton rows during load.
- **Mobile table**: Stacked card layout on `< sm` breakpoint.
- **Empty state**: "Start here" CTA cards when no positions.

---

## Phase 3D — Account Page

### `src/pages/AccountSettings.tsx` (modified)
- **Loading skeleton**: Full-page skeleton during `isLoading`.
- **CSW failure**: `Alert error` with reconnect guidance on resolution failure.
- **Revocation modal**: Confirmation `Modal` before executing owner revoke.
- **AccountModeIndicator**: Hero section at page top.
- **Sub-components**: Extracted `WalletSection`, `OwnersSection`, `IdentitySection`, `NotificationsSection`.
- **Form primitives**: Email input and settings forms use `Input`, `Button` primitives.

---

## Follow-Ups (Post-Revamp)

- [ ] **Real sparkline data**: Replace `seededSeries` with Zora/Debank price history API when available.
- [ ] **Portfolio pagination**: Add virtual scrolling or "Show more" for large token lists.
- [ ] **Vault auction guidance**: Add specific TVL threshold copy once product defines it.
- [ ] **Chat card completion**: Replace "Coming soon" with functional XMTP chat flow.
- [ ] **Light mode**: Theme toggle currently disabled — re-enable when light tokens are finalized.
- [ ] **Account `Show advanced` toggle**: Further declutter with collapsible advanced wallet details.
- [ ] **E2E tests**: Add Playwright tests for Swap approval flow and Vault deposit flow.
