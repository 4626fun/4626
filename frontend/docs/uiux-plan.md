# UI/UX Improvement Plan — CreatorVault (4626.fun)

> Prioritized backlog for the UI/UX pass. See `uiux-audit.md` for the full issue list.

## Priority Framework

- **P0**: Directly improves waitlist conversion (the primary north-star flow)
- **P1**: Cross-app consistency that benefits all screens
- **P2**: Per-screen polish for secondary flows

---

## P0 — Waitlist Flow Completion (highest priority)

### P0-1: Accessible modal foundation

**Outcome**: Modal traps focus, announces to screen readers, returns focus on close.

**Scope**:
- Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Implement focus trap (Tab cycles within modal)
- Return focus to trigger element on close
- Respect `prefers-reduced-motion` for entrance/exit animations

**Files**: `components/waitlist/WaitlistModal.tsx`

---

### P0-2: Guided stepper with real progress

**Outcome**: Users always know where they are, what's happening, and what comes next.

**Scope**:
- Replace decorative stepper bar with a functional `StepIndicator` showing real steps:
  1. Connect wallet (Privy embedded EOA creation)
  2. Verify ownership (Zora profile + creator coin check)
  3. You're in (waitlist confirmation + next actions)
- Each step shows: label, status icon (pending/active/done), connecting lines
- Step transitions are animated but respect reduced motion

**Files**: `components/waitlist/steps/VerifyStep.tsx`, `WaitlistFlow.tsx`

---

### P0-3: Eliminate pre-emptive error messaging

**Outcome**: Users never see scary error text before they attempt an action.

**Scope**:
- Remove "Wallet sign-in is unavailable" from initial state
- Show fallback options only after a genuine failed attempt
- Replace with friendly helper text: "Tap Sign up to get started"

**Files**: `steps/VerifyStep.tsx` (lines ~719–723)

---

### P0-4: Better status feedback during auto-submit

**Outcome**: Users see clear, non-technical progress messaging while background verification + submission runs.

**Scope**:
- Show a progress panel after wallet connect with checklist:
  - "Wallet connected" ✓
  - "Checking creator profile…" → ✓ / "Not found (that's OK)"
  - "Joining waitlist…" → ✓
- Auto-advance to Done step only after visual confirmation
- Use the existing `simpleVerifiedMode` checklist as the default verify UX

**Files**: `steps/VerifyStep.tsx`, `WaitlistFlow.tsx`

---

### P0-5: Human-language microcopy pass

**Outcome**: All waitlist text is understandable by non-crypto users.

**Scope**:
- Replace "ERC-1271 signature confirmed on Base" → "Wallet ownership verified"
- Replace "Base app smart wallet differs from Zora canonical wallet" → "The connected wallet doesn't match your creator profile. Try connecting the wallet you use on Zora."
- Replace "payout recipient" → "creator wallet" throughout
- Add "Learn more" expandable sections for technical detail (progressive disclosure)

**Files**: `steps/VerifyStep.tsx`, `steps/DoneStep.tsx`

---

### P0-6: Form accessibility

**Outcome**: All form inputs have proper labels and announce errors to screen readers.

**Scope**:
- Add `<label htmlFor>` + `id` to email input
- Add `aria-invalid` and `aria-describedby` for error states
- Announce errors with `role="alert"` or `aria-live="polite"`

**Files**: `steps/VerifyStep.tsx`

---

## P1 — Design System Consistency

### P1-1: Shared UI components

**Outcome**: Consistent interaction states across every screen with zero copy-paste.

**Scope**: Create lightweight React components in `src/components/ui/`:
- `Button` — wraps `.btn-primary`/`.btn-secondary` with `loading`, `disabled`, `icon`, `variant` props
- `Card` — wraps `.card`/`.glass-card` patterns
- `Modal` — accessible dialog with focus trap, backdrop, ARIA
- `StepIndicator` — reusable horizontal stepper
- `Skeleton` — loading placeholder matching card/text shapes
- `Alert` — inline feedback (success/warning/error/info)

**Files**: New `src/components/ui/*.tsx`

---

### P1-2: Reduced motion support

**Outcome**: All animations respect `prefers-reduced-motion: reduce`.

**Scope**:
- Add CSS media query in `index.css` to disable/simplify animations
- Add Framer Motion `useReducedMotion()` hook usage in key motion components
- Ensure page transitions still function (instant swap instead of slide)

**Files**: `index.css`, motion-heavy components

---

### P1-3: Typography scale standardization

**Outcome**: Consistent text sizes mapped to semantic roles.

**Scope**:
- Define scale in design system doc and reference via Tailwind utilities:
  - Display: `text-2xl` / `text-3xl` (page titles)
  - Heading: `text-lg` / `text-xl` (section titles)
  - Body: `text-sm` (14px, main content)
  - Caption: `text-xs` (12px, secondary info)
  - Micro: `text-[11px]` (labels, timestamps — minimum size)
- Audit and migrate hardcoded `text-[Npx]` where they deviate

**Files**: Throughout `src/`

---

## P2 — Screen-by-Screen Polish

### P2-1: Swap screen
- Add "connect wallet" empty state with CTA
- Improve token selector keyboard navigation
- Simplify confirm modal language

### P2-2: Vault screen
- Add loading skeletons for data sections
- Add inline tooltips for terms ("CCA", "clearing price")
- Improve information hierarchy with collapsible sections

### P2-3: Portfolio screen
- Design empty state with "Deposit to your first vault" CTA
- Add responsive table with horizontal scroll indicator
- Add skeleton loading for DeBank data

### P2-4: Account screen
- Group settings into sections (Profile, Wallets, Preferences)
- Add confirmation dialog for destructive actions
- Improve connected accounts display

---

## Implementation Order

```
P0-1 (Modal a11y)
  → P1-1 (Shared UI components — Modal, Button, StepIndicator, etc.)
    → P0-2 (Guided stepper)
      → P0-3 + P0-4 + P0-5 + P0-6 (Waitlist UX improvements)
        → P1-2 (Reduced motion)
          → P1-3 (Typography pass)
            → P2-1..P2-4 (Screen polish)
```

Start with the accessible Modal component since it unblocks both the waitlist stepper (P0-2) and the design system (P1-1).
