# Remediation Tracker — July 2, 2026 Final Pre-Launch Audit (4626-FABLE-2026-07-FINAL)

Maps each new finding to fix status. **Fixed** = resolved on `main`; **Partial** = mitigated but follow-up required; **Deferred** = operational/design/test-only accepted for now; **Open** = not started; **Not applicable** = no action.

This audit is read-only; no code was changed at audit time. All statuses below were originally the state of `main` @ `b221a3a41`.

**Post-audit remediation pass (July 2, 2026):** statuses updated in place after the same-day fix pass. Gate results after the pass:

| Gate | Result |
|------|--------|
| `pnpm -C frontend test` | **GREEN** — 8,890 passed / 2 skipped (773 files) |
| `pnpm -C frontend typecheck` | **GREEN** |
| `pnpm -C frontend lint` | **GREEN** (0 warnings) |
| `pnpm -C kpr typecheck` | **GREEN** |
| `pnpm -C kpr test` | **GREEN** — 205 passed (24 files) |
| `forge test` | **GREEN** — 1,037 passed / 1 skipped (150 suites; F-14/F-15 test staleness fixed) |
| `cargo test --lib` (creator-share-hook) | **GREEN** — 19 passed (incl. new adversarial hook tests) |
| `pnpm -C frontend guard:canonical-csw` / `guard:schema` | **GREEN** |

---

## Critical

| ID | Title | Status | Required fix |
|----|-------|--------|--------------|
| C-01 | Solana transfer hook accepts unauthenticated invocations (entry forgery) | **Fixed (mainnet deployed 2026-07-03)** | Upgraded `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` at slot **430461604** (tx `5EyDaFfa…GuTqB`). `process_transfer_hook` requires Token-2022 accounts of the hooked mint with runtime `transferring` flag set. **B2 relay still default-denied** until pool verified (`SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`). |

---

## High

| ID | Title | Status | Required fix |
|----|-------|--------|--------------|
| H2-01 | `pnpm -C frontend test` RED (30 fails) | **Fixed** | Harness `RATE_LIMITS` now spreads the real config via `vi.importActual`; 46 stale compiled `.js` twins shadowing `.ts` sources deleted; deploy-session/paymaster/dailyBrief/provisioner/identity test drift reconciled (incl. a real `_createCore.ts` bug: approvals were prepended into `phase2FinalizeCalls` when `phase2CoreCalls` was empty — now always routed to `phase2CoreCalls`). Suite green (8,890). |
| H2-02 | `pnpm -C kpr typecheck` RED (winner-relay `log.args`) | **Fixed** | `logs` typed as `GetLogsReturnType<typeof LOTTERY_WINNER_EVENT_ABI[0]>` so decoded `args` carry through. Gate green. |
| H2-03 | Deploy `status` advances the deploy (not read-only) | **Fixed** | Public `session/status` route (`_status.ts`) is a pure DB read. The advancing core was renamed `_statusCore.ts` → `_advanceCore.ts` with a header documenting it is only reachable through the explicit `session/resume` action, never the status route. |
| H2-04 | `settledAt` writable without §5.1 invariants (mark-settled / admin) | **Fixed** | `settledAt` / `settlementStage="completed"` now require `settledAtAuthority: 'sweep-completion'`, asserted only by the sweep completion path (in-process settle + job-runner follow-up keyed off the sweep's verified `completed` result). `mark-settled` drops forged authority values; admin settle can no longer write settled truth (403 `settled_truth_requires_sweep_completion`). Enforced at queue time and in `executeSettleVault`. |
| H2-05 | Completion-invariant enforcement bypassable via env + request flag | **Fixed** | Per-request `enforceInvariants` removed from `/api/keeper/sweep` (env-only, with `console.error` operational alert when env-disabled). Canary/active-vault enqueue jobs no longer send the flag; canary now always requires invariant env config. Regression test asserts a `enforceInvariants:false` body is ignored. |
| H2-06 | Solana buy-detection spoofable; token accounts not bound to mint | **Fixed (mainnet deployed 2026-07-03)** | Mint binding + mid-transfer proof live on mainnet (see C-01 slot 430461604). Owner-heuristic replacement with pool-specific PDAs / keeper attestation remains optional hardening before B2 enable. |

---

## Medium

| ID | Title | Status | Required fix |
|----|-------|--------|--------------|
| M2-01 | Sweep mutates chain before invariant gate (TOCTOU) | **Open** | Preflight invariants on pre-migration snapshot; block migrate until pass. |
| M2-02 | `DEPLOY_ENFORCE_PHASE2_INVARIANTS` env bypass | **Open** | Fail closed in prod + alert. |
| M2-03 | Production-readiness gates not wired into deploy | **Partial** | Gates implemented (H-07/M-15) but tests-only; wire into phase-2/sweep. |
| M2-04 | `txRouter` non-embedded canonical fallback to `canonicalDirect` | **Open** | Throw sponsorship-required for all canonical approval+swap batches. |
| M2-05 | Hardcoded `BASE_SOLANA_BRIDGE` may be stale vs v1.15.0 | **Open** | Derive from batcher/config; add v1.15.0 integration test. |
| M2-06 | x402 relayer falls back to `PRIVATE_KEY` | **Open** | Require dedicated key; reject fallback in prod. |
| M2-07 | `unpause()` unbounded VRF FIFO OOG | **Deferred** | Cap/chunk queue; document drain runbook. Extends H-02. |
| M2-08 | KPR `relay_entries` re-enables against B1 policy | **Fixed** | `executeSolanaRelayEntries()` is now default-deny in code: it returns an all-zero result (with alert) unless `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED` is explicitly truthy — global execute flags, config re-seeds, and the standalone workflow no longer enable it. Unit tests cover the gate. |
| M2-09 | KPR dual-scheduler double-execution | **Open** | Run one trigger plane. |
| M2-10 | `settle_fees` payout integrity depends on mappings + ATA delta | **Partial** | Bind mapping updates to session proof; assert on-chain token↔shareOFT. |
| M2-11 | `winner_relay` permanently skips unmapped events | **Open** | Separate skipped/processed checkpoints; alert; quarantine. |
| M2-12 | Solana `record_winner` no replay/win-id binding | **Open** | Add win-id to PDA seeds/record; reject duplicates. Phase 5 dependency. |
| M2-13 | Solana `settlement_threshold` unenforced; withdraw auth unvalidated | **Open** | Enforce threshold; assert withdraw authority matches mint fee config. |
| M2-14 | Supply-chain: unpinned tools; KPR excluded from CI audit | **Open** | Pin Semgrep/Slither/CLIs; add KPR to CI `dependency-audit`. |

---

## Low

| ID | Title | Status |
|----|-------|--------|
| L2-01 | `resetPhase1State` allows reset of finalized state | **Open** — add `Phase1AlreadyFinalized` guard |
| L2-02 | Initial `wireDeploymentHelpers` skips codehash validation | **Partial** — extends M-17 |
| L2-03 | PayoutRouter V3 `convertAndQueue` accepts `minOut == 0` | **Open** |
| L2-04 | KPR synthetic dedupe id (not Solana tx sig) | **Deferred** — low collision risk |
| L2-05 | Orchestrator `sync_mapping` high-privilege mutation | **Open** — bind to control-plane session |
| L2-06 | Solana `record_winner` missing mint cross-constraints | **Open** |
| L2-07 | Solana config authority frozen at init | **Open** |
| L2-08 | `initialize_extra_account_meta_list` permissionless | **Open** |
| L2-09 | Admin Solana registration `buildOnly` without machine secret | **Open** — confirm no mutation |
| L2-10 | Duplicate AlfaClub deploy workflows | **Open** — consolidate |
| L2-11 | `verify-bytecode-store-seeded.ts` default v1.14.1 | **Open** |
| L2-12 | KPR `rebalance` stale references (code/test drift) | **Partial** — orchestrator test updated to assert `rebalance` is no longer a supported Solana action; remaining stale references are comments only |

---

## Informational

| ID | Title | Status |
|----|-------|--------|
| I2-01 | EIP-170 headroom tight (CLM 8 B) | **Deferred** — monitor; harnesses cause `--sizes` exit 1 |
| I2-02 | `getGlobalStats`/`processPendingVrfResult` removed | **Not applicable** — H-02 side effect, update indexers |
| I2-03 | Solana dead error codes / silent lottery disable | **Deferred** |
| I2-04 | Solana ring-buffer drop-oldest under spam | **Deferred** — bounded account, fairness only |
| I2-05 | Solana adversarial hook tests missing | **Partial** — unit-level adversarial tests added (wrong mint, not-mid-transfer, missing extension, garbage account data); on-chain integration tests against the upgraded program still needed before B2 |
| I2-06 | Docs address drift (v1.14.1 fact-check, dual Lottery Manager address) | **Open** — reconcile before cutover |

---

## Prior-audit operational carryovers (still required before lottery traffic)

Unchanged from [July 1 remediation](../july-1-2026/remediation.md); re-confirmed still outstanding at audit time (enforcement is operational, not code-gated — see M2-03):

1. Transfer PayoutRouter owner to multisig/timelock; run `verifyPayoutRouterProductionReadiness()` (**H-07**).
2. Call `armBoostSourceTimelock()` before lottery traffic (**M-15**).
3. Call `setAuthorizedHubShareOftForwarder(hubShareOFT, true)` per hub ShareOFT (**H-06** post-deploy).
4. `approvePhaseModuleCodehash(...)` / `approveFactoryCodehash(...)` before authorizing hot swaps (**M-17**).
5. Run `verifyLotteryProductionReadiness()` with zero critical violations.
