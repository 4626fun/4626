# Yearn-Inspired 4626 Architecture Gap Map

## Scope

This document maps Yearn patterns onto 4626's current architecture and defines a production-safe incremental rollout.

## Pattern 1: Role Policy Management (RoleManagerFactory-Inspired)

### What Yearn Pattern Does

Yearn role-management patterns separate role policy intent (templates/permissions) from vault instance execution, so deployments can enforce consistent role bounds.

### Current 4626 Equivalent

- `CreatorOVault` has explicit role surfaces (`owner`, `management`, `keeper`, `emergencyAdmin`).
- `DeploymentBatcher` orchestrates phase deployment and ownership transfer, but has no dedicated role-policy template layer.

### Gap

- No canonical policy template registry to enforce role assignment constraints at deploy-time.
- No per-session override lane for stricter role policy checks during phase-2 deployment.

### Risk If Unchanged

- Role assignment expectations remain implicit and manual.
- Harder to enforce standardized role security posture as deployment operators and flows evolve.

### Proposed Implementation

P0 introduces:

- `VaultRolePolicyManager` contract with template policy ids and role-rule validation.
- `DeploymentBatcher` optional enforcement hook:
  - global config (`setVaultRolePolicyConfig`)
  - optional per-call override (`deployPhase2CoreWithRolePolicy`)
- existing `deployPhase2Core` path remains unchanged and backwards-compatible.

### Rollout Plan

- **P0**: optional policy manager + deploy-session policy-id validation + no-op default.
- **P1**: policy profiles tied to creator/deploy-session metadata; default policy promotion for selected cohorts.
- **P2**: policy-driven admin/runtime role transitions beyond phase-2 (e.g. controlled keeper rotation lanes).

### Security / Trust Boundary Notes

- `DeploymentBatcher` only accepts policy config updates from `protocolTreasury`.
- Policy manager ownership is explicit (`Ownable`) and separate from vault owner.
- policy id `0` is reserved as permissive default to avoid unplanned deploy outages.

### Non-Goals

- No forced migration of existing deployed vault role state.
- No replacement of `CreatorOVault` role model.
- No mandatory policy in P0.

---

## Pattern 2: Strategy APR Signal Layer (APR Oracle-Inspired)

### What Yearn Pattern Does

Yearn APR surfaces provide standardized expected-return signals to aid strategy allocation and monitoring decisions.

### Current 4626 Equivalent

- Strategy rows are exposed by `/api/v1/vault/strategies`.
- Workspace strategy data includes status/liquidity/performance hints, but no structured APR signal object.

### Gap

- No stable APR signal schema in workspace payloads.
- No confidence/source metadata to support progressive quality improvements.

### Risk If Unchanged

- UI/operator workflows lack normalized expected-yield semantics.
- Future APR-source upgrades risk schema churn.

### Proposed Implementation

P0 introduces a non-breaking APR signal scaffolding layer:

- New `aprSignal` object per workspace strategy row:
  - `expectedAprBps`
  - `confidence`
  - `source`
- deterministic placeholder derivation (`p0_placeholder`) with explicit fallback (`none`).

### Rollout Plan

- **P0**: placeholder-only server-side APR signal schema.
- **P1**: wire keeper/report-derived APR observations into same schema.
- **P2**: promote to richer blended APR engine with source weighting/recency scoring.

### Security / Trust Boundary Notes

- P0 APR values are advisory metadata only (no onchain effect, no transaction gating).
- Explicit `source` prevents users/operators from mistaking placeholders for verified oracle truth.

### Non-Goals

- No new onchain APR oracle in P0.
- No strategy-weight auto-reallocation from APR in P0.

---

## Pattern 3: Canonical Address Resolution (AddressProvider-Inspired)

### What Yearn Pattern Does

Address-provider patterns centralize canonical contract endpoint discovery and alias management to reduce config drift.

### Current 4626 Equivalent

- Canonical defaults are centralized in `frontend/src/config/contracts.defaults.ts`.
- server-safe resolution exists in `frontend/server/_lib/onchain/contracts.ts`.
- deprecated batcher aliases are blocked via normalization helpers.

### Gap

- Canonical address governance is mostly config-layer enforcement, not an onchain provider registry abstraction.

### Risk If Unchanged

- Continued reliance on env/config discipline may still allow accidental drift in new callsites.

### Proposed Implementation

P0 keeps current safe defaults and fail-closed normalization as the canonical source.

P1/P2 expand with an optional dedicated address-provider abstraction (offchain first, then onchain if justified).

### Rollout Plan

- **P0**: no functional cutover; keep existing canonical config boundary.
- **P1**: add typed address-provider interface in server/deploy paths.
- **P2**: optional onchain discoverability mirror for selected deploy components.

### Security / Trust Boundary Notes

- Existing guardrails (`normalizeCreatorVaultBatcherAddress`, deprecated-alias fail-close) remain authoritative.
- No URL/path changes or route behavior changes.

### Non-Goals

- No immediate migration to a new address-provider contract in P0.
- No forced env-cutover.

---

## P0 Deliverable Summary

- Role policy manager contract + deployment-batcher policy enforcement hooks.
- Deploy-session validation for role-policy id call input coherence.
- Workspace APR signal schema scaffolding with explicit placeholder/fallback.
- Tests for policy enforcement, deploy validation behavior, and APR schema fallback.
