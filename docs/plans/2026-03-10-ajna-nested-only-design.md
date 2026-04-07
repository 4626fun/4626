# Ajna Nested-Only Design

Date: 2026-03-10
Status: Approved
Owner: Contracts + Frontend Platform

## Context

The repo has already moved the canonical Ajna integration to a nested model:

- `CreatorOVault` remains the public ERC-4626 product vault.
- `ERC4626StrategyAdapter` is the only Ajna-facing strategy registered on the outer vault.
- `AjnaERC4626Vault`, `AjnaVaultAuth`, and `AjnaVaultBuffer` encapsulate Ajna-specific mechanics.

Current state is still mixed:

- Some frontend/API/operator surfaces still preserve direct `AjnaStrategy` actions for backward compatibility.
- The paymaster and Keepr Action Queue path still contain legacy compatibility paths.
- Docs still describe the direct `AjnaStrategy` path as legacy rather than removing it entirely.
- The direct strategy contract source still exists in-tree.

The desired direction is to stop treating the direct Ajna strategy as supported at all and make the nested adapter-backed stack the only default and standalone Ajna model in this repo.

## Goals

- Remove repo-level support for the direct `AjnaStrategy` path.
- Make the nested adapter-backed Ajna architecture the only canonical path across contracts, deployment, operator tooling, paymaster validation, and docs.
- Reduce maintenance burden by removing dual-path logic and legacy decode/build/admin compatibility.
- Keep the current canonical deploy flow, URLs, and outer-vault behavior intact.

## Non-Goals

- No new end-user UI or route changes.
- No migration tooling for historical direct-Ajna deployments.
- No attempt to preserve first-class compatibility for old direct-Ajna vaults in current app/runtime surfaces.
- No redesign of unrelated strategy systems like Charm or Solana.

## Chosen Approach

Hard-cut to nested-only across the repo.

This means:

1. Delete the direct `AjnaStrategy` contract path and any code that exists only to support it.
2. Remove legacy direct-Ajna API/build/operator actions like `setBucketIndex` and `moveToBucket`.
3. Keep only nested controls:
   - `AjnaVaultAuth.setMinBucketIndex(...)`
   - `AjnaVaultAuth` admin/keeper/pause/buffer configuration
   - `ERC4626StrategyAdapter.setIdleBufferBps(...)`
4. Remove legacy selector and tuple compatibility where runtime surfaces currently accept both direct and nested Ajna phase-3 shapes.

This is the cleanest long-term shape because the repo stops carrying two mental models for the same strategy sleeve.

## Architecture

The only supported Ajna topology becomes:

```text
CreatorOVault
  -> ERC4626StrategyAdapter
    -> AjnaERC4626Vault
      -> AjnaVaultAuth
      -> AjnaVaultBuffer
      -> Ajna pool
```

Operational implications:

- Outer vault strategy lists only ever expose the adapter as the Ajna strategy.
- Ajna policy/config lives on `AjnaVaultAuth`.
- Ajna bucket floor control is modeled as `minBucketIndex`, not direct `AjnaStrategy.bucketIndex`.
- Adapter idle behavior remains a separate owner/admin concern from inner-vault buffer policy.

## Runtime Surface Changes

### Contracts

- Remove `contracts/vault/strategies/AjnaStrategy.sol`.
- Remove tests that validate only the direct strategy behavior.
- Remove or update any generated docs/inventory that still list the direct strategy as a live option.

### Frontend + API

- Remove build routes for direct-only admin actions:
  - `/v1/build/ajna/setBucketIndex`
  - `/v1/build/ajna/moveToBucket`
- Keep nested/admin routes only:
  - `/v1/build/ajna/setMinBucketIndex`
  - `/v1/build/ajna/setIdleBufferBps`
- Remove any UI copy that branches between direct and nested Ajna.

### Queue / Agent Automation

- `strategy.ajna.rebucket` becomes nested-only.
- The supported canonical action is setting `AjnaVaultAuth.minBucketIndex`.
- Direct `moveToBucket` and direct `setBucketIndex` execution are removed.

### Paymaster / Deployment Decoding

- `deployPhase3Strategies` support should accept only the nested-Ajna tuple and selector.
- Legacy direct-Ajna phase-3 selector compatibility is removed.
- Decode logic stays strict and aligned to the canonical batcher ABI.

## Rollout Consequences

- Historical direct-Ajna deployments are no longer supported by current app/runtime tooling.
- Any attempt to use old direct-Ajna operator actions should fail by absence of route/support, not by hidden fallback.
- The repo becomes opinionated and easier to reason about, but this is an intentional compatibility break for legacy direct-Ajna surfaces.

## Risks And Mitigations

- Removing direct-Ajna selectors could break forgotten internal tools.
  - Mitigation: search and remove direct route/test references in the same change set.
- Generated docs may continue to list deleted contracts if not refreshed.
  - Mitigation: regenerate or delete stale generated Ajna docs as part of the cleanup.
- Queue/paymaster regressions could appear if the nested path is not fully covered.
  - Mitigation: keep targeted API tests for paymaster, build handlers, and queue execution updated and green.

## Verification

Required verification after the cleanup:

- `forge build`
- `forge test`
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- targeted frontend API tests covering:
  - Ajna build routes
  - queue action execution/enqueue
  - paymaster phase-3 decode
  - status/operator surfaces if touched

Success means:

- no direct `AjnaStrategy` runtime path remains
- canonical nested deploys still pass end-to-end verification
- docs describe only the nested Ajna model
- tests and tooling no longer branch on direct-vs-nested Ajna behavior
