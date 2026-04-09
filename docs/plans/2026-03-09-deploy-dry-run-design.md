# Deploy Dry-Run Design

**Date:** 2026-03-09

**Goal:** Add a deploy dry-run path that validates the exact `/deploy` session payload without creating a deploy session, installing a temporary owner, sending UserOps, or performing Solana registration writes.

## Problem

The current deploy flow has two useful but incomplete checks:

- `/api/deploy/session/create` with `preflightOnly: true` validates auth, ownership, allowlist access, and basic infra readiness.
- contract and API tests verify the deploy state machine and phase-3 Solana strategy behavior in isolation.

What is missing is a single operator-facing dry-run that reuses the real `/deploy` plan payload and tells us whether the phased deploy would succeed before any live write happens.

## Decision

Add a dedicated server dry-run endpoint that accepts the same payload shape as `deploy/session/create`, performs the same auth and readiness gates, and then simulates each phase in order against the configured chain RPC using read-only calls.

The `/deploy` page should expose this as a separate dry-run action. It should report whether each phase passed simulation and where the first failure occurred.

## Recommended Approach

Use a new endpoint instead of overloading `preflightOnly`:

- keep `preflightOnly` as the current lightweight auth and infra gate
- add a distinct `deploy/session/dry-run` handler for full payload simulation
- share validation helpers with `_create.ts` so request rules stay aligned

This keeps semantics clear:

- `preflightOnly` means "am I allowed and configured to try?"
- `dryRun` means "would this exact deploy plan likely succeed?"

## Simulation Model

The dry-run should:

1. Accept the exact phased call bundle built by `frontend/src/pages/deploy/DeployVault.tsx`
2. Re-run the existing auth, canonical wallet, creator access, and infra checks
3. Simulate each phase call in order with read-only RPC execution
4. Stop on first failure and return the failing phase, call index, target, and reason
5. Optionally include Solana infra readiness details, but never invoke Solana write/provision routes

The dry-run must not:

- insert a deploy session row
- create or persist a session signer
- build an ERC-7712 grant
- call `sendUserOperation`
- call `deploy/session/continue`
- hit `/api/deploy/registerSolanaBridgeToken`

## Error Reporting

The response should be operator-oriented rather than raw-RPC-only:

- overall status: pass or fail
- per-phase results: `phase1`, `phase2Core`, `phase2Finalize`, `phase3`, `phase4`
- first failure details: phase, call index, target, short reason
- Solana notes when phase 3 or 4 are present and Solana is configured

## UI Behavior

The `/deploy` page should add a dry-run action near the existing deploy CTA.

Expected UX:

- build the exact same session payload as real deploy
- call the dry-run endpoint
- show progress state while waiting
- display pass/fail summary without starting a real deploy session
- avoid reusing deploy-session polling or cancellation behavior

## Testing Strategy

Use TDD:

- API tests for dry-run success and first-failure reporting
- API tests proving no session persistence or continuation writes occur
- page-level tests for the new dry-run action wiring and result handling

## Files Likely To Change

- `frontend/api/_handlers/_routes.ts`
- `frontend/api/_handlers/deploy/session/_create.ts`
- `frontend/api/_handlers/deploy/session/_dryRun.ts`
- `frontend/api/__tests__/deploySessionDryRun.test.ts` or adjacent deploy-session tests
- `frontend/src/pages/deploy/DeployVault.tsx`

## Recommendation

Implement the dry-run as a separate endpoint that shares create-time validation but performs read-only phase simulation. This is the most direct way to validate the real deploy payload while preserving the safety guarantee that no deploy state is created or mutated.
