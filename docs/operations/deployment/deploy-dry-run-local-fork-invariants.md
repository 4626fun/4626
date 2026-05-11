# Deploy Dry-Run Local-Fork Invariants

This document explains why deploy dry-run can report:

- `Phase 4 launch` -> `skipped (known local-fork invariant)`

and what that means operationally.

## Why this happens

On local Anvil/Hardhat fork simulation, `launchDeferredAuction(...)` can revert with selector:

- `0x28e7b618`

even after all deploy-session phase rewrites and candidate retries are applied.

Observed behavior in this mode:

- Phase 1/2/3 calls are reproducible and verifiable.
- Phase 4 launch invariant can remain non-actionable in local-fork context.
- Multiple rewrite candidates for launch params can still revert with the same selector.

This is treated as a **local-fork simulation artifact/invariant blocker**, not a proof that production launch will fail.

## Current dry-run behavior

In `frontend/api/_handlers/deploy/v2/session/_dryRunCore.ts`:

- Phase 4 launch has retry + candidate simulation recovery.
- If selector `0x28e7b618` still persists on local fork dry-run, Phase 4 is marked:
  - `status: "skipped"`
  - `callCount: 0`
  - `reason: "known_local_fork_invariant"`

The UI shows this explicitly as:

- `skipped (known local-fork invariant)`

## Safety boundary (must remain)

The skip path is explicitly gated by local fork context:

- `allowLocalForkPhase4InvariantSkip: isLocalFork`

It must **not** be used in:

- real deploy-session execution
- production paths
- non-local RPC dry-run environments

## Operator guidance

When dry-run returns Phase 4 skipped for this reason:

1. Treat Phase 1/2/3 validation as the primary dry-run signal.
2. Do not infer Phase 4 success from local fork skip alone.
3. Use real deploy-session execution checks and post-send telemetry for final launch confirmation.

