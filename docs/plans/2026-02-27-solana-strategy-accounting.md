# Solana Strategy Accounting Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Implement a first-class `SolanaStrategy` so Solana exposure is managed under `CreatorOVault` strategy accounting semantics while keeping synchronous Base withdrawals.

**Architecture:** Add a new vault strategy (`SolanaStrategy`) that implements `IStrategy` and `IStrategyValuation`, combines Base liquid balance with keeper-reported remote NAV, and enforces freshness/delta guardrails. Wire it into phase-3 deployment (alongside Charm/Ajna), seed bytecode store coverage, and update frontend deploy orchestration to include Solana strategy deployment/config in the existing phased flow.

**Tech Stack:** Solidity 0.8.20, Foundry (`forge`), TypeScript + React (Vite frontend deploy flow), viem, existing deployment scripts and bytecode store infrastructure.

---

## Task 0: Baseline and Branch Safety

**Files:**
- Modify: none
- Test: none

**Step 1: Capture current git state**

Run:

```bash
git status
git branch --show-current
```

Expected: clean understanding of working branch and existing dirty files.

**Step 2: Confirm contract baseline compiles**

Run:

```bash
forge build
```

Expected: build completes successfully before changes.

**Step 3: Confirm frontend baseline is healthy**

Run:

```bash
pnpm -C frontend test -- api/__tests__/deploySession.test.ts
pnpm -C frontend typecheck
```

Expected: tests/typecheck pass (or existing failures are recorded before edits).

---

## Task 1: Add `SolanaStrategy` Contract Skeleton With Valuation Guardrails

**Files:**
- Create: `contracts/vault/strategies/SolanaStrategy.sol`
- Test: `test/vault/strategies/SolanaStrategy.Valuation.t.sol`

**Step 1: Write failing valuation tests**

Create `test/vault/strategies/SolanaStrategy.Valuation.t.sol` with cases:
- `isValuationReady` is true with fresh NAV.
- `isValuationReady` is false when NAV is stale.
- NAV update reverts when delta exceeds configured cap.

Example test skeleton:

```solidity
function test_IsValuationReady_FalseWhenStale() public {
    strategy.updateRemoteNav(1_000_000e18, bytes32("r1"));
    vm.warp(block.timestamp + strategy.maxNavAge() + 1);
    assertFalse(strategy.isValuationReady());
}
```

**Step 2: Run test to verify failure**

Run:

```bash
forge test --match-path test/vault/strategies/SolanaStrategy.Valuation.t.sol -vv
```

Expected: FAIL because `SolanaStrategy` does not exist.

**Step 3: Implement minimal contract skeleton**

Implement `contracts/vault/strategies/SolanaStrategy.sol`:
- `IStrategy` + `IStrategyValuation` implementation
- constructor params (`vault`, `asset`, `adapter`, roles, guardrails)
- state: `remoteNav`, `remoteNavUpdatedAt`, `maxNavAge`, `maxNavDeltaBpsPerUpdate`, flags
- `getTotalAssets()` and `isValuationReady()`
- keeper-only `updateRemoteNav(...)` with delta/staleness checks

**Step 4: Re-run valuation tests**

Run:

```bash
forge test --match-path test/vault/strategies/SolanaStrategy.Valuation.t.sol -vv
```

Expected: PASS.

**Step 5: Commit**

```bash
git add contracts/vault/strategies/SolanaStrategy.sol test/vault/strategies/SolanaStrategy.Valuation.t.sol
git commit -m "feat(strategy): add SolanaStrategy valuation guardrails"
```

---

## Task 2: Implement Deposit/Withdraw/Rebalance Semantics

**Files:**
- Modify: `contracts/vault/strategies/SolanaStrategy.sol`
- Test: `test/vault/strategies/SolanaStrategy.Flows.t.sol`

**Step 1: Write failing flow tests**

Add tests for:
- `deposit(amount)` returns exact amount and increases Base liquid balance.
- `withdraw(amount)` serves from Base liquidity only.
- `rebalanceToSolana` cannot breach minimum Base liquidity buffer.
- `withdraw` from low-liquidity state returns partial/zero instead of pretending liquidity.

Example:

```solidity
function test_Withdraw_UsesBaseLiquidityOnly() public {
    // setup vault-owned strategy balance
    uint256 out = strategy.withdraw(100e18);
    assertEq(out, 100e18);
}
```

**Step 2: Run test to verify failure**

Run:

```bash
forge test --match-path test/vault/strategies/SolanaStrategy.Flows.t.sol -vv
```

Expected: FAIL on unimplemented flow methods.

**Step 3: Implement minimal flow logic**

In `SolanaStrategy.sol` implement:
- `deposit(uint256)` onlyVault
- `withdraw(uint256)` onlyVault (Base liquid only)
- keeper ops: `rebalanceToSolana(...)`, `markRebalancedFromSolana(...)` (or equivalent)
- strict access control and events
- `harvest()` as accounting signal (no forced swaps)

**Step 4: Run focused tests**

Run:

```bash
forge test --match-path test/vault/strategies/SolanaStrategy.Flows.t.sol -vv
```

Expected: PASS.

**Step 5: Commit**

```bash
git add contracts/vault/strategies/SolanaStrategy.sol test/vault/strategies/SolanaStrategy.Flows.t.sol
git commit -m "feat(strategy): implement SolanaStrategy sync flow semantics"
```

---

## Task 3: Integrate SolanaStrategy Into Batcher Phase 3

**Files:**
- Modify: `contracts/helpers/batchers/DeploymentBatcher.sol`
- Test: `test/DeploymentBatcher.ThreeWaySplit.t.sol`
- Test: `test/DeploymentBatcher.SolanaStrategyPhase3.t.sol` (new)

**Step 1: Write failing batcher tests**

Add failing tests that assert:
- phase-3 can deploy/register SolanaStrategy when enabled/configured.
- vault receives `addStrategy(solanaStrategy, solanaWeightBps)`.
- weight checks enforce total <= 10_000.

**Step 2: Run tests to verify failure**

Run:

```bash
forge test --match-path test/DeploymentBatcher.SolanaStrategyPhase3.t.sol -vv
```

Expected: FAIL because phase-3 params/code IDs do not include SolanaStrategy.

**Step 3: Update batcher structs and deployment logic**

In `DeploymentBatcher.sol`:
- Extend `StrategyCodeIds` with `solanaStrategy`.
- Extend `Phase3Params` with Solana config and `solanaWeightBps`.
- Deploy SolanaStrategy via `create2Deployer`.
- Register strategy on vault with configured weight.
- Emit updated `Phase3StrategiesDeployed` details.

**Step 4: Run targeted and related tests**

Run:

```bash
forge test --match-contract DeploymentBatcher -vv
```

Expected: PASS for modified batcher test suites.

**Step 5: Commit**

```bash
git add contracts/helpers/batchers/DeploymentBatcher.sol test/DeploymentBatcher.ThreeWaySplit.t.sol test/DeploymentBatcher.SolanaStrategyPhase3.t.sol
git commit -m "feat(batcher): add SolanaStrategy to phase 3 deployment"
```

---

## Task 4: Add Bytecode Store + Script Coverage

**Files:**
- Modify: `script/SeedUniversalBytecodeStore.s.sol`
- Modify: `script/generate_frontend_deploy_bytecode.sh`
- Modify: `frontend/src/deploy/bytecode.generated.ts` (generated output)

**Step 1: Write failing store coverage assertion**

Add a test or script-level check that SolanaStrategy code ID must exist in required entries list.

**Step 2: Run check to verify failure**

Run:

```bash
forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore --sig "run()" --rpc-url $BASE_RPC_URL
```

Expected: SolanaStrategy is missing from code-entry list before patch.

**Step 3: Add SolanaStrategy bytecode entry**

Update seeding and generated bytecode sources:
- include `out/SolanaStrategy.sol/SolanaStrategy.json`
- include code ID checks in generated frontend bytecode map.

**Step 4: Regenerate frontend bytecode file**

Run:

```bash
bash script/generate_frontend_deploy_bytecode.sh
```

Expected: `frontend/src/deploy/bytecode.generated.ts` includes `SolanaStrategy`.

**Step 5: Commit**

```bash
git add script/SeedUniversalBytecodeStore.s.sol script/generate_frontend_deploy_bytecode.sh frontend/src/deploy/bytecode.generated.ts
git commit -m "chore(deploy): add SolanaStrategy bytecode store coverage"
```

---

## Task 5: Update Frontend Deploy Plan Construction

**Files:**
- Modify: `frontend/src/pages/deploy/DeployVault.tsx`
- Test: `frontend/api/__tests__/deploySession.test.ts` (if payload shape assertions need updates)

**Step 1: Write failing payload-shape test**

Add/adjust tests to assert phase-3 payload contains SolanaStrategy code ID and params when Solana strategy mode is enabled.

**Step 2: Run test to verify failure**

Run:

```bash
pnpm -C frontend test -- api/__tests__/deploySession.test.ts
```

Expected: FAIL on missing Solana strategy fields.

**Step 3: Implement deploy flow updates**

In `DeployVault.tsx`:
- add `solanaStrategy` code ID
- include Solana strategy in bytecode store preflight checks
- build phase-3 call args with Solana strategy params/weights
- keep existing safety checks (`assertSafe`) intact

**Step 4: Re-run tests and typecheck**

Run:

```bash
pnpm -C frontend test -- api/__tests__/deploySession.test.ts
pnpm -C frontend typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/pages/deploy/DeployVault.tsx frontend/api/__tests__/deploySession.test.ts
git commit -m "feat(frontend): include SolanaStrategy in phase3 deploy session planning"
```

---

## Task 6: Docs and Runbook Updates

**Files:**
- Modify: `docs/guides/deploy-vault.md`
- Modify: `docs/developers/index.md`
- Modify: `docs/operations/deployment/infra-epoch-redeploy.md`
- Modify: `AGENTS.md`

**Step 1: Update architecture docs**

Document that Solana is now a phase-3 strategy contract under vault accounting semantics (not only out-of-band prep).

**Step 2: Add rollout/ops notes**

Add operator notes for:
- keeper NAV updates
- stale NAV behavior
- emergency disable/freeze controls

**Step 3: Commit**

```bash
git add docs/guides/deploy-vault.md docs/developers/index.md docs/operations/deployment/infra-epoch-redeploy.md AGENTS.md
git commit -m "docs: document SolanaStrategy under vault accounting semantics"
```

---

## Task 7: Full Verification Before Completion

**Files:**
- Modify: none
- Test: full suite subset relevant to changed areas

**Step 1: Run contract verification set**

Run:

```bash
forge build
forge test --match-contract SolanaStrategy -vv
forge test --match-contract DeploymentBatcher -vv
```

Expected: PASS.

**Step 2: Run frontend verification set**

Run:

```bash
pnpm -C frontend test -- api/__tests__/deploySession.test.ts
pnpm -C frontend lint
pnpm -C frontend typecheck
```

Expected: PASS.

**Step 3: Produce deployment preflight output**

Run:

```bash
DEPLOYMENT_EPOCH_TAG=<new-epoch> forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer --rpc-url $BASE_RPC_URL
```

Expected: dry-run predicts addresses and shows no script reverts.

**Step 4: Final commit checkpoint (if multiple commits were squashed during execution, skip)**

```bash
git status
git log --oneline -n 10
```

Expected: clean branch with clear commit sequence.
