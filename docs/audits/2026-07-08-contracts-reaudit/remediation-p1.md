# Remediation — Re-audit P1 (H-04 / NEW-H / H-08)

**Date:** 2026-07-08  
**Status:** Shipped

## H-04 — CCA migrate V4 init grief

| | |
|--|--|
| **File** | `contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol` |
| **Change** | `_resolveAndInitializeMigrationPool`: try primary fee/tick, then rotate across common fee tiers `{500, 10000, 100}` and tick spacings `{10, 200}` until slot0 matches clearing price; persist winning `poolFeeTier` / `poolTickSpacing`; emit `MigrationPoolKeyRotated`; revert `MigrationPoolUnavailable` if all candidates griefed |
| **Test** | `test_migrate_recoversFromHostilePrimaryPoolInit` |

## NEW-H — Deploy codeId allowlist

| | |
|--|--|
| **File** | `DeploymentBatcher.sol` + phase1/2/3/shareMesh helpers |
| **Change** | `approvedCodeIds`, `codeIdAllowlistEnabled` (default **true**), `setApprovedCodeId(s)`, `setCodeIdAllowlistEnabled`, `freezeCodeIdAllowlist`, `requireApprovedCodeId` called from phase deploys |
| **Tests** | Fixture disables allowlist for unit mocks; P1 suite re-enables and asserts enforcement |

## H-08 — Mandatory phase module codehash

| | |
|--|--|
| **File** | `DeploymentBatcher.sol` |
| **Change** | `_validatePhaseModuleCodehash` **requires** non-zero approval (no pass-through); `wireDeploymentHelpers` validates phase2 codehash + batcher binding; `approvePhaseModuleCodehash` rejects zero hash |
| **Tests** | Fixture auto-approves phase1/2 codehashes; P1 suite covers unapproved + mismatch |

## Ops checklist (production)

1. After wiring modules: `approvePhaseModuleCodehash(phase1|phase2, extcodehash)`.
2. Seed `setApprovedCodeIds([...manifest codeIds], true)`.
3. Keep `codeIdAllowlistEnabled == true`.
4. Call `freezeCodeIdAllowlist()` after cutover.
5. Do not leave unit-test `setCodeIdAllowlistEnabled(false)` in production scripts.

## Validation

```bash
forge test --match-contract 'CCALaunchArmShareMeshSeedTest|Audit20260708_P1_BatcherSecurity'
# 12 passed
```

Also run: `forge test --match-path 'test/DeploymentBatcher*.t.sol'`
