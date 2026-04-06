# VaultFlow Desktop Next Handoff

Use this prompt as the single handoff context for the next GPT.

## Execution Prompt

You are continuing work in `/home/akitav2/projects/4626` to advance the immersive desktop vault-flow migration.

### Goal

Complete the next desktop migration slice so the immersive demo is semantic-first (like mobile/reduced) while preserving cinematic quality.

### Current State (important)

- Shared semantic engine is live:
  - `frontend/src/features/home/vault-flow/model/storySemantics.ts`
  - `frontend/src/features/home/vault-flow/model/storyClock.ts`
  - `frontend/src/features/home/vault-flow/model/storySelectors.ts`
  - `frontend/src/features/home/vault-flow/model/storyContent.ts`
- Profile routing is live in:
  - `frontend/src/features/home/vault-flow/VaultFlowRoot.tsx`
- Mobile + reduced orchestrators are semanticized:
  - `orchestrators/VaultFlowMobile.tsx`
  - `orchestrators/VaultFlowReduced.tsx`
- Desktop is still hybrid:
  - `orchestrators/VaultFlowDesktop.tsx` wraps `VaultFlowScroll`
  - `VaultFlowScroll.tsx` remains the cinematic monolith
  - distribution handoff scene already extracted:
    - `scenes/DesktopDistributionHandoffScene.tsx`
- Tests already exist:
  - `model/rendererContract.test.ts`
  - `orchestrators/rendererParity.test.tsx`
- `launchConfig.ts` was removed; do not reintroduce it.

### Constraints (must follow)

1. Keep routes/URLs/behavior intact outside this migration.
2. Preserve immersive desktop look and feel (do not flatten into mobile style).
3. Renderers/orchestrators must use selector APIs for semantic branching (no ad-hoc beatProgress thresholds for semantic conditions).
4. Keep final beat as live system state:
   - `loopActive` semantic truth
   - required subtle re-entry hint (`deposit open`) during earningTogether hold window
5. Do not revert unrelated local changes.

### Implement These Tasks

#### Task 1 — Add semantic desktop final-beat scene

Create a new scene file:
- `frontend/src/features/home/vault-flow/scenes/DesktopEarningTogetherScene.tsx`

Requirements:
- Props include `state` and `content`.
- Render only when earningTogether is semantically visible.
- Show:
  - loop-active state (subtle `loop active` indicator)
  - required re-entry affordance (subtle `deposit open`, not CTA)
- Use selectors only (`isEarningTogetherVisible`, `isLoopActive`, `isReEntryHintVisible`, etc.).

#### Task 2 — Add semantic desktop deploy scene

Create:
- `frontend/src/features/home/vault-flow/scenes/DesktopDeployStrategiesScene.tsx`

Requirements:
- Drive visibility from selectors (`isDeployStrategiesVisible`).
- Source data from `content.strategies`.
- Keep desktop cinematic styling, but semantic gating must come from `StoryState`/selectors.

#### Task 3 — Integrate both scenes into desktop render path

Modify:
- `frontend/src/features/home/vault-flow/VaultFlowScroll.tsx`

Requirements:
- Integrate new deploy + earning scenes using `desktopStoryState`.
- Ensure no double-render conflicts with legacy blocks (hide overlapping legacy visual groups when semantic scenes are active).
- Keep existing camera/world transforms for now.

#### Task 4 — Tighten contract/tests for desktop parity

Modify/add tests:
- `frontend/src/features/home/vault-flow/orchestrators/rendererParity.test.tsx`
- `frontend/src/features/home/vault-flow/model/rendererContract.test.ts`
- Optionally add scene-level tests if useful.

Assertions to add:
- Desktop also exposes final-beat live state (`loop active`).
- Desktop also renders re-entry hint (`deposit open`) during earningTogether hold window.
- Contract remains enforced (no `launchConfig`, no raw state branching patterns in orchestrators).

### Verification

Run:
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test -- --run src/features/home/vault-flow/orchestrators/rendererParity.test.tsx src/features/home/vault-flow/model/rendererContract.test.ts src/features/home/vault-flow/VaultFlowScroll.test.tsx src/features/home/vault-flow/model/storyClock.test.ts src/features/home/vault-flow/model/storySemantics.test.ts`
- If green, run full:
  - `pnpm -C frontend test`

### Output Required

Return:
1. Files changed
2. What semantic behavior was added on desktop
3. Any remaining desktop-legacy areas not yet migrated
4. Verification results

---

## Execution Checklist

- [ ] Build `DesktopEarningTogetherScene` with selector-driven `loop active` + `deposit open`.
- [ ] Build `DesktopDeployStrategiesScene` with selector-driven visibility + `content.strategies`.
- [ ] Wire both into `VaultFlowScroll` using `desktopStoryState` and prevent duplicate legacy rendering.
- [ ] Expand parity/contract tests to include desktop final-beat assertions.
- [ ] Run typecheck + focused tests + full tests and report remaining migration debt.
