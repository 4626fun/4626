# Ajna Nested-Only Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the direct `AjnaStrategy` path from the repo and make the nested `CreatorOVault -> ERC4626StrategyAdapter -> AjnaERC4626Vault -> AjnaVaultAuth` stack the only supported Ajna model.

**Architecture:** Treat the adapter-backed inner vault as the only valid Ajna strategy shape everywhere: contracts, deployment/paymaster validation, build/admin APIs, queue execution, status/operator UI, and docs. Delete direct-Ajna contract/runtime paths instead of preserving compatibility shims, and keep verification tight so no stale selector, route, or doc reference survives.

**Tech Stack:** Solidity + Foundry, Vite/React/TypeScript frontend, Vercel API handlers, Vitest, generated contract docs

---

**Execution note:** Do not create git commits unless the user explicitly asks for them.

### Task 1: Remove direct Ajna runtime and operator routes

**Files:**
- Delete: `frontend/api/_handlers/v1/build/ajna/_setBucketIndex.ts`
- Delete: `frontend/api/_handlers/v1/build/ajna/_moveToBucket.ts`
- Modify: `frontend/api/_handlers/v1/build/ajna/_abi.ts`
- Modify: `frontend/api/_handlers/v1/build/ajna/_setIdleBufferBps.ts`
- Modify: `frontend/api/_handlers/_routes.ts`
- Modify: `frontend/api/_handlers/v1/_spec.ts`
- Modify: `frontend/api/_handlers/v1/vault/_strategies.ts`
- Modify: `frontend/api/_handlers/status/_vaultReport.ts`
- Modify: `frontend/api/_handlers/deploy/session/_status.ts`
- Modify: `frontend/src/pages/Status.tsx`
- Modify: `frontend/server/keepr/xmtpQueueExecutor.ts`
- Test: `frontend/api/__tests__/v1BuildAjnaHandlers.test.ts`
- Test: `frontend/api/__tests__/v1BuildPhase1CatchAll.test.ts`
- Test: `frontend/api/__tests__/v1BuildRoutes.test.ts`
- Test: `frontend/api/__tests__/keeprActionsExecute.test.ts`
- Test: `frontend/api/__tests__/keeprActionsEnqueue.test.ts`

**Step 1: Write the failing tests**

Update the frontend API tests so they assert the nested-only surface:

- no route registration for `/v1/build/ajna/setBucketIndex`
- no route registration for `/v1/build/ajna/moveToBucket`
- Ajna build handler tests cover only:
  - `setMinBucketIndex`
  - `setIdleBufferBps`
- queue execution tests cover only nested Ajna rebucket actions via `setMinBucketIndex`
- no status/operator copy or route assertions refer to direct `AjnaStrategy` control flow

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm -C frontend exec vitest run \
  api/__tests__/v1BuildAjnaHandlers.test.ts \
  api/__tests__/v1BuildPhase1CatchAll.test.ts \
  api/__tests__/v1BuildRoutes.test.ts \
  api/__tests__/keeprActionsExecute.test.ts \
  api/__tests__/keeprActionsEnqueue.test.ts
```

Expected: FAIL because legacy direct-Ajna routes and queue methods still exist.

**Step 3: Write the minimal implementation**

Make the runtime surface nested-only:

- delete the direct build handlers
- remove their route registrations and OpenAPI spec entries
- strip direct `setBucketIndex` / `moveToBucket` ABI helpers
- make `Status.tsx`, `_vaultReport.ts`, `_strategies.ts`, and deploy-session status logic report only the nested Ajna model
- remove direct-Ajna method branching from `xmtpQueueExecutor.ts`

Keep:

- `setMinBucketIndex` on `AjnaVaultAuth`
- `setIdleBufferBps` on `ERC4626StrategyAdapter`

**Step 4: Run tests to verify they pass**

Run the same command as Step 2.

Expected: PASS.

### Task 2: Remove legacy phase-3 paymaster compatibility

**Files:**
- Modify: `frontend/api/_handlers/_paymaster.ts`
- Modify: `frontend/api/__tests__/paymasterPhase2Finalize.test.ts`

**Step 1: Write the failing test**

Tighten the paymaster regression test so it asserts:

- the nested phase-3 `deployPhase3Strategies` selector/tuple is accepted
- the old direct-Ajna phase-3 selector is no longer treated as allowed compatibility input

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C frontend exec vitest run api/__tests__/paymasterPhase2Finalize.test.ts
```

Expected: FAIL because `_paymaster.ts` still accepts the legacy direct-Ajna phase-3 selector or tuple.

**Step 3: Write the minimal implementation**

Update `_paymaster.ts` so:

- `CREATOR_VAULT_BATCHER_PHASE_ABI` contains only the nested/canonical phase-3 tuple shape
- the allowed selector set for phase 3 contains only the nested selector
- decode/dispatch logic does not branch on the removed direct-Ajna phase-3 compatibility path

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm -C frontend exec vitest run api/__tests__/paymasterPhase2Finalize.test.ts
```

Expected: PASS.

### Task 3: Delete the direct Ajna strategy contract path

**Files:**
- Delete: `contracts/vault/strategies/AjnaStrategy.sol`
- Modify: `docs/developers/index.md`
- Test/Verify against: `contracts/helpers/batchers/DeploymentBatcher.sol`
- Test/Verify against: `contracts/helpers/batchers/StrategyDeploymentFactories.sol`
- Test/Verify against: `contracts/vault/strategies/ERC4626StrategyAdapter.sol`

**Step 1: Write the failing contract-level verification**

Create or update the smallest verification needed so the build fails if anything still imports or depends on `AjnaStrategy.sol`.

Practical approach:

- delete `AjnaStrategy.sol`
- let `forge build` reveal any remaining compile-time references

**Step 2: Run build to verify remaining dependencies fail**

Run:

```bash
forge build
```

Expected: FAIL if any contract, script, or doc generation metadata still depends on the deleted file.

**Step 3: Write the minimal implementation**

Remove or update any residual contract-level references so the direct strategy no longer exists in-tree and the nested factory/batcher path remains the only Ajna deployment route.

Do not redesign working nested Ajna contracts. Keep the change focused on removing the obsolete direct path.

**Step 4: Run build to verify it passes**

Run:

```bash
forge build
```

Expected: PASS.

### Task 4: Scrub docs and generated references to the direct Ajna path

**Files:**
- Modify: `docs/primitives/market/vault.md`
- Modify: `docs/guides/deploy-vault.md`
- Modify: `docs/operations/deployment/launch/verification.md`
- Modify: `docs/current-contract-inventory.md`
- Modify: `docs/developers/index.md`
- Delete or regenerate: `docs/_generated/contracts/src/contracts/vault/strategies/AjnaStrategy.sol/contract.AjnaStrategy.md`
- Delete or regenerate: `docs/_generated/contracts/src/contracts/helpers/batchers/StrategyDeploymentFactories.sol/interface.IAjnaStrategyFactory.md`
- Delete or regenerate: `docs/_generated/contracts/src/contracts/helpers/batchers/StrategyDeploymentFactories.sol/contract.AjnaStrategyFactory.md`
- Modify or regenerate: `docs/_generated/contracts/src/contracts/vault/strategies/README.md`
- Modify or regenerate: `docs/_generated/contracts/src/contracts/helpers/batchers/README.md`
- Modify or regenerate: `docs/_generated/contracts/src/SUMMARY.md`

**Step 1: Write the failing doc verification**

Decide on one simple repo check:

- search tracked docs for `AjnaStrategy`
- search tracked docs for `IAjnaStrategyFactory`
- search tracked docs for wording that says the old direct path remains supported

**Step 2: Run doc verification to prove stale references exist**

Run:

```bash
rg "AjnaStrategy|IAjnaStrategyFactory|legacy/non-canonical" docs
```

Expected: matches in both hand-written docs and generated contract docs.

**Step 3: Write the minimal implementation**

Make docs nested-only:

- update hand-written docs to remove “legacy but still present” phrasing
- remove stale generated pages or regenerate docs so deleted symbols disappear from summaries/readmes
- keep `ERC4626StrategyAdapter`, `AjnaERC4626Vault`, and `AjnaVaultAuth` as the only documented Ajna stack

**Step 4: Re-run doc verification**

Run:

```bash
rg "AjnaStrategy|IAjnaStrategyFactory" docs
```

Expected: no matches in tracked docs, except possibly in historical plan documents if you explicitly choose not to rewrite history.

### Task 5: Run the final verification sweep

**Files:**
- Verify all touched contract, frontend, API, queue, and docs files above

**Step 1: Run contract verification**

Run:

```bash
forge build
forge test
```

Expected: PASS.

**Step 2: Run frontend static checks**

Run:

```bash
pnpm -C frontend lint
pnpm -C frontend typecheck
```

Expected: PASS.

**Step 3: Run touched frontend/API tests**

Run:

```bash
pnpm -C frontend exec vitest run \
  api/__tests__/v1BuildAjnaHandlers.test.ts \
  api/__tests__/v1BuildPhase1CatchAll.test.ts \
  api/__tests__/v1BuildRoutes.test.ts \
  api/__tests__/keeprActionsExecute.test.ts \
  api/__tests__/keeprActionsEnqueue.test.ts \
  api/__tests__/paymasterPhase2Finalize.test.ts \
  api/__tests__/agentVerifySiwa.test.ts
```

Expected: PASS.

**Step 4: Do a final legacy-reference sweep**

Run:

```bash
rg "AjnaStrategy|setBucketIndex|moveToBucket" contracts frontend docs
```

Expected:

- no remaining direct-Ajna runtime references
- only intentional mentions inside the new design/plan documents if you keep historical planning artifacts

### Task 6: Sanity-check the canonical Ajna story end-to-end

**Files:**
- Verify: `frontend/api/_handlers/deploy/session/_status.ts`
- Verify: `frontend/api/_handlers/status/_vaultReport.ts`
- Verify: `frontend/src/pages/Status.tsx`
- Verify: `frontend/api/_handlers/_paymaster.ts`
- Verify: `contracts/helpers/batchers/DeploymentBatcher.sol`

**Step 1: Confirm the canonical story is single-path**

Check each of the files above and verify they all agree on the same model:

- phase 3 deploys nested Ajna bundle
- paymaster decodes only the nested phase-3 tuple
- status pages expose only adapter-backed Ajna
- operator actions target `AjnaVaultAuth` and adapter admin methods only

**Step 2: Fix any single-path inconsistencies**

If any file still branches between direct and nested Ajna, remove that branch.

**Step 3: Re-run the smallest verification needed**

Run the relevant focused test or static command for the file you touched, then repeat the Step 5 verification sweep if needed.

Expected: the repo presents one Ajna model everywhere, with no dual-path logic left.
