# Pre-lottery / launch ops checklist

**Purpose:** Close remaining **ops** and **product** gates after code remediation (2026-07-09).  
**Source of truth for open IDs:** [OPEN_FINDINGS_BOARD.md](./OPEN_FINDINGS_BOARD.md)

> **Superseded snapshot:** dated v1.18.0 / v1.19.0 addresses below remain as
> historical evidence. Current actionable release checks target v1.19.1.

Code remediation for July-2 stack + contract mediums is largely complete. Do **not** enable lottery traffic or Solana B2 `relay_entries` until the items below are done (or explicitly waived with an alert).

---

## 0. Canary order (2026-07)

Full phased canary (boost **off** day one): [lottery-canary-checklist-2026-07.md](../operations/lottery-canary-checklist-2026-07.md).  
Historical Phase 0 probe (2026-07-11): [lottery-canary-phase0-status-2026-07-11.md](../operations/lottery-canary-phase0-status-2026-07-11.md) — observed the then-remediation LM with boost sources `0x0`, `singleVaultJackpotOnly=true`, and deferred VRF queue `0`.

v1.19.1 is the canonical live release. Before traffic, verify the active
Batcher `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` Phase2 module has
`lotteryManager() == 0xB45E68a5867935a5734E4185977F81c528006650`, and verify the retired
Twin SolanaBridgeAdapter is absent from active config and is not rewired; verify Registry
`0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`, Factory
`0xCAb65a066A4D52DD29ffB418B319819176b89610`, store
`0xF9622613682a12E46b914c7498716F42E44c4d36`, and CREATE2 deployer
`0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2` against the v1.19.1 manifest.

| Phase | Intent |
|-------|--------|
| 0 | Keep `boostManager` / `vaultGaugeVoting` at **0**; no armBoost; Solana relay_entries off |
| 1 | Read-only verify LM + hub forwarders + KPR |
| 2 | Small traffic, base odds only |
| 3 | Wire boost/gauge **later**, then arm timelock |

---

## 1. LotteryManager production readiness (M2-03 wired)

| Step | Action | Verify |
|------|--------|--------|
| 1.1 | Keep the timelock unarmed for main-launch base-odds traffic. In canary Phase 3 only: freeze source addresses, arm while sources are `0`, then propose/wait/commit. | Phase-2 deploy invariants pass with `requireBoostTimelockArmed=false`; boost-enabled readiness requires armed |
| 1.2 | Authorize hub ShareOFT forwarders (H-06) | `authorizedHubShareOftForwarders[shareOft] == true` for each hub |
| 1.3 | Confirm R-H05 mode | Default **single-vault** (`singleVaultJackpotOnly == true`). Multi-vault only after public disclosure |
| 1.4 | Drain any deferred VRF after pauses | `processDeferredVrfBatch(16)` until `deferredVrfQueueLength() == 0` (M2-07) |
| 1.5 | Verify v1.19.1 deploy wiring | active `DeploymentBatcher.phase2Module().lotteryManager() == 0xB45E68a5867935a5734E4185977F81c528006650`; retired Twin SolanaBridgeAdapter absent from active config and not rewired; v1.19.1 codeIds seeded/approved |

API helpers:

- `verifyLotteryProductionReadiness` — `frontend/server/_lib/lottery/lotteryProductionReadiness.ts`
- Wired into deploy phase-2 invariants + keeper `/api/keeper/sweep` (critical only)

---

## 2. PayoutRouter / treasury (H-07 / AR-GOV)

| Step | Action | Verify |
|------|--------|--------|
| 2.1 | Transfer each production `CreatorPayoutRouter` owner to multisig or timelock | `verifyPayoutRouterProductionReadiness` — no `payout_router_owner_is_eoa` |
| 2.2 | Set keeper external spend caps per token before enabling external swaps (AR-L3) | `keeperExternalSpendCaps[token].cap > 0` and `window > 0` |
| 2.3 | Keep external swap target/spender allowlists minimal (M-05 residual) | No token contracts / vault / wrapper as targets |

---

## 3. Solana program upgrade (M2-12 / M2-13)

| Step | Action | Verify |
|------|--------|--------|
| 3.1 | Build + upgrade `creator-share-hook` with win_id PDA + settle threshold/auth | **DONE 2026-07-09** slot `431796316` — [upgrade record](../operations/solana-hook-upgrade-2026-07-09.md) |
| 3.2 | Redeploy/upgrade KPR winner-relay against new `record_winner` layout | **Pending prod redeploy** — code on main; [post-upgrade checklist](../operations/post-solana-hook-upgrade-checklist.md) |
| 3.3 | Keep **B2 `relay_entries` default-deny** until pool verify + C-01 fence still holds | `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` |
| 3.4 | Single trigger plane for Solana orchestrator (M2-09) | Local cron **off** unless sole plane; action leases enabled |

Program: `programs/creator-share-hook/`  
Upgrade runbook: AGENTS.md Solana program deployment section.

---

## 4. Vault / burn stream (AR-L2)

| Step | Action | Verify |
|------|--------|--------|
| 4.1 | Wire burn stream via `setBurnStream` (canary runs authorize + recover) | No `BurnStreamIntegrationCheckFailed` |
| 4.2 | Authorize payout router queuer via vault | `setBurnStreamAuthorizedQueuer(router, true)` |
| 4.3 | Ops path for failed burns | `recoverBurnStreamFailedBurns(amount)` on vault when needed |

---

## 5. Deploy / keeper env fail-closed (M2-02)

| Env | Production expectation |
|-----|------------------------|
| `DEPLOY_ENFORCE_PHASE2_INVARIANTS` | **true** (fail-closed in production) |
| `KEEPER_ENFORCE_COMPLETION_INVARIANTS` | **true** |
| `X402_RELAYER_PRIVATE_KEY` | Set; no `PRIVATE_KEY` fallback (M2-06) |
| `SOLANA_ORCHESTRATOR_LOCAL_CRON_ENABLED` | unset/`0` if Vercel→sidecar is canonical |

---

## 6. Explicit product decisions still open

| ID | Decision needed |
|----|-----------------|
| **R-H05** | Launch default is now **single-vault** in bytecode. Multi-vault requires owner flip + disclosure. |
| **M-05 residual** | Policy: which external swap targets/spenders are allowed long-term |
| **M-07 residual** | Solana lottery remains **trusted-keeper** model until entry path is redesign-hardened |

---

## Sign-off

- [ ] Lottery readiness: zero criticals  
- [ ] PayoutRouter owners: multisig/timelock  
- [x] Solana hook upgraded (slot `431796316`)  
- [ ] KPR/orchestrator redeployed + winner-relay smoke  
- [ ] B2 relay_entries still off  
- [ ] Env fail-closed confirmed on Vercel + Railway + Vultr orchestrator  
- [ ] Public docs match R-H05 mode actually deployed
- [ ] v1.19.1 Phase2 module LM, retired Twin adapter absence, store codeIds, and CREATE2 namespace verified

---

## Preflight snapshot (2026-07-09 agent)

See [ops-preflight-status-2026-07-09.md](../operations/ops-preflight-status-2026-07-09.md).

| Item | Snapshot |
|------|----------|
| Repo `main` | `f6c9fa93f` (#680+#681) |
| Solana `.so` build | 329 632 B — fits on-chain 372 488 (no extend) |
| Upgrade authority SOL | **0.0125** — need ~2.5 SOL before deploy |
| Agent secrets | **None** — cannot run mainnet txs here |
| Live LotteryManager | Superseded snapshot; remediation manager `0xB68F359e…` now exposes `singleVaultJackpotOnly` and `deferredVrfQueueLength` |
