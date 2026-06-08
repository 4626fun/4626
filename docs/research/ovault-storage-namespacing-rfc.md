---
title: OVault Storage Namespacing RFC
sidebar_position: 20
---

# OVault Storage Namespacing RFC

Design RFC for migrating from layout-coupled delegatecall module storage to a namespaced storage model with explicit version gates.

## Problem Statement

`CreatorOVault` currently relies on strict layout coupling between the vault and delegatecall modules via `CreatorOVaultModuleStorage`. This is safe only when:

1. every new storage field is appended correctly, and
2. every module is compiled and wired against the same storage version.

The current model already enforces `moduleStorageVersion()` compatibility at module install, but still carries a long-term regression risk: accidental layout drift can break live vault state even when code compiles.

## Goals

- Preserve existing deployed vault behavior and upgrade assumptions.
- Reduce accidental storage-collision/drift risk for future module evolutions.
- Keep deploy-time compatibility checks explicit and fail-closed.
- Provide a phased migration that does not require unsafe in-place state rewrites.

## Non-Goals

- Immediate in-place conversion of already deployed legacy vaults.
- Introducing a second migration framework with implicit auto-conversion.
- Changing custody/accounting semantics outside storage isolation concerns.

## Current State (v3)

- Shared storage model: `contracts/vault/modules/CreatorOVaultModuleStorage.sol`
- Install-time version guard: `setModulesOnce()` + `moduleStorageVersion()`
- Active version line includes v3 impairment fields appended to legacy layout.

## Proposed Architecture

### 1) Namespaced layout for new vault line

Introduce a new storage library for future vault deployments:

- `CreatorOVaultStorageV4` (new library)
- fixed namespaced slot (ERC-7201-style namespace derivation)
- explicit `layout()` accessors for each logical section if needed

All new modules for v4+ read/write through namespaced storage accessors instead of inherited flat layout fields.

### 2) Versioned module compatibility remains mandatory

Keep `moduleStorageVersion()` checks, but tie them to namespaced schema epoch:

- `v3`: legacy appended flat layout
- `v4`: namespaced storage epoch

No cross-epoch module installs allowed.

### 3) Deployment-path split

- Existing deployed vaults remain on v3 modules.
- New deployments can target v4 module set only when full readiness gates pass.

## Migration Plan

### Phase A — Spec + test scaffolding (no behavior change)

1. Add v4 storage RFC references and implementation checklist.
2. Add invariant tests asserting v3 behavior is unchanged.
3. Add static guards to prevent accidental mixed v3/v4 module sets.

### Phase B — v4 storage library + module adapters (feature-flagged)

1. Implement namespaced storage library.
2. Add v4 module implementations using namespaced layout.
3. Keep deployment wiring gated by explicit version target.

### Phase C — rollout for new deployments only

1. Enable v4 for new deployment versions.
2. Keep v3 as default fallback until production confidence threshold is met.
3. Publish operations runbook for v4 deployment checks.

### Phase D — optional legacy migration strategy (deferred)

If legacy migration is ever required, treat as a dedicated project with:

- explicit snapshot + replay/audit tooling,
- dry-run fork validation,
- one-way migration gates,
- rollback-by-freeze strategy (not ad hoc hot rewrites).

## Risk Matrix

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Mixed module epochs accidentally installed | High | hard fail in version compatibility checks + CI guard |
| Namespaced slot typo or drift | High | compile-time constants + invariant tests + codegen checks |
| Silent behavior divergence between v3 and v4 modules | High | differential tests for key flows (deposit/withdraw/report/strategy ops) |
| Operational confusion during rollout | Medium | runbook updates + explicit deploy version labels |

## Test Gates

Required before enabling v4 deployments:

1. **Storage isolation tests**
   - verify v4 reads/writes are confined to namespace slot
   - verify no overlap with legacy expected slots
2. **Differential behavior tests**
   - v3 vs v4 equivalence for non-storage-semantic paths
3. **Deployment guard tests**
   - mixed version module install fails deterministically
4. **Fork dry-run rehearsals**
   - full deploy flow succeeds with v4 target in dry-run mode

## Rollback Strategy

- If v4 deployment issues are detected:
  1. disable v4 target in deployment config,
  2. continue deploying v3-only module set,
  3. keep failed v4 rollout contained to non-production or newly created vaults.
- Do not attempt emergency in-place conversion of existing v3 vault storage.

## Open Questions

1. Should namespaced storage be one unified struct or split by module domain (core/strategies/admin)?
2. Do we want generated storage accessors to reduce human error in slot constants?
3. Which deployment-version marker should become the hard gate for v4 activation?

## References

- `contracts/vault/modules/CreatorOVaultModuleStorage.sol`
- `docs/operations/creator-oVault-vault-gaps-v2.md`
- `docs/research/state-machine-rights-separation.md`
