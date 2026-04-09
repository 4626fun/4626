# Swap Trade UI Redesign Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Deliver an aggressive Uniswap + DefiLlama-inspired redesign for `/swap` while preserving current Trading API execution behavior and improving token icon reliability.

**Architecture:** Keep execution logic in `useSwapExecution` + `/api/uniswap/*` untouched. Implement the redesign by updating presentational components and CSS tokens. Add logo URL fallback helpers in `swapUtils` and wire them into token option construction so icon failures degrade gracefully.

**Tech Stack:** React + TypeScript + Tailwind CSS + Framer Motion + Vitest.

---

### Task 1: Add deterministic token logo fallback utilities

**Files:**
- Modify: `frontend/src/lib/uniswap/swapUtils.ts`
- Modify: `frontend/src/lib/uniswap/swapUtils.test.ts`

**Step 1: Write the failing tests**

Add tests validating:
- Uniswap Base logo URL generation
- fallback array order (Uniswap -> TrustWallet -> z0r0z)
- `resolveTokenDisplay` keeps `logoUrl` as primary and fallback list when provided

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend vitest run src/lib/uniswap/swapUtils.test.ts`
Expected: FAIL on missing helper(s)/properties.

**Step 3: Write minimal implementation**

In `swapUtils.ts`:
- add logo URL helpers for Uniswap and z0r0z assets
- add a small helper returning ordered fallback list
- extend `TokenDisplay` with optional `logoUrls?: string[]`
- include fallback list in `resolveTokenDisplay`
- update core token construction (in `Swap.tsx` next task) to prefer Uniswap source

**Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend vitest run src/lib/uniswap/swapUtils.test.ts`
Expected: PASS.

**Step 5: Commit**

`git add frontend/src/lib/uniswap/swapUtils.ts frontend/src/lib/uniswap/swapUtils.test.ts`

---

### Task 2: Update token avatar consumers to use fallback logo lists

**Files:**
- Modify: `frontend/src/components/trade/TokenSelectorSheet.tsx`
- Modify: `frontend/src/components/trade/TokenIdentityDisplay.tsx`
- Modify: `frontend/src/components/trade/SwapConfirmModal.tsx` (if logo rendering relies on single URL)

**Step 1: Write the failing test**

If component tests are absent, write minimal tests around avatar fallback behavior (or add logic tests to `swapUtils.test.ts` for URL selection fallback semantics).

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend vitest run src/lib/uniswap/swapUtils.test.ts`
Expected: FAIL before fallback logic is wired.

**Step 3: Write minimal implementation**

Implement avatar behavior:
- attempt primary URL first
- on image error, advance to next fallback URL
- final fallback is symbol badge

**Step 4: Run test to verify it passes**

Run relevant tests.

**Step 5: Commit**

`git add frontend/src/components/trade/TokenSelectorSheet.tsx frontend/src/components/trade/TokenIdentityDisplay.tsx frontend/src/components/trade/SwapConfirmModal.tsx`

---

### Task 3: Apply aggressive UniLlama shell redesign to page and panel

**Files:**
- Modify: `frontend/src/pages/Swap.tsx`
- Modify: `frontend/src/components/trade/SwapPanel.tsx`
- Modify: `frontend/src/components/trade/TokenAmountSurface.tsx`
- Modify: `frontend/src/components/trade/InfoStrip.tsx`
- Modify: `frontend/src/components/trade/FlipButton.tsx`
- Modify: `frontend/src/components/trade/SwapSettingsModal.tsx`
- Modify: `frontend/src/index.css`

**Step 1: Write/adjust expectation tests**

Where practical, add/adjust assertions in existing unit tests for utility output used by UI labels. If no component tests exist, keep this as manual UI verification checkpoints and lint checks.

**Step 2: Run tests/lint baseline**

Run:
- `pnpm --dir frontend vitest run src/lib/uniswap/swapUtils.test.ts`
- `pnpm --dir frontend lint` (or project lint command)

Record baseline failures if any pre-exist.

**Step 3: Write minimal implementation**

Make visual-only changes:
- stronger card shell and top controls
- refined amount surfaces, chips, selector rows
- polished sticky CTA and settings modal
- subtle atmospheric background additions in CSS

Do not change quote/review/execute behavior.

**Step 4: Verify passes**

Run:
- `pnpm --dir frontend vitest run src/lib/uniswap/swapUtils.test.ts`
- `pnpm --dir frontend lint`

Also run `ReadLints` on modified files and fix introduced issues.

**Step 5: Commit**

`git add frontend/src/pages/Swap.tsx frontend/src/components/trade/SwapPanel.tsx frontend/src/components/trade/TokenAmountSurface.tsx frontend/src/components/trade/InfoStrip.tsx frontend/src/components/trade/FlipButton.tsx frontend/src/components/trade/SwapSettingsModal.tsx frontend/src/index.css`

---

### Task 4: Manual functional verification and polish pass

**Files:**
- Modify (if needed): same UI files above

**Step 1: Run app locally**

Run: `pnpm --dir frontend dev`

**Step 2: Manual checks**

- `/swap` loads with new visual hierarchy
- token icons resolve; broken primary URLs fall through to secondary sources
- quote/update/review button behavior unchanged
- settings and token selector open/close correctly
- mobile sticky CTA remains tappable and non-overlapping

**Step 3: Fix any regressions**

Apply minimal fixes only.

**Step 4: Re-run lint/tests**

Run same verification commands.

**Step 5: Commit**

`git add <modified files>`

---

### Task 5: Route and architecture safety confirmation

**Files:**
- No code changes required unless a defect is found

**Step 1: Validate no execution-path changes**

Confirm no edits in:
- `frontend/src/hooks/useSwapExecution.ts`
- `frontend/api/_handlers/uniswap/*`
- `frontend/server/uniswap/trading.ts`

**Step 2: Confirm recommendation note for router posture**

Keep this phase on Trading API execution and avoid alternate swap-routing surfaces.

**Step 3: Final verification**

Run lint/tests one final time.

**Step 4: Commit**

`git add docs/plans/2026-02-25-swap-trade-ui-redesign-design.md docs/plans/2026-02-25-swap-trade-ui-redesign.md`
