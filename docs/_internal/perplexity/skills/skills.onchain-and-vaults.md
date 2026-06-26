# 4626 Skills: Onchain And Vaults

## When To Use

Use this for Solidity/Foundry work, vault deployment, OFT cross-chain wiring, VRF lottery operations, and strategy allocation/maintenance.

## Intake Checklist (Required)

1. target chain(s) and environment
2. read-only analysis vs mutating write/deploy
3. ownership/admin path for intended actions
4. rollback constraints

## Canonical Invariants

- Creator Coin and Share token are distinct assets; do not treat as interchangeable.
- Preserve canonical wallet/execution policy when describing deploy and ownership flows.
- Prefer smallest contract-surface change; treat bridge, fee-routing, and vault accounting as high-risk.

## Core Components

- Vault stack: `CreatorOVault`, `CreatorOVaultWrapper`, `CreatorShareOFT`, `CreatorGaugeController`, `CCALaunchStrategy`, `CreatorOracle`.
- Deployment engines:
  - Foundry infra deploy scripts (`script/DeployInfrastructure.s.sol`, `script/deploy.sh`)
  - Frontend AA deploy flow (`frontend/src/pages/deploy/DeployVault.tsx`)
  - Multi-phase batcher (`contracts/helpers/batchers/DeploymentBatcher.sol`)
- Strategy ops:
  - Allocation and debt logic in `contracts/vault/CreatorOVault.sol`
  - Strategy deployment via `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`
- VRF:
  - Hub `CreatorVRFConsumerV2_5` + spoke `ChainlinkVRFIntegratorV2_5`
- OFT:
  - `CreatorShareOFT` and LayerZero peer/EID configuration.

## Commands

- Build contracts: `forge build`
- Run tests: `forge test`
- Frontend checks when deploy flow UI changes:
  - `pnpm -C frontend lint`
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`

## Read-Only Preflight Patterns

- Validate chain and ownership first (`cast chain-id`, `owner()` calls).
- Validate already-deployed state before writing (registry/factory lookups).
- Validate OFT peers in both directions (A->B and B->A).
- Validate lottery mode (`useLocalVRF`, integrator/local consumer pointers).

## Execution Framework

### Phase 1: Preflight Snapshot

- Capture onchain state and ownership before proposing writes.

### Phase 2: Change Plan

- Minimize contract-surface touch area.
- Explicitly list invariant-sensitive components affected.

### Phase 3: Verification

- Run `forge build` + `forge test`.
- Add frontend checks if deploy UI/API was touched.

### Phase 4: Post-Write Validation

- Re-read key onchain state (owners/peers/mode/allowances) and compare against plan.

## Common Pitfalls

- Running retired per-creator/AA CLI deployment paths instead of current deploy-session/UI flow.
- One-sided LayerZero peer config causing cross-chain message auth failures.
- Missing launcher approvals or token allowances before batch strategy/deploy actions.
- Treating historical registrar state as equivalent to current deployment engine state.

## Safe Defaults

- Do read-only preflight and explicit verification before and after any onchain write.
- Prefer phased deployment when transaction/code-deposit limits apply.
- Keep operational instructions free of secrets and private keys.

## Sources

- `AGENTS.md`
- `.cursor/skills/vault-deployment/SKILL.md`
- `.cursor/skills/deploy-vault-operator/SKILL.md`
- `.cursor/skills/yield-strategy-management/SKILL.md`
- `.cursor/skills/lottery-vrf-ops/SKILL.md`
- `.cursor/skills/oft-chain-config/SKILL.md`
- `script/agent-runtime/skills/contracts-change/SKILL.md`
