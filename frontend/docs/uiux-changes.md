# UI/UX Changes — 4626 (4626.fun)

> Changelog for the UI/UX improvement pass. Ordered by priority.
>
> Historical note (2026-03-20): this changelog predates the email-first account-model reset. Any copy diffs below that mention wallet-first signup or "Zora canonical wallet" wording should be read as historical, not current product guidance. See [account-auth-invariants.md](account-auth-invariants.md).

---

## Phase 1: Audit + Planning Docs

| Deliverable | Path |
|-------------|------|
| UI/UX Audit | `docs/uiux-audit.md` |
| Prioritized Plan | `docs/uiux-plan.md` |
| Design System Reference | `docs/uiux-design-system.md` |

---

## Phase 2: Shared UI Components (`src/components/ui/`)

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `Button` | `ui/Button.tsx` | Wraps `.btn-primary`/`.btn-secondary` with `variant`, `size`, `loading`, `icon` props. Eliminates copy-paste of loading spinners and disabled states. |
| `Modal` | `ui/Modal.tsx` | Accessible dialog with focus trap, `role="dialog"`, `aria-modal`, `aria-labelledby`, backdrop close, Escape close, and return-focus-on-close. Respects `prefers-reduced-motion`. |
| `StepIndicator` | `ui/StepIndicator.tsx` | Horizontal progress stepper with `pending`/`active`/`complete` states. Animated circle indicators connected by lines. Accessible via `<nav aria-label="Progress">` and `aria-current="step"`. |
| `Alert` | `ui/Alert.tsx` | Inline feedback component with `success`/`warning`/`error`/`info` variants. Uses `role="alert"` for screen reader announcement. Consistent border/bg/icon styling. |
| `Skeleton` | `ui/Skeleton.tsx` | Loading placeholder. `<Skeleton>` for blocks, `<SkeletonText>` for multi-line text. Includes `role="status"` and `aria-label="Loading"`. |

### Global CSS changes (`src/index.css`)

| Change | Why it's better |
|--------|-----------------|
| Added `prefers-reduced-motion` media query | All animations instantly complete for users who prefer reduced motion. Required for WCAG 2.1 AA compliance. |
| Added `.sr-only` utility class | Screen-reader-only text helper for accessibility. |

---

## Phase 3: Waitlist P0 Improvements

### WaitlistModal.tsx

| Before | After | Why it's better |
|--------|-------|-----------------|
| Custom modal with no focus trap | Uses `<Modal>` component with focus trap, ARIA, reduced motion | Tab key stays inside modal. Screen readers announce dialog. |
| Plain "Loading waitlist…" text fallback | Skeleton loading placeholders | Visual continuity during lazy load, no layout shift. |
| No `role="dialog"` | `role="dialog"` + `aria-modal="true"` | Screen readers properly announce modal context. |

### WaitlistFlow.tsx

| Before | After | Why it's better |
|--------|-------|-----------------|
| Decorative 4-step bar ("CONNECT / RESERVE SPOT / BOOST RANK / DEPLOY") | Removed — replaced by real StepIndicator inside VerifyStep | Steps now map to actual user actions. No false expectations. |

### VerifyStep.tsx

| Before | After | Why it's better |
|--------|-------|-----------------|
| Header: "Verify wallet" | "Get started" | Friendlier, action-oriented. |
| No subtitle on initial state | "Create your account in one tap." | Sets clear expectation. |
| "Join the waitlist" (post-verify) | "Review and join" | Emphasizes the review moment before submission. |
| No progress stepper | `<StepIndicator>` with Connect → Verify → Join | Users always know where they are in the flow. |
| "Wallet sign-in is unavailable. Try another way." (pre-emptive red error) | "Wallet sign-in is loading. If this persists, try refreshing..." (amber warning) | Not scary on first load. Provides actionable recovery. |
| "ERC-1271 signature confirmed on Base" | "Your smart wallet has been confirmed on Base." | Non-technical language. |
| "The connected wallet doesn't match your creator profile" | "Use the wallet that controls your creator profile, or finish account recovery first." | Actionable, plain English. |
| "Switch to a payout or owner wallet to continue." | "Connect the wallet linked to your creator profile to continue." | Avoids jargon ("payout recipient"). |
| Email input: no `<label>` association | `<label htmlFor>` + `id` + `aria-invalid` + `aria-describedby` | Proper form accessibility. Screen readers announce label and errors. |
| Error messages: inline `<div>` | `<Alert variant="error">` with `role="alert"` | Consistent styling. Screen readers announce errors. |
| Inline Zora info banner | `<Alert variant="info">` | Consistent with design system. |

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm test` | 272 tests pass (58 files) |
| `pnpm build` | Succeeds |
| `pnpm lint` | 1 pre-existing warning (unrelated) |
| `pnpm typecheck` | 1 pre-existing error in `DeployVault.tsx` (unrelated) |
| Vite module inspection | Confirmed all new components served correctly |

---

## Phase 4: Screen-by-Screen Polish

### Layout (P1 — cross-app a11y)

| Change | Why it's better |
|--------|-----------------|
| Added skip-to-content link | Keyboard users can skip past the nav bar directly to page content. Hidden until focused. |
| Added `id="main-content"` to `<main>` | Target for skip-to-content link. |
| Mobile nav: `aria-label="Mobile navigation"` | Screen readers identify the nav region. |
| Mobile nav links: `aria-label`, `aria-current="page"` | Screen readers announce the active page and link purpose. |
| Icons: `aria-hidden="true"` | Decorative icons are hidden from screen readers. |
| Loading spinner: `role="status"` | Screen readers announce loading state. |

### Swap (P2)

| Change | Why it's better |
|--------|-----------------|
| LP status/error → `<Alert>` component | Consistent styling with role="alert" for screen reader announcement. |
| Empty positions → icon + guidance text | "No active positions" + "Add liquidity above to start earning fees" is more actionable than plain text. |
| Settings button → `aria-label="Swap settings"` | Previously icon-only with `title` (not announced by all screen readers). |

### Portfolio (P2)

| Change | Why it's better |
|--------|-----------------|
| Token loading → Skeleton placeholders | Smooth visual placeholder instead of "Loading balances…" text. Prevents layout shift. |
| Disconnected state → icon + "Connect a wallet" | Centered empty state with Wallet icon is more visible and actionable. |
| "Coming soon" tabs → contextual text | e.g. "For now, use Explore → Transactions" gives users an alternative action. |

### Account (P2)

| Change | Why it's better |
|--------|-----------------|
| Error/success → `<Alert>` component | Consistent feedback with icon + role="alert". |
| Loading → Skeleton placeholders | Preserves layout shape during load. More polished than plain text. |
| Sign-in required → centered with icon | Focused layout with Wallet icon, better heading hierarchy, clearer CTA. |

---

## Phase 5: Deep Pass (P0/P1/P2 follow-ups)

### P0 — Waitlist review panel + DoneStep stepper

| Change | Why it's better |
|--------|-----------------|
| "Review before joining" summary panel above submit button | Users see wallet, creator coin, and ownership status at a glance before committing. Reduces accidental submissions. |
| DoneStep shows completed StepIndicator (all 3 steps green) | Reinforces accomplishment and closes the loop on the 3-step flow. |
| DoneStep X verification errors use Alert component | Consistent feedback with screen reader announcement. |

### P1 — Reduced motion + Swap modal a11y

| Change | Why it's better |
|--------|-----------------|
| WaitlistFlow step transitions respect `useReducedMotion` | Users with motion sensitivity see instant transitions. |
| SwapConfirmModal: focus trap + role=dialog + aria-modal + reduced motion | Tab key stays inside the modal. Screen readers announce dialog context. Animations skip for reduced motion. |
| SwapSettingsModal: focus trap + role=dialog + aria-modal + Escape close | Same a11y treatment as confirm modal. |

### P2 — Vault, Portfolio, Account deep polish

| Change | Why it's better |
|--------|-----------------|
| Vault: Skeleton loading while resolving from onchain registry | No blank page during load. Visual continuity. |
| Vault: Empty auction panel explains what CCA is | Non-crypto users understand why the panel is empty and what it's for. |
| Portfolio: Horizontal scrollable token table on mobile | Table doesn't squish — users can scroll sideways with min-width constraint. |
| Portfolio: ARIA table roles | Screen readers announce table structure. |
| Account: ConfirmDialog before revoke-owner action | Destructive blockchain action requires explicit confirmation. Dialog explains permanence. |

---

## Phase 6: TokenLogo, Keyboard Nav, Collapsible Sections, Typography

### TokenLogo (new shared component — `ui/TokenLogo.tsx`)

| Feature | Detail |
|---------|--------|
| Multi-source fallback | Tries `logoUrl`, then each `logoUrls` entry in sequence |
| Error recovery | Cycles all candidates before showing symbol-initial fallback |
| Loading skeleton | Colored pulse placeholder (hue from symbol hash) while image loads |
| Deterministic colors | Same token always gets the same fallback background |
| 5 sizes | xs (20px), sm (24px), md (32px), lg (40px), xl (48px) |
| Memoized | `React.memo` prevents re-renders |
| Adopted in | `TokenIdentityDisplay`, `TokenSelectorSheet`, `SwapConfirmModal`, `Portfolio` |

### Token selector keyboard navigation

| Change | Detail |
|--------|--------|
| Arrow Up/Down | Navigates through filtered token list |
| Enter | Selects the focused token |
| Escape | Closes the sheet |
| aria-activedescendant | Tracks focused item for screen readers |
| Visual focus | Focused row gets `brand-primary/8` background highlight |
| Auto-scroll | Focused item scrolls into view |
| ARIA roles | `role=listbox` on container, `role=option` on each token row |

### Account collapsible sections

| Change | Detail |
|--------|--------|
| `CollapsibleSection` component | Expand/collapse with `aria-expanded`, animated height, reduced motion support |
| Email section | Collapsible (default open) |
| Connected Accounts | Collapsible with address count badge |
| Creator Profile | Collapsible (default open) |
| Access | Collapsible (default collapsed — least commonly used) |

### Typography standardization

| Before | After | Files |
|--------|-------|-------|
| `text-[26px]/text-[30px]` | `text-2xl/text-3xl` | DoneStep |
| `text-[38px]/text-[44px]` | `text-4xl/text-5xl` | WaitlistFlow |
| `text-[34px]` | `text-3xl sm:text-4xl` | Portfolio |

---

## Follow-ups (not in this PR)

- **Button component adoption**: Migrate remaining `btn-primary` + inline spinner patterns to `<Button loading>` across all screens.
- **Full typography audit**: ~40 remaining `text-[Npx]` instances in secondary components. Low-risk, best as a separate pass.
