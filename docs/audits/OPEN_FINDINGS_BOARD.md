# Open findings board — 2026-07-08

Sources: contracts re-audit (`2026-07-08-contracts-reaudit/`), Aristotle trackers (`aristotle/`, `CreatorOVault_aristotle/`), July-2 full-stack remediation (`july-2-2026/remediation.md`).

**Critical open: 0**

> **Superseded snapshot:** v1.18.0 addresses remain where they document dated
> findings. Current actionable checks use the canonical v1.19.1 release.

Update statuses in place as work lands. Prefer linking a PR or commit when closing an ID.

**Last code pass:** 2026-07-09

**Analyzer pass:** 2026-07-17 — [security-scan-2026-07-17](./security-scan-2026-07-17/) (Aderyn + focused Slither + semantic pass; One Dollar Audit pending USDC). — contracts + stack mediums closed; R-H05 launch default single-vault; ops checklist at [PRE_LOTTERY_OPS_CHECKLIST.md](./PRE_LOTTERY_OPS_CHECKLIST.md).

---

## Wave P2 — next code (contracts)

| ID | One-liner | Status | Suggested owner |
|----|-----------|--------|-----------------|
| **H-07** | Charm emergency can drain to strategy owner | **Fixed** (2026-07-09) — vault-only recipient; Charm pull forwards to vault | Contracts |
| **H-05** | Charm residuals: emergency `minOut=0`, uncapped slippage | **Fixed** (2026-07-09) — emergency mins + `MAX_SLIPPAGE_BPS=2000` | Contracts |
| **R-H04** | `setLocalVRFConsumer` no timelock | **Fixed** (2026-07-09) — bootstrap-only set; 2d queue/execute | Contracts |
| **H-06** | ShareOFT mint has no vault-backing check | **Fixed** (2026-07-09) — vault/minter-only mint + wrapper vault-share backing; cannot clear wrapper while supply > 0 | Contracts |
| **CO-H1** | Queue claim underpays / bank-run lock (`claimQueuedWithdrawal`) | **Fixed** (verified 2026-07-09) — uses uncapped `convertToAssets`; regression in `CreatorOVault.Report.t.sol` | Contracts (vault) |
| **AR-M2** | Burn-stream failed-burn double-count | **Fixed** (verified 2026-07-09) — `failedBurnAccumulator` in accounted; regression in burn-stream integration test | Contracts |

---

## Product / governance decisions

| ID | One-liner | Status | Suggested owner |
|----|-----------|--------|-----------------|
| **R-H05** | Multi-vault jackpot skims all vaults (69%) | **Launch default set** (2026-07-09) — `singleVaultJackpotOnly = true`; multi-vault requires owner flip + disclosure — [decision](./R-H05-multi-vault-jackpot-decision.md) | Product + contracts |
| **AR-L3** | External-swap keeper: caps / timelock | **Fixed** (verified 2026-07-09) — `keeperExternalSpendCaps` enforced; owner exempt; fail-closed if unset | Contracts |
| **AR-GOV** | Multisig + timelock policy across TCB | Open (ops) — checklist: [PRE_LOTTERY_OPS_CHECKLIST.md](./PRE_LOTTERY_OPS_CHECKLIST.md) | Ops |
| **CO-M2** | Impairment Suspect can freeze indefinitely | **Fixed** (verified 2026-07-09) — guardian/owner trip; `maxImpairmentTripDuration` + permissionless `clearStaleImpairmentTrip` | Contracts |
| **CO-M4** | `buyDebt` no claim/position returned | **Fixed** (verified 2026-07-09) — `buyDebt` reverts `DebtPurchaseDisabled` | Contracts |

---

## Medium backlog — contracts (re-audit)

| ID | One-liner | Status | Suggested owner |
|----|-----------|--------|-----------------|
| **M-01** | Impairment challenge not public | **Fixed** (2026-07-09) — `challengeImpairmentRoot` is public | Contracts |
| **M-02** | `strategyMaxAssets` default uncapped | **Fixed** (2026-07-09) — unset (0) only trusts `strategyDebt`; use `type(uint256).max` for intentional uncap | Contracts |
| **M-03** | ShareOFT `convertToAssets` ignores 1000× | **Fixed** (2026-07-09) — multiplies by `VAULT_SHARE_NORMALIZATION` before vault convert | Contracts |
| **M-04** | Queue claim at claim-time PPS | **Mitigated** via CO-H1 uncapped convert; claim-time PPS is intentional for queue path | Contracts (overlaps CO-H1) |
| **M-05** | External swap arbitrary call | **Hardened** (2026-07-09) — code-only target, `value:0`, no ETH delta; still allowlisted by design | Contracts |
| **M-06** | Remote oracle no deviation clamp | **Fixed** (2026-07-09) — CreatorOracle remote receive matches AgentOracle step-clamp | Contracts |
| **M-07** | Solana lottery = trusted keeper | **Hardened** (2026-07-09) — batch cap 50 + optional per-token max amount; still trusted keeper model | Contracts + KPR |
| **M-08** | Registry live rebind | **Fixed** (2026-07-09) — one-shot bindings; owner-only rebind when `liveRebindEnabled` | Contracts |
| **M-09** | CCA residual sweeps vacuum LP | **Fixed** (2026-07-09) — post-migrate/fail only; preserve `lpReserveAmount` until seed | Contracts |
| **M-10** | LP manager zero-slippage burns | **Fixed** (2026-07-09) — burn/decrease mins from expected × slippage bps | Contracts |
| **M-11** | Local VRF no callback retry | **Fixed** (2026-07-09) — `VRFConsumer4626.retryLocalCallback` | Contracts |
| **M-12** | Winner callback “shares paid” = vault count | **Fixed** (2026-07-09) — payout returns ShareOFT sum; `MultiTokenJackpotWon` keeps vault count | Contracts |
| **M-12-AMOE** | Instant `setAuthorizedAmoeRelayer` | **Fixed** (2026-07-09) — bootstrap-only + 2d queue/execute (parity with R-H04) | Contracts |
| **M-13** | Bribe rollover confiscates late claims | **Fixed** (2026-07-09) — `rolloverExpiredEpoch` owner-only; grace floor | Contracts |
| **M-14** | Ajna buffer-only withdraw grief | **Fixed** (2026-07-09) — 5% min buffer ratio always enforced | Contracts |
| **M-15** | `resetPhase1State` allows finalized reset | **Fixed** (2026-07-09) — `Phase1AlreadyFinalized` | Contracts |
| **M-NEW-01** | Payout router `minOut == 0` | **Fixed** (2026-07-09) — swap path requires `minOut > 0` (creator/agent) | Contracts |
| **M-NEW-02** | Eject asset ≠ epoch.recoveryAsset | **Fixed** (2026-07-09) — pin empty recoveryAsset; emit mismatch if diverged | Contracts |
| **M-NEW-03** | Remote ShareOFT reverse-map single | **Fixed** (2026-07-09) — `ReverseMappingConflict` on shareOFT + remote OFT reverse | Contracts |
| **CO-M1** | Module storage layout not CI-guarded | **Fixed** (verified 2026-07-09) — `scripts/check-ovault-module-storage-layout.mjs` in CI (`test.yml`) | Contracts + CI |
| **CO-M3** | `riskConfigDelay` default 0 | **Fixed** (verified 2026-07-09) — constructor sets `MIN_RISK_CONFIG_DELAY` (1 day) | Contracts |
| **AR-L2** | Burn-stream `msg.sender == vault` checks | **Fixed** (2026-07-09) — vault `recoverBurnStreamFailedBurns` + setBurnStream canary for recover path | Contracts |

---

## July-2 full-stack (ops / frontend / Solana) — still open

| ID | One-liner | Status | Suggested owner |
|----|-----------|--------|-----------------|
| **M2-01** | Sweep mutates before invariant gate | **Fixed** (2026-07-09) — preflight invariants before `migrate()` | Keeper / API |
| **M2-02** | Phase-2 / completion invariant env bypass | **Fixed** (2026-07-09) — production fail-closed for `DEPLOY_ENFORCE_PHASE2_INVARIANTS` + `KEEPER_ENFORCE_COMPLETION_INVARIANTS` | Deploy / ops |
| **M2-03** | Prod-readiness gates tests-only | **Fixed** (2026-07-09) — wired into phase-2 invariants + keeper sweep (critical only) | Deploy / Keeper |
| **M2-04** | `txRouter` → `canonicalDirect` fallback | **Fixed** (2026-07-09) — multi-call approval+swap never falls back to un-sponsored direct | Frontend wallet |
| **M2-05** | Hardcoded `BASE_SOLANA_BRIDGE` | **Fixed** (2026-07-09) — `resolveBaseSolanaBridge` (env → adapter.BRIDGE → default) | Frontend / config |
| **M2-06** | x402 falls back to `PRIVATE_KEY` | **Fixed** (2026-07-09) — production requires `X402_RELAYER_PRIVATE_KEY` only | API security |
| **M2-07** | `unpause()` VRF FIFO OOG | **Fixed** (2026-07-09) — FIFO queue + head-only apply + `processDeferredVrfBatch` (cap 16) | Contracts |
| **M2-09** | KPR dual-scheduler double-exec | **Fixed** (2026-07-09) — local cron opt-in; action lease dedup | KPR |
| **M2-10** | `settle_fees` mapping integrity | **Fixed** (2026-07-09) — registry ShareOFT assert + harvest/forward metrics | KPR |
| **M2-11** | Winner relay skips unmapped forever | **Fixed** (2026-07-09) — quarantine + retry + alert | KPR |
| **M2-12** | Solana `record_winner` no win-id | **Fixed** (2026-07-09) — per-`win_id` PDA + KPR digest | Solana |
| **M2-13** | Settlement threshold / withdraw auth | **Fixed** (2026-07-09) — threshold gate + withdraw authority check | Solana |
| **M2-14** | Unpinned tools; KPR off CI audit | **Fixed** (2026-07-09) — pin Semgrep/Slither/CLIs; `kpr` audit in CI | Security / CI |
| **L2-01** | Finalized phase-1 reset (overlaps M-15) | **Fixed** (with M-15) | Contracts |
| **L2-03** | PayoutRouter `minOut == 0` (overlaps M-NEW-01) | **Fixed** (with M-NEW-01) | Contracts |

**Gate:** Solana **B2 `relay_entries` stays off**. M2-12/13 and pool verification are not sufficient. The source-event identity, durable inbox, keeper-Twin transport, and token/pool compatibility gates in [the 2026-07-11 integration audit](./solana-lottery-relay-integration-audit-2026-07-11.md) must also close; the retired Twin adapter must remain out of active config.

### Solana lottery relay integration (2026-07-11 → LZ-era close 2026-07-17)

| ID | Status | Gate |
|----|--------|------|
| SOL-P0-01 | Fixed in source / enablement blocked | Twin retired; fail-closed LZ `MSG_TYPE_LOTTERY_ENTRY` transport modules; OApp peer + flag remain unset |
| SOL-P0-02 | Fixed in source | Finalized `(genesis, program, signature, ix, event index)` + `solana_lottery_entry_inbox` |
| SOL-P0-03 | Closed / superseded | Retired Twin adapter must remain out of active config |
| SOL-P0-04 | Fixed in source / venue canary deferred | B1 SPL = trading only; B2 Token-2022+Meteora `token_badge` = eligibility; one-buy→one-event tests |
| SOL-P1-01 | Fixed in source | Durable inbox + `FOR UPDATE SKIP LOCKED` lease + crash-after-submit recovery |
| SOL-P1-02 | Fixed in source | Event-log ingest canonical; 256 ring buffer reconciliation-only |
| SOL-P1-03 | Fixed in source | Injective winner maps + strict `u64` payout |
| SOL-P1-04 | Fixed in source / undeployed | Registry bytes32 reverse-map conflict protection |
| SOL-P1-05 | Fixed | B2 missing-RPC and wrong-owner checks fail closed |
| SOL-P1-06 | Fixed | KPR defaults + release guard |

**Verdicts (unchanged):** `Solana personal veLottery boost safe to enable: NO` · `Solana base-odds relay safe to enable: NO` (live OApp peer + ops canary still required). Relay flag must stay `0`. Detail: `docs/_internal/audits-workpapers/solana-lottery-relay-lz-era-close-2026-07-17.md`.

---

## Ops carryovers (not code IDs — before lottery traffic)

| Item | Status | Owner |
|------|--------|-------|
| PayoutRouter → multisig/timelock + readiness verify | Open | Ops |
| `armBoostSourceTimelock()` | Open | Ops |
| Hub ShareOFT forwarder auth | Open | Ops |
| Approve/freeze phase module codehashes + codeIds | Open (post-cutover) | Ops |
| `verifyLotteryProductionReadiness()` | **Wired** into phase-2 + sweep (M2-03); ops must still `armBoostSourceTimelock()` | Ops |

---

## Already closed this cycle (do not re-open)

| Band | IDs |
|------|-----|
| Critical | C-01 (salt); July-2 Solana hook forgery (mainnet) |
| High fixed | H-01…H-08, NEW-H, R-H01…R-H04 |
| Aristotle fixed | AlfaClub LP lock, bridge CCA owner, strategy rescue, Charm core, CCA migrate/seed, Univ4 LP mgr, Ajna move, deferred VRF |

**P2 validation (2026-07-09):**

```text
forge test --match-path 'test/vault/CharmStrategy4626.Oracle.t.sol' \
  --match-test 'test_ownerEmergency|test_setParameters_caps|test_emergencyWithdraw_uses'  → 4/4
forge test --match-path 'test/audit/Audit20260708.P2.t.sol'  → 2/2
forge test --match-path 'test/LotteryManager4626.AmoeLinearParity.t.sol'  → 29/29
forge test --match-path 'test/CreatorOVault.Report.t.sol' \
  --match-test 'test_claimQueuedWithdrawal_fullQueuePaysFullEntitlement'  → 1/1  (CO-H1)
forge test --match-path 'test/revenue/VaultShareBurnStream.Integration.t.sol' \
  --match-test 'test_recoverFailedBurnsOnlyVault'  → 1/1  (AR-M2)
forge test --match-path 'test/audit/Audit20260708.H06.t.sol'  → 5/5  (H-06)
forge test --match-path 'test/CreatorOVaultWrapper.ShareOFTValidation.t.sol'  → 6/6
forge test --match-path 'test/CreatorShareOFT.Lottery.t.sol'  → 26/26
forge test --match-path 'test/DeploymentBatcher.ThreeWaySplit.t.sol' --match-test 'test_resetPhase1'  → 6/6  (M-15)
forge test --match-path 'test/PayoutRouter.t.sol' --match-test 'test_convertAndQueue'  → 6/6  (M-NEW-01)
forge test --match-path 'test/audit/Audit20260708.P2.t.sol'  → 3/3  (R-H04 + R-H05 toggle)
forge test --match-path 'test/audit/Audit20260708.Medium.t.sol'  → 3/3  (M-01/02/03)
forge test --match-path 'test/vault/strategies/CreatorOVaultStrategies.MaxAssetsCap.t.sol'  → 8/8  (M-02)
forge test --match-path 'test/audit/Audit20260708.Medium2.t.sol'  → 6/6  (M-08/M-10/M-12-AMOE)
forge test --match-path 'test/audit/Audit20260708.Medium3.t.sol'  → 3/3  (M-13/M-14)
forge test --match-path 'test/AjnaERC4626Vault.t.sol' --match-test 'testWithdrawRevertsWhenBuffer|testKeeperMoveFromBuffer'  → 2/2
forge test --match-path 'test/audit/Audit20260708.Medium4.t.sol'  → 4/4  (M-NEW-03/M-11/M-12)
forge test --match-path 'test/PayoutRouter.t.sol' --match-test 'test_convertAndQueue|External'  → 10/10  (M-05)
pnpm -C frontend exec vitest run src/lib/tx/txRouter.test.ts api/__tests__/keeperSweep.test.ts  → 31/31  (M2-04 / M2-01)
pnpm -C frontend exec vitest run server/_lib/onchain/resolveBaseSolanaBridge.test.ts \
  server/_lib/deploy/deployPhase2Invariants.test.ts api/__tests__/keeperSweep.test.ts  → M2-03 / M2-05
pnpm -C kpr test  → 215/215  (M2-09 lease, M2-11 quarantine, orchestrator)
pnpm -C kpr typecheck  → clean
cargo check -p creator-share-hook  → ok  (M2-12 win_id PDA, M2-13 threshold/authority)
forge test --match-path 'test/LotteryManager4626.PauseGuards.t.sol'  → 10/10  (M2-07 FIFO batch)
forge test --match-path 'test/revenue/VaultShareBurnStream.Integration.t.sol'  → 2/2  (AR-L2)
node scripts/check-ovault-module-storage-layout.mjs  → pass  (CO-M1)
forge test --match-test 'test_buyDebt|test_maxImpairmentTrip|clearStaleImpairment'  → 6/6  (CO-M2/CO-M4)
forge test --match-path 'test/audit/Audit20260708.P2.t.sol' --match-test singleVault  → R-H05 default true
```

Detail: [2026-07-08-contracts-reaudit/](./2026-07-08-contracts-reaudit/), [aristotle/OPEN_VS_FIXED_2026-07-08.md](./aristotle/OPEN_VS_FIXED_2026-07-08.md), [july-2-2026/remediation.md](./july-2-2026/remediation.md).

---

## Suggested execution order

1. ~~**Contracts P2 Highs (H-05…H-07, R-H04, H-06)**~~ **done 2026-07-09**
2. ~~**CO-H1 + AR-M2**~~ **verified already fixed 2026-07-09**
3. ~~**M-15 + M-NEW-01**~~ **done 2026-07-09**; **R-H05** control shipped (product picks launch mode)
4. ~~**Product R-H05 launch default**~~ **single-vault default 2026-07-09**
5. **Privilege / ops:** execute [PRE_LOTTERY_OPS_CHECKLIST.md](./PRE_LOTTERY_OPS_CHECKLIST.md) (Safe+timelock, arm boost, hub forwarders, Solana upgrade)
6. ~~**Stack before Phase 5 / B2**~~ **code done**; B2 still gated on program upgrade + pool verify
7. ~~**Medium mop-up M-01/02/03/06**~~ **done 2026-07-09**
8. ~~**Medium mop-up M-05…M-14 + M-NEW-***~~ **done 2026-07-09** (M-05/M-07 residual = policy/trust model)
9. ~~**Stack M2-01…M2-14 + M2-07**~~ **done 2026-07-09**
10. ~~**CO-M1/2/3/4 + AR-L2/L3**~~ **verified fixed 2026-07-09**
11. **Still open (ops/product only):** AR-GOV Safe+timelock; lottery readiness arm; **deploy** creator-share-hook; M-05 allowlist policy; M-07 trusted-keeper model acceptance

---

## ID key

| Prefix | Source |
|--------|--------|
| H- / M- / R-H / NEW-H / M-NEW- | `2026-07-08-contracts-reaudit` |
| CO- | `CreatorOVault_aristotle` |
| AR- | `aristotle/OPEN_VS_FIXED` + oracle audit |
| M2- / L2- | `july-2-2026` full-stack |

## 2026-07-17 Phase2 / v1.19.2 delta

See [`phase2-source-delta-security-review-2026-07-17.md`](./phase2-source-delta-security-review-2026-07-17.md).
