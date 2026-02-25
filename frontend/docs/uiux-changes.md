# UI/UX Changes — CreatorVault (4626.fun)

> Changelog for the UI/UX improvement pass. Ordered by priority.

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
| "Base app smart wallet differs from Zora canonical wallet" | "The connected wallet doesn't match your Zora creator profile. Try connecting the wallet you use on Zora." | Actionable, plain English. |
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

## Follow-ups (not in this PR)

- **P1-2**: Apply `useReducedMotion()` in all Framer Motion components
- **P1-3**: Typography scale standardization pass
- **P2-1**: Swap screen empty state and token selector keyboard nav
- **P2-2**: Vault screen loading skeletons and inline tooltips
- **P2-3**: Portfolio empty state and responsive tables
- **P2-4**: Account settings grouping and destructive action confirmation
- **Visual testing**: The waitlist modal renders on the marketing domain (`4626.fun`), which redirects from localhost. Visual testing requires deploying to a preview environment or configuring env vars to keep users on localhost.
