---
title: Transactional Integrity Audit
sidebar_position: 7
---

# Transactional Integrity Audit

Inventory of server-side multi-write mutation flows and whether they are protected by explicit transaction boundaries.

## Summary

- Existing transaction helper: `runInTransaction` (`frontend/server/_lib/db/postgres.ts`, re-exported via `@4626/server-core`)
- Current usage now covers the highest-risk identity and keepr update paths; remaining work is concentrated in waitlist bootstrap and selected control-plane executors.

## Covered in this pass

- `frontend/api/_handlers/keepr/actions/_updateStatus.ts`
  - **Now wrapped** for status + join-request sync writes in a single transaction on `executed` / `failed` / `retry` branches.
  - Added regression test coverage in `frontend/api/__tests__/keeprActionsUpdateStatus.test.ts`.
- `frontend/server/_lib/wallet/walletSync.ts` (`syncUserWallets`)
  - **Now wrapped** for profile upsert + role-flag normalization + wallet/profile_wallet writes as one transaction when DB transaction support is available.
  - Falls back to prior behavior in minimal test mocks that expose only tagged-sql helpers.
  - Verified with wallet sync/auth wallet sync API tests.
- `frontend/server/_lib/identity/profileMerge.ts` (`executeProfileMergeInTransaction`)
  - **Now wrapped** so alias/profile wallet/points/referral/CIEC/daily-spend/tombstone writes run under one explicit transaction boundary.
  - Admin route and operator CLI execute mode now use the transaction-wrapped entrypoint.
  - Verified with `profileMerge` unit tests.
- `frontend/api/_handlers/wallet/solana/_setCanonical.ts`
  - **Now wrapped** so canonical-flag reset, target-wallet promotion, and profile canonical-wallet mirror update are atomic.
  - Verified with Solana endpoint hardening tests.
- `frontend/api/_handlers/waitlist/_bootstrap.ts`
  - **Now wrapped** for the verified-email bootstrap write bundle (`upsertAccount` + profile upsert + referral code/attribution + baseline signup points) under one transaction boundary.
  - Uses a transaction-capable fallback helper (no-op transaction mode for lightweight test DB doubles).
  - Verified with waitlist bootstrap test suites.
- `frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts`
  - **Now wrapped** so keepr vault upsert + automation upsert + config-hash readback run inside one transaction boundary.
  - Follow-on keepr helper updates now allow optional injected DB clients (`upsertKeeprVault`, `upsertKeeprVaultAutomation`, `getKeeprVaultByVaultAddress`).
  - Verified with control-plane tests and typecheck.
- `frontend/api/_handlers/creator/strategy/{_activate,_x402-activate,stripe/_checkout,stripe/_webhook}.ts`
  - **Now wrapped** so activation row writes and payment-order/payment-event ledger writes run in a single transaction.
  - Prevents partially persisted payment state (activation without payment order/event, or webhook finalize without ledger).
  - Control-plane operation/stage queueing remains intentionally best-effort and non-transactional.

## Multi-write inventory (prioritized)

### Priority 1 (high-risk, should be transaction-wrapped)

1. Remaining high-risk bootstrap/control-plane multi-write paths discovered during ongoing endpoint sweeps (none higher than current covered set at this time).

### Priority 2 (important operational consistency)

1. `frontend/server/_lib/controlPlane/executors/executeSettleVault.ts`
   - settlement marker and keeper provisioning consistency
2. creator strategy activation handlers under `frontend/api/_handlers/creator/strategy/*`
   - follow-on: add explicit rollback-path tests for transaction failures in handler/unit suites

### Priority 3 (scoped/secondary)

1. selected arch-b provisioning/commit paths where CIEC and wallet/profile mirrors are updated in separate operations

## Acceptance standard for each migration

For each converted flow:

1. all logically-coupled writes are inside one transaction boundary;
2. partial failure cannot leave externally visible contradictory state;
3. route test includes at least one failure-path assertion for rollback behavior.

## Related

- `docs/security/mutable-surface-inventory.md`
- `docs/security/historical-risk-review.md`
