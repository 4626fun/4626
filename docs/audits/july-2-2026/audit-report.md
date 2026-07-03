# 4626 Final Pre-Launch Audit — Findings

- **Report ID:** 4626-FABLE-2026-07-FINAL
- **Date:** 2026-07-02
- **Method:** baseline validation (see [index.md](./index.md)) → re-verify July 1 Highs at cited lines → multi-pass net-new review (contracts, frontend/API, KPR, Solana program, CI/ops) → adversarial exploit-path analysis against product invariants.

Trusted roles referenced below: **owner / protocol treasury** (Safe / EOA), **keeper** (`KPR_PRIVATE_KEY` + `KEEPR_API_KEY` machine auth), **admin** (allowlisted admin EOA / session), **upgrade authority** (Solana), **config authority** (Solana per-creator). Where a finding requires one of these, severity is rated accordingly.

Severity legend: Critical (permissionless fund loss / integrity break), High (privilege-gated integrity break or launch-blocking gate failure), Medium (misconfig / TOCTOU / defense-in-depth), Low (ops footgun), Informational.

---

## Critical

### C-01 — Solana transfer hook accepts unauthenticated invocations → lottery-entry forgery

- **Area:** Solana program
- **File:line:** `programs/creator-share-hook/src/lib.rs:36-38`, `:90-137`; `programs/creator-share-hook/src/execute_hook.rs:76-133`, `:87-97`
- **Description:** The hook logic is reachable through both the Anchor `transfer_hook` instruction and the SPL `execute` `fallback()` discriminator. Neither path proves a Token-2022 transfer is actually in progress (no `instructions` sysvar / parent-program check), and `authority` is an `UncheckedAccount` with no signer requirement. Buy classification (`is_allowlisted_buy`) trusts only that `config.is_known_amm(authority) && authority == source_token_account.owner`, read from raw account bytes.
- **Impact:** Anyone can append entries to `PendingEntries` without moving tokens. When B2 `relay_entries` is enabled, a keeper relays those forged entries to Base → inflated or wholly fake lottery participation, diluting honest buyers' odds and draining jackpot value to attacker-controlled addresses.
- **Exploit path:** (1) create a Token-2022 account for the share mint with `owner = <allowlisted AMM program id>`; (2) create a destination account owned by attacker; (3) invoke `transfer_hook(amount)` or raw `execute` discriminator `[105,37,101,197,75,251,102,26] || amount_le`; (4) `is_allowlisted_buy()` passes; (5) repeat to spam entries.
- **Trusted role:** None — permissionless.
- **Current mitigation:** Solana `relay_entries` is **paused** by policy (B1 lane, `docs/_internal/operations/operations/solana/solana-share-mesh-lottery-policy.md:15,41`), so forged entries do **not** currently reach Base. Blast radius is limited to Solana on-chain state until B2. This is why the item is not a Base Phase 1–4 blocker but **is** a hard Phase 5 blocker.
- **Recommendation:** Gate/remove the public Anchor `transfer_hook`; in `fallback` require Token-2022 CPI proof via the `instructions` sysvar (current instruction program == Token-2022 execute); validate `source/destination.mint == mint.key()`; do not treat "token-account owner == AMM program id" as buy proof. Add adversarial hook tests. **Must be fixed before enabling `relay_entries` (B2).**

---

## High

### H2-01 — `pnpm -C frontend test` gate is RED on `main` (30 failures / 7 files)

- **Area:** Frontend/API (release gate)
- **File:line:** `frontend/test/server-core-vitest.ts:11-26`; `frontend/api/__tests__/accountsMe.test.ts:31-40`; `frontend/api/__tests__/deploySessionDryRun.test.ts:82-96`; `frontend/api/__tests__/deploySessionOwnership.test.ts:67-76`; `frontend/api/__tests__/paymasterPhase2Finalize.test.ts`
- **Description:** The frontend Vitest suite fails. Two clusters, both reproduced in isolation:
  1. **Rate-limit mock drift (accountsMe, 2 tests):** `accountsMe.test.ts` spreads the vitest `@4626/server-core` alias's `RATE_LIMITS` **Proxy** (`{ ...actual.RATE_LIMITS, accountsMe: … }`). Spread copies only the Proxy's 3 own keys and drops the `get`-trap default fallback, so `RATE_LIMITS.accountsMeSession` resolves to `undefined` → `checkRateLimit(config=undefined)` throws `Cannot read properties of undefined (reading 'windowMs')` at `frontend/server/_lib/infra/rateLimit.ts:53`. Introduced when the dual session/IP limiter + `accountsMeSession` key was added to `_me.ts` (commit `71a60c534`) without updating the harness Proxy.
  2. **Deploy-session mock/handler drift (deploySessionDryRun 9, deploySessionOwnership ~13, paymasterPhase2Finalize 2):** full `vi.mock('@4626/server-core')` replacements return 500 where 200/402/400/503 expected, plus assertion mismatches (e.g. `expected 'phase3 exploded' to contain 'ERC20InsufficientBalance()'`) — the test mocks/expectations are out of sync with the handler after the v1.15.0 phase refactor. Remaining: `dailyBrief.room` (3, `alfaclub_bot_token_missing`), `provisioner` (1, expects `solana:create-dlmm-pool` note), `accountsIdentity.email` (1).
- **Impact:** The suite that certifies deploy-session preflight, accounts/identity, and paymaster phase-2 behavior — all in launch scope — cannot be trusted green. AGENTS.md documents this gate as "289 tests, all passing"; it is stale and now RED.
- **Exploit path:** N/A (test infrastructure). Production `@4626/server-core` resolves the real config, so these are **not** production vulnerabilities — but they blind the release gate.
- **Recommendation:** Fix the harness so `RATE_LIMITS` is a plain enumerable object (or have tests reference real keys), and reconcile deploy-session mocks/expectations with the current handlers. Do not treat the gate as passing until green.

### H2-02 — `pnpm -C kpr typecheck` gate is RED (winner-relay `log.args`)

- **Area:** KPR (release gate)
- **File:line:** `kpr/actions/keepr-solana-winner-relay.action.ts:227` (`log.args` on a viem `Log` typed without decoded args); introduced by uncommitted local change adding chunked `getWinnerNotificationLogs` (`:50-68`).
- **Description:** `tsc --noEmit` exits 2: `Property 'args' does not exist on type 'Log<bigint, number, boolean, AbiEvent | undefined, …>'`. The chunked log fetcher's return type does not carry decoded `args`, so the `HGH-03` validation at line 227 no longer typechecks.
- **Impact:** Regresses the documented "KPR TypeScript baseline is currently clean … no-regression launch gate" (AGENTS.md). The winner-relay path — which relays Base lottery wins to Solana — is exactly the code the local edit touches.
- **Exploit path:** N/A (typecheck). Runtime behavior likely unaffected, but the gate is a launch invariant and is now failing.
- **Recommendation:** Type `getWinnerNotificationLogs` with the decoded event (`getLogs({ event })` returns `Log` with `args` when the event ABI item is passed; ensure `strict`/generic inference is preserved, or cast through `parseEventLogs`). Restore `pnpm -C kpr typecheck` to exit 0.

### H2-03 — Deploy-session `status` endpoint advances the deploy (not read-only preflight)

- **Area:** Frontend/API
- **File:line:** `frontend/api/_handlers/deploy/v2/session/_statusCore.ts:2316`, `:2546`, `:2931`, `:3035-3041`
- **Description:** `POST /api/deploy/v2/session/status` calls `advanceDeploySession()` on every non-terminal poll, which sends ERC-4337 UserOps (`sendUserOperation`), transitions deploy steps, runs Solana OVault preflight gates, and writes Ajna registry rows.
- **Impact:** The repo invariant "deploy status and preflight paths must be read-only … must not provision infrastructure, register tokens, or perform onchain mutation as a side effect" (AGENTS.md § Security and trust-boundary rules) is violated by the letter of the rule. A holder of a valid deploy session can drive sponsored vault deployment progression by polling `status`.
- **Exploit path:** Authenticated session holder polls `status` while session is in `phase*_sent`/confirmed → server submits UserOps from the delegated server signer → phases advance onchain. This requires an already-authorized session (trusted-ish), so it is privilege-gated, but the side-effecting "status" endpoint blurs the read-only boundary the audit rules require.
- **Recommendation:** Confirm intent with product. Either (a) split a strictly read-only `status` from an explicit `continue/advance` action gated on user intent/machine auth, or (b) if polling-driven advancement is intended for the deploy-session model, rename and document it so it is not classified as "status/preflight" under the read-only rule.

### H2-04 — `settledAt` writable without on-chain completion invariants (keeper + admin paths)

- **Area:** Frontend/API — keeper completion truth
- **File:line:** `frontend/api/_handlers/keeper/_markSettled.ts:36-68`; `frontend/api/_handlers/admin/control-plane/_settle.ts:31-54`; `frontend/server/_lib/controlPlane/executors/executeSettleVault.ts:76-91`
- **Description:** `/api/keeper/sweep` runs the five §5.1 completion invariants and only writes `settledAt` when `completionStage === 'completed'` (verified correct at `_sweep.ts:569-637`). But `/api/keeper/mark-settled` and `/api/admin/control-plane/settle` both call `controlPlane.settleVault()` directly. The only gate there is `validateSettledAt` — which enforces **invariant #5 only** (`settledAt` requires `settlementStage === 'completed'`) but performs **no** on-chain checks (feeRecipient / payoutRecipient / creatorTreasury / burnStream / migrate — invariants #1–#4).
- **Impact:** The DB canonical-completion truth can be set to "settled/completed" bypassing invariants 1–4. Public "live/settled" surfaces and ops runbooks can diverge from chain truth.
- **Exploit path:** Holder of `KEEPR_API_KEY` or admin session POSTs `{ vaultAddress, settledAt, settlementStage: 'completed' }` → `keepr_vaults.settled_at` written with no sweep/invariant proof.
- **Trusted role:** Yes (keeper machine auth / admin). Severity High because it defeats the canonical completion invariant on a second, lower-scrutiny door.
- **Recommendation:** Route all `settledAt` writes through the sweep completion gate, or have `settleVault` re-verify the same invariant bundle before accepting `completed`.

### H2-05 — Completion-invariant enforcement is bypassable via env and per-request flag

- **Area:** Frontend/API — keeper completion truth
- **File:line:** `frontend/api/_handlers/keeper/_sweep.ts:271-274`, `:569-584`, `:618-637`
- **Description:** `enforceCompletionInvariants` is `enforceInvariants` (request body boolean) when present, else `process.env.KEEPER_ENFORCE_COMPLETION_INVARIANTS !== 'false'`. A keeper client can send `enforceInvariants: false`, or ops can set the env to `false`, and the sweep can still reach `completionStage: 'completed'` (when hook config succeeds) and write `settledAt`.
- **Impact:** A single request flag or env flip disables the five-invariant gate while still marking the DB settled. AGENTS.md requires `KEEPER_ENFORCE_COMPLETION_INVARIANTS` enabled in production and that any override "must emit an operational alert."
- **Exploit path:** Trusted keeper POSTs `/api/keeper/sweep` with `enforceInvariants: false` + `markSettled` after hook success.
- **Trusted role:** Yes (keeper). High because it is a per-request bypass of the canonical completion invariant with no alert.
- **Recommendation:** Ignore the per-request override in production (accept only a break-glass env), fail closed when enforcement is disabled, and emit the required operational alert per AGENTS.md.

### H2-06 — Solana buy-detection is spoofable; hook token accounts not bound to mint

- **Area:** Solana program
- **File:line:** `programs/creator-share-hook/src/execute_hook.rs:87-97` (owner-only heuristic), `:87-106` (no `token_account.mint == mint` check); `programs/creator-share-hook/src/creator_config.rs:64-70`
- **Description:** Two reinforcing weaknesses behind C-01: (H2-06a / Solana F-02) buy classification trusts only `source_token_account.owner == allowlisted AMM program id`, which any user can fabricate by creating a token account with that owner; (H2-06b / Solana F-03) the hook never asserts `source/destination.mint == mint.key()`, so entries can be decoupled from actual share-token movement.
- **Impact:** Makes C-01 practical even against real pool vaults, and lets forged entries be produced with arbitrary token accounts.
- **Exploit path:** As C-01, without cooperation from Meteora/AMM.
- **Trusted role:** None.
- **Recommendation:** Enforce `token_account.mint == mint.key()` for source and destination; replace the owner heuristic with pool-specific PDAs or a signed keeper/oracle attestation; require a verified Token-2022 transfer CPI. Fix with C-01 before B2.

---

## Medium

### M2-01 — Sweep mutates chain before invariant gate (TOCTOU / partial completion)

- **File:line:** `frontend/api/_handlers/keeper/_sweep.ts:466-517` (sweep/migrate) vs `:569-584` (invariants)
- **Description:** `sweepCurrency()` and `migrate()` execute before `runCompletionInvariants()`. On invariant failure the DB correctly refuses `settledAt` (`completionStage: 'invariant_failed'`), but the vault is already migrated with potentially wrong fee routing / payoutRecipient / router wiring.
- **Impact:** Chain can be left "migrated but mis-wired" while DB stays unsettled; recovery is manual.
- **Recommendation:** Run a read-only invariant preflight on the pre-migration snapshot; block `migrate()` until invariants pass.

### M2-02 — `DEPLOY_ENFORCE_PHASE2_INVARIANTS` env bypass

- **File:line:** `frontend/api/_handlers/deploy/v2/session/_statusCore.ts:2133-2198`; `frontend/api/_handlers/deploy/v2/session/_continueCore.ts:1044`
- **Description:** Phase-2 invariant gate is skipped when `DEPLOY_ENFORCE_PHASE2_INVARIANTS=false` (defaults true). Mirrors H2-05 posture for the deploy path.
- **Impact:** Ops misconfig lets phase-2 finalize with miswired tradeFeeCollector / payoutRecipient / treasury / router readiness.
- **Recommendation:** Fail closed in production; require break-glass + alert.

### M2-03 — Production-readiness gates implemented but not wired into deploy

- **File:line:** `frontend/server/_lib/onchain/payoutRouterProductionReadiness.ts:104-172` (H-07 EOA-owner check); `frontend/server/_lib/lottery/lotteryProductionReadiness.ts:66-126` (M-15 timelock, H-06 hub forwarder). Invocations: **tests only**.
- **Description:** `verifyPayoutRouterProductionReadiness` and `verifyLotteryProductionReadiness` exist but are not called from the deploy session, phase-2 gate, or keeper sweep. Deploy uses `verifyPayoutRouterHarvestReadiness` (harvest path), not the production owner/timelock gates.
- **Impact:** v1.15.0 canary can go live with a hot-EOA `PayoutRouter` owner (H-07) or an unarmed lottery boost timelock (M-15) despite the audit intent — enforcement is purely operational (runbook checklist).
- **Recommendation:** Invoke both production-readiness checks in `verifyDeployPhase2Invariants` and/or the keeper sweep router-mode branch before `completed`.

### M2-04 — `txRouter` non-embedded canonical signers can fall back to `canonicalDirect` when paymaster denies

- **File:line:** `frontend/src/lib/tx/txRouter.ts:312-325`, `:805-851`, `:1129-1167`
- **Description:** Embedded Privy signers are blocked from direct fallback on sponsorship failure, but **external** CSW-owner EOAs fall back to `canonicalDirect` on paymaster policy errors. The routing decision is locked to `canonical4337`, but the runtime send path still falls back for non-embedded signers.
- **Impact:** Violates the invariant "no fallback to direct gas sends when sponsorship denied" for non-embedded canonical owners on approval+swap during paymaster denial. Rated Medium: it is a policy/consistency break, not fund loss (the CSW still owns the assets).
- **Recommendation:** Mirror embedded behavior — throw the sponsorship-required error for all canonical approval+swap batches when `canonical4337` fails.

### M2-05 — Hardcoded `BASE_SOLANA_BRIDGE` may be stale vs v1.15.0

- **File:line:** `frontend/api/_handlers/deploy/_registerSolanaBridgeToken.ts:110`, `:872-876`, `:1509-1514`; `frontend/src/config/contracts.defaults.ts:116`
- **Description:** Mutating registration uses the batcher's `solanaBridgeAdapter`, but dynamic route provisioning / scalar liveness reads a hardcoded `BASE_SOLANA_BRIDGE = 0x3eff766c…`. v1.15.0 handoff pins the adapter at `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1`.
- **Impact:** If the bridge core changed in the cutover, dynamic route provisioning / scalar checks validate against the wrong contract → Solana mesh preflight/register breaks or false-passes. Availability, not fund theft.
- **Recommendation:** Derive the bridge address from batcher/config, not a constant; add an integration test against the v1.15.0 batcher.

### M2-06 — x402 relayer falls back to global `PRIVATE_KEY`

- **File:line:** `frontend/server/_lib/creatorStrategy/x402.ts:303-309`, `:387-392`
- **Description:** x402 settlement uses `X402_RELAYER_PRIVATE_KEY` or falls back to `PRIVATE_KEY` (which owns the Solana bridge adapter and the protocol treasury Safe per AGENTS.md).
- **Impact:** Relayer compromise expands blast radius to owner-key operations if the fallback is active in production.
- **Recommendation:** Require a dedicated `X402_RELAYER_PRIVATE_KEY` in production; reject the `PRIVATE_KEY` fallback when `NODE_ENV=production`.

### M2-07 — `unpause()` FIFO flush of deferred VRF is unbounded (OOG can block unpause)

- **File:line:** `contracts/utilities/lottery/CreatorLotteryManager.sol:863-868` (defer push), `:2564-2573` (unpause loop)
- **Description:** The H-02 fix moved deferred-VRF settlement into an atomic FIFO flush in `unpause()`. `_deferredVrfRequestIds` has no cap; each `applyDeferredVrf` runs the full win path (up to 1024 registry slot scans). Extends July 1 **H-02**.
- **Impact:** Owner pause + many in-flight VRF callbacks → `unpause()` reverts out-of-gas → lottery stuck paused until manual per-request `applyDeferredVrf`. Not permissionless during pause (`whenNotPaused` on entries), so an attacker must pre-seed entries before the pause.
- **Recommendation:** Cap the deferred queue or batch-flush in chunks; document the ops runbook (drain via `applyDeferredVrf` while paused, then `unpause()`).

### M2-08 — KPR `relay_entries` re-enables against B1 policy unless env-gated

- **File:line:** `kpr/solana-keeper-orchestrator.ts` (calls `executeSolanaRelayEntries()` per configured actions); policy `docs/_internal/operations/operations/solana/solana-share-mesh-lottery-policy.md:59-60`
- **Description:** The relay-entries lane is disabled only by `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` / action list config, not by code. Config drift (re-seed without `=0`, new host, or running the workflow standalone) re-enables lottery-entry relay — which, combined with C-01, would relay forged entries to Base.
- **Impact:** Policy drift can activate the exact path that makes C-01 Base-impacting.
- **Recommendation:** Default-deny in `executeSolanaRelayEntries()` unless the enable flag is set; remove `relay-entries` from production workflow config until B2 and until C-01 is fixed.

### M2-09 — KPR dual scheduler double-execution risk (Vultr cron + Vercel fan-out)

- **File:line:** `kpr/kpr-workflows/solana-orchestrator/config.production.json:2-10`; `kpr/kpr-workflows/solana-orchestrator/main.ts:38-47`; `frontend/api/_handlers/keeper/jobs/_enqueueSolanaReconcile.ts:84-96`; `frontend/api/_handlers/keeper/_solanaReconcile.ts:199-235`
- **Description:** The Vercel path dedups reconcile via a Postgres daily checkpoint; the Vultr `main.ts` cron (`*/1`) runs actions in-process every minute without action-level dedup. If both trigger planes run, `settle_fees`/`price_monitor` can run ~1440×/day. `winner_relay` is file-checkpointed (safer).
- **Impact:** Duplicate Solana fee-harvest attempts, redundant load, races on partial failures.
- **Recommendation:** Run exactly one trigger plane; disable the Vultr solana-orchestrator cron if the Vercel→sidecar plane is canonical.

### M2-10 — `settle_fees` payout integrity depends on operator mappings + ATA delta

- **File:line:** `kpr/actions/keepr-solana-settle-fees.action.ts:87-94`, `:189-234`, `:261-268`
- **Description:** Settled amount = keeper ATA balance delta; destination ShareOFT resolved from `SOLANA_SHARE_OFT_MAPPING`. Preflight validates registration but not economic correctness; Solana settle runs even when the Base forward is blocked.
- **Impact:** Wrong mapping → fees attributed to the wrong creator/gauge; ATA donation before settlement inflates the delta.
- **Recommendation:** Bind mapping updates to control-plane session proof; assert on-chain `getTokenForShareOFT(shareOFT)` matches expected; separate "Solana harvest" from "Base forward" metrics.

### M2-11 — `winner_relay` permanently skips unmapped events (checkpoint advances)

- **File:line:** `kpr/actions/keepr-solana-winner-relay.action.ts:219-265`, `:334-337`
- **Description:** Events lacking a `creatorCoin→mint` or `twin→pubkey` mapping (and invalid-arg events) advance the checkpoint without a Solana write; only `record_winner` tx failure throws without advancing.
- **Impact:** Misconfigured mappings → winners never recorded on Solana with no automatic retry after fix; "you won" UX silently broken.
- **Recommendation:** Separate a "skipped" checkpoint from "processed"; alert on skip count; quarantine unmapped events.

### M2-12 — Solana `record_winner` has no replay / win-id binding

- **File:line:** `programs/creator-share-hook/src/record_winner.rs:41-56`; `programs/creator-share-hook/src/winner_record.rs:10-25`
- **Description:** One `WinnerRecord` PDA per mint; each call overwrites `winner`/`shares_paid`/`timestamp` with no nonce, Base tx hash, or round id (tests explicitly expect overwrite).
- **Impact:** Same Base win can be recorded repeatedly → duplicate `WinnerNotified` events and incorrect `shares_paid`; no on-chain linkage to a specific Base outcome.
- **Trusted role:** Keeper (compromised/buggy).
- **Recommendation:** Include `win_id` / Base event digest in PDA seeds or stored record; reject duplicates.

### M2-13 — Solana `settlement_threshold` stored but never enforced; withdraw authority unvalidated

- **File:line:** `programs/creator-share-hook/src/settle_fees.rs:50-108`, `:84-93`; `programs/creator-share-hook/src/creator_config.rs:34-36`
- **Description:** `settlement_threshold` is set but `settle_fees` never reads it; keeper can withdraw whenever the CPI succeeds. The withdraw CPI signer is `keeper` but the program does not confirm `keeper == mint TransferFeeConfig.withdraw_withheld_authority`.
- **Impact:** Batching policy silently bypassed; mint misconfig causes settlement liveness failure.
- **Recommendation:** Compare withheld balance/delta against `settlement_threshold` before withdraw; assert the withdraw authority matches the mint fee config.

### M2-14 — Supply-chain: unpinned Semgrep/Slither/CLIs and KPR excluded from CI audit

- **File:line:** `.github/workflows/security-scanning.yml:217-218`, `:227`, `:277`, `:330`, `:184-191`; `.github/workflows/docs-deploy.yml:26`; `.github/workflows/acp-daily-market-news.yml:44`
- **Description:** `semgrep/semgrep:latest` (floating), `pip install slither-analyzer` (unpinned), `vercel@latest` / `@virtuals-protocol/acp-cli` (unpinned). CI `dependency-audit` audits root/frontend/docs-site but **not** `kpr/` (the local script does).
- **Impact:** Non-reproducible security scan results; KPR advisories can slip past CI.
- **Recommendation:** Pin image digests / tool versions; add `pnpm --dir kpr audit --audit-level high` to CI.

---

## Low

| ID | Title | File:line | Note |
|----|-------|-----------|------|
| L2-01 | `resetPhase1State` does not require `finalized == false` | `contracts/helpers/batchers/DeploymentBatcher.sol:2350-2359` | Trusted treasury can delete a finalized phase-1 mapping → `finalizePhase2` fails `Phase1Missing`; retry hits occupied CREATE2 salts. Add `Phase1AlreadyFinalized` guard. |
| L2-02 | Initial `wireDeploymentHelpers` skips codehash validation | `DeploymentBatcher.sol:2274-2284` vs `:2290-2316` | Hot-swap setters validate; initial wire does not. Extends M-17. Seed allowlist + validate on wire. |
| L2-03 | PayoutRouter V3 `convertAndQueue` accepts `minOut == 0` | `contracts/utilities/routers/PayoutRouter.sol:340-371` | External path requires `minOut > 0`; V3 path does not. Keeper mistake → sandwichable conversion. |
| L2-04 | KPR `relay_entries` uses synthetic dedupe id, not Solana tx signature | `kpr/actions/keepr-solana-relay-entries.action.ts:35-49`, `:138-144`; `contracts/utilities/bridge/SolanaBridgeAdapter.sol:648-674` | `sha256(...)` synthetic id used for on-chain dedupe; low collision risk. |
| L2-05 | Orchestrator `sync_mapping` is high-privilege post-auth mutation | `kpr/actions/keepr-solana-sync-mapping.action.ts:120-163` | Authenticated action writes `/etc/4626/...env` + restarts service; validates format not ownership. Bind to control-plane session. |
| L2-06 | Solana `record_winner` missing mint cross-constraints | `programs/creator-share-hook/src/record_winner.rs:21-38` | Relies on PDA derivation only; add explicit `mint` equality constraints. |
| L2-07 | Solana config `authority` frozen at init | `programs/creator-share-hook/src/initialize_creator.rs:81-90`; `admin.rs:37-38` | Mint-authority rotation does not rotate config admin. Add two-step `claim_authority`. |
| L2-08 | `initialize_extra_account_meta_list` is permissionless | `programs/creator-share-hook/src/initialize_extra_account_meta_list.rs:14-49` | First initializer wins; griefing/ordering hazard. Require config/mint authority. |
| L2-09 | Admin can invoke Solana registration `buildOnly` without machine secret | `frontend/api/_handlers/deploy/_registerSolanaBridgeToken.ts:1001-1020` | Build-only path (no mutation) reachable via admin session; confirm it cannot mutate. |
| L2-10 | Duplicate AlfaClub deploy workflows fire on same `main` paths | `.github/workflows/deploy-alfaclub-proxy.yml`; `cloudflare-alfaclub-proxy-deploy.yml` | Double-deploy/race risk. Consolidate. |
| L2-11 | `verify-bytecode-store-seeded.ts` default still `v1.14.1` | `frontend/scripts/ops/verify-bytecode-store-seeded.ts:9` | Env overrides, but stale default is an operator footgun at cutover. |
| L2-12 | KPR `rebalance` stale references (code/test drift) | `kpr/tests/solana-keeper-orchestrator.test.ts:15`; `frontend/api/_handlers/keeper/jobs/_enqueueSolanaReconcile.ts:24` | `normalizeSolanaOrchestratorAction` has no `rebalance` case (returns null) but docs/enqueue/test still reference it. Remove. Confirms `keepr-solana-rebalance`/`SolanaStrategy`/`SolanaBridgeStrategy` fully removed from `kpr/`. |

---

## Informational

- **I2-01 — EIP-170 headroom tight.** `CreatorLotteryManager` 24,568 B (8 B margin); `CreatorShareOFT` 722 B; `CreatorOVault` 1,397 B. Any change to these forces redeploy/refactor. `forge build --sizes` exits 1 solely because two **test harness** contracts (`CreatorLotteryManagerHarness`, `CreatorLotteryManagerPauseHarness`) exceed the limit — harnesses are never deployed.
- **I2-02 — `getGlobalStats()` / `processPendingVrfResult()` removed** (H-02 remediation side effect). Indexers must read `totalLotteryEntries`, `totalWinners`, `totalRewardsPaid`; deferred VRF only via `unpause()` FIFO.
- **I2-03 — Solana dead error codes / silent lottery disable.** `LotteryDisabled`, `OverflowCounterMismatch`, `MetaListAlreadyInitialized` unused; hook returns `Ok(())` when lottery disabled (`execute_hook.rs:79-80`).
- **I2-04 — Solana ring-buffer overflow silently drops oldest entries** (`pending_entries.rs:72-85`); `needs_emergency_relay()` never enforced on-chain. Fairness/availability under spam; account size is fixed (~12KB) so no unbounded growth.
- **I2-05 — Solana integration tests omit adversarial hook cases** (`programs/creator-share-hook/tests/creator-share-hook.ts`) — regression risk for C-01 / H2-06.
- **I2-06 — Docs address drift:** `apps/docs-site/scripts/check-docs-contract-facts.mjs:164-166` still expects `v1.14.1` (doc is v1.15.0) → Docs Drift CI fails on docs-sensitive PRs; `docs/reference/addresses.md:25` vs `:55` show two Lottery Manager addresses (`0xD62a…` vs `0x29F9…`). Reconcile before cutover.

---

## Release-readiness verdict

### 1. Ready for AKITA canary deploy on v1.15.0 (Base vault Phases 1–4)?

**Conditionally yes — after clearing the RED CI gates and confirming H2-03.** The core contract logic is sound: all seven July 1 Highs are verified fixed (see [delta-vs-july-1.md](./delta-vs-july-1.md)), no permissionless Critical/High exists in the net-new Base contract cutover, phase invariants correctly reject deprecated Solana finalize params, and the keeper sweep enforces the five §5.1 completion invariants on its primary path. However, two documented launch gates are RED on `main` (`pnpm -C frontend test`, `pnpm -C kpr typecheck`), and the deploy-session `status` endpoint advancing the deploy (H2-03) needs an explicit product ruling against the read-only invariant. These are the gating items, not contract exploits.

### 2. Ready for Phase 5 Solana/Meteora automation?

**No.** C-01 (permissionless hook entry forgery) plus H2-06 (spoofable buy detection, unbound mint) mean the Solana lottery-entry surface is not safe to relay to Base. Phase 5 must not enable `relay_entries` (B2) until C-01/H2-06 are fixed, adversarial hook tests exist (I2-05), and `record_winner` replay protection (M2-12) is added. The current B1 pause is the only thing fencing this — M2-08 shows that fence is config-only.

### 3. Blockers vs acceptable operational debt

**Hard blockers (fix before mainnet traffic):**
- RED gates H2-01 (`frontend test`) and H2-02 (`kpr typecheck`).
- H2-03 read-only-status ruling.
- For Phase 5 only: C-01 + H2-06 + M2-12.

**Acceptable operational debt (track, mitigate operationally, not launch-blocking for Phases 1–4):**
- H-07 PayoutRouter owner → multisig transfer (run `verifyPayoutRouterProductionReadiness()` manually since M2-03 shows it is not auto-wired).
- M-15 `armBoostSourceTimelock()` before lottery traffic.
- Vultr `winner_relay` checkpoint operations and M2-11 unmapped-event skips.
- Unsettled `SOLANA_CREATOR_MINTS` and Alpha Vault operator steps (out-of-band per policy).
- Docs address drift (I2-06) and the seed-registry test staleness (see delta F-15).

### 4. Top 5 actions before mainnet traffic

1. **Turn both RED gates green** — fix the vitest `@4626/server-core` rate-limit mock drift + deploy-session mock/handler drift (H2-01) and the KPR `winner_relay` `log.args` type (H2-02); do not ship on stale "all passing" claims.
2. **Resolve H2-03** — split read-only deploy `status` from explicit advancement, or document/reclassify per product intent, so the read-only preflight invariant holds.
3. **Close the settled-truth doors** — route `mark-settled`/admin-settle through the §5.1 gate (H2-04) and remove the per-request/env invariant bypass with alerting (H2-05, M2-02).
4. **Enforce production-readiness in the deploy path** — wire `verifyPayoutRouterProductionReadiness` (H-07) and `verifyLotteryProductionReadiness` (M-15/H-06) into phase-2/sweep gating (M2-03); confirm PayoutRouter owner is a multisig and the boost timelock is armed.
5. **Fence Phase 5** — keep `relay_entries` default-denied in code (M2-08), and do not enable B2 until C-01, H2-06, and M2-12 are fixed with adversarial hook tests.
