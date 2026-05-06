# Payout Router + CreatorCoin Control Hardening (March 2026)

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../ACCOUNT_MODEL.md) §5.1 documents the `setPayoutRecipient` + `transferOwnership(CreatorCoinPolicyController)` flow this hardening pass produced. The flow is part of the deploy phase-2 batch in `DeployVault.tsx:4910-4919`.

## Scope

This change set hardens deployment-time and runtime control for payout routing, CreatorCoin admin ownership, and keeper automation when vaults switch payout flow from creator wallet lanes to protocol-governed lanes.

Primary goals:

1. Ensure routed assets are actually processable by the payout path (`creatorCoin`, `ZORA`, and claimed protocol rewards).
2. Remove creator-default admin control where protocol governance should own critical knobs.
3. Eliminate silent skips for critical payout recipient and ownership handoffs.

## What Was Implemented

### 1) New CreatorCoin policy controller (protocol-owned)

Added:

- `contracts/utilities/routers/CreatorCoinPolicyController.sol`

Behavior:

- Holds CreatorCoin ownership after deployment.
- Allows protocol owner to:
  - enforce `setPayoutRecipient(payoutRouter)` via `enforcePayoutRouter()`
  - migrate CreatorCoin ownership via `transferCreatorCoinOwnership(newOwner)`

This creates a dedicated, explicit admin surface for CreatorCoin policy instead of leaving CreatorCoin owner as an EOA creator lane.

### 2) Deployment ownership hardening

Updated deployment flow in:

- `frontend/src/pages/deploy/DeployVault.tsx`
- `frontend/api/_handlers/_paymaster.ts`
- `contracts/helpers/batchers/DeploymentBatcher.sol`

Key outcomes:

- `PayoutRouter` owner is expected/validated as protocol treasury (not creator).
- `setPayoutRecipient(expectedPayoutRouter)` is no longer a silent best-effort path; mismatch/unauthorized execution is treated as a hard policy failure in deploy flow/paymaster checks.
- CreatorCoin ownership transfer target is enforced to the expected `CreatorCoinPolicyController`.
- Paymaster now enforces phase tuple policy fields and codeIds (not only selector allowlists), including:
  - phase-2 deploy lanes (`creatorTreasury`, `payoutRecipient`)
  - phase-3 keeper lanes (`ajnaKeeper`, `solanaKeeper`)
  - canonical phase-2 / phase-3 codeId sets
- Phase-3 strategy deploy now binds auth to actual onchain vault owner (`vault.owner() == params.owner`).
- Ajna auth admin handoff is protocol treasury.
- CCA migration config and treasury lanes in phase-2/phase-3 paths are protocol-owned by default.

Onchain policy tightening in `DeploymentBatcher`:

- phase-2 rejects non-protocol `creatorTreasury` overrides
- phase-2 rejects non-zero `payoutRecipient` (recipient wiring is now explicit via router/policy-controller path)

### 3) Router execution path support for protocol rewards

Updated:

- `contracts/utilities/routers/PayoutRouter.sol`

Added support:

- `protocolRewardsClaimable()`
- `claimProtocolRewards(amount)`
- `claimAllProtocolRewards()`
- Compatibility handling for multiple protocol-rewards withdraw ABIs.

Net effect: protocol rewards can be claimed into router flow, then converted/queued through the existing `convertAndQueue` path.

### 4) Keeper auto-config + runtime config exposure

Updated:

- `frontend/api/_handlers/deploy/_config.ts`
- `frontend/server/_lib/payoutRouterRuntime.ts`
- `.env.example`
- `frontend/.env.example`
- `cre/secrets.example.env`

What this provides:

- Canonical server-side keeper resolution for payout-router admin/config:
  - `PAYOUT_ROUTER_KEEPER`
  - fallback `CRE_KEEPER_ADDRESS`
  - fallback `KEEPR_ADDRESS`
  - final fallback from `KEEPR_PRIVATE_KEY`
- Deploy config API now returns payout-router keeper + fee config used by auto-setup/validation.

### 5) CRE automation job for convert/queue processing

Added:

- `cre/actions/payout-router-harvest.action.ts`
- `cre/workflows/payout-router-harvest.workflow.ts`

Integrated into unified workflow:

- `cre/workflows/4626.workflow.ts`
- `cre/runner.ts`
- `cre/package.json`
- `cre/utils/registry.ts`

Job behavior (per vault with router configured):

1. Optional claim of protocol rewards.
2. `convertAndQueue` for `creatorCoin`.
3. `convertAndQueue` for `ZORA`.
4. Optional `convertAndQueue` for `WETH` (for claimed rewards path).

### 6) Legacy strategy-batcher lane protocolized

Updated:

- `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`

Hardening:

- `batchDeployStrategies` is now protocol-owner-gated (`onlyProtocolOwner`).
- This prevents arbitrary caller-controlled strategy ownership/admin setup through that legacy surface.

## Role / Ownership Posture After This Change

Protocol-controlled by default:

- `PayoutRouter.owner` (critical router admin surface).
- `CreatorCoinPolicyController.owner` (CreatorCoin policy admin).
- Ajna auth admin handoff target.
- CCA migration config treasury lanes.
- `StrategyDeploymentBatcher.batchDeployStrategies` caller lane.

Creator-controlled where still intended:

- Vault final ownership remains creator lane after phase-2 finalize.

## Tests and Validation

### Solidity tests

Executed and passing:

- `forge test --match-contract "DeploymentBatcher.*|CompileTestBatcher"`
- Result: `22 passed, 0 failed`.

Notes:

- Phase-3 tests were updated to reflect new invariants:
  - mocked vaults now expose `owner()`
  - Ajna auth admin expected as protocol treasury

Updated test files:

- `test/DeploymentBatcher.Phase3Ownership.t.sol`
- `test/DeploymentBatcher.SolanaStrategyPhase3.t.sol`
- `test/DeploymentBatcher.ThreeWaySplit.t.sol`

### Frontend API tests

Executed and passing:

- `pnpm -C frontend exec vitest run api/__tests__/paymasterDeploySessionSetup.test.ts api/__tests__/paymasterLegacyWithdraw.test.ts api/__tests__/paymasterPhase2Finalize.test.ts`
- Result: `3 files passed, 21 tests passed`.

## Follow-up Items

1. Run full `forge test` in a non-interrupted session for complete suite confirmation.
2. Add dedicated unit tests for new `PayoutRouter` protocol-rewards claim methods.
3. Add explicit regression tests for `CreatorCoinPolicyController` deployment + transfer path.
