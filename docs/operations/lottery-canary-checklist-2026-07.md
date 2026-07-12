# Lottery canary checklist (2026-07)

**Branch context:** `docs/post-solana-hook-upgrade` (ve utilities + Curve boost + LM size cut).  
**Companion:** [PRE_LOTTERY_OPS_CHECKLIST.md](../audits/PRE_LOTTERY_OPS_CHECKLIST.md), [post-solana-hook-upgrade-checklist.md](./post-solana-hook-upgrade-checklist.md).

**Goal:** Safe lottery traffic **without** personal boost or gauge boost on day one.

**Live status (2026-07-11):** [lottery-canary-phase0-status-2026-07-11.md](./lottery-canary-phase0-status-2026-07-11.md). Re-run: `pnpm -C frontend ops:verify-lottery-canary-phase0`.

---

## Phase 0 — Do not enable (fail closed)

| Flag / surface | Required state |
|----------------|----------------|
| LM `boostManager()` | **`address(0)`** until Phase 3 |
| LM `vaultGaugeVoting()` | **`address(0)`** until Phase 3 |
| `armBoostSourceTimelock()` | **Do not arm** until boost addresses are final and monitored |
| Solana `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED` | **`0` / unset** |
| Multi-vault jackpot | Keep `singleVaultJackpotOnly == true` (R-H05) |

---

## Phase 1 — Pre-canary verification (read-only)

### 1.1 On-chain LotteryManager4626

```bash
# Set LM= live LotteryManager4626 address
cast call $LM "boostManager()(address)" --rpc-url $BASE_RPC_URL
cast call $LM "vaultGaugeVoting()(address)" --rpc-url $BASE_RPC_URL
cast call $LM "singleVaultJackpotOnly()(bool)" --rpc-url $BASE_RPC_URL
cast call $LM "lotteryConfig()(uint256,uint256,bool,uint256,uint256,uint256)" --rpc-url $BASE_RPC_URL
cast call $LM "deferredVrfQueueLength()(uint256)" --rpc-url $BASE_RPC_URL
```

| Check | Expect |
|-------|--------|
| boostManager | `0x0` |
| vaultGaugeVoting | `0x0` |
| singleVaultJackpotOnly | `true` |
| lotteryConfig.isActive | product decision (canary may enable for one token only) |
| deferred VRF queue | `0` (or drain with `processDeferredVrfBatch`) |

### 1.2 Hub ShareOFT / forwarders (if enabling live entries)

- [ ] Hub ShareOFT authorized as swap contract on LM (or path product uses)
- [ ] `authorizedHubShareOftForwarders[shareOft] == true` for each hub ShareOFT that forwards entries
- [ ] `verifyLotteryProductionReadiness` / phase-2 + sweep report **zero criticals**

### 1.3 Solana / KPR (post hook upgrade)

- [ ] Orchestrator on code with `win_id` winner-relay ([post-upgrade checklist](./post-solana-hook-upgrade-checklist.md))
- [ ] `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`
- [ ] `/healthz` / reconcile healthy on Vultr plane
- [ ] No unplanned second XMTP/Solana consumer

### 1.4 Deploy / keeper env

| Env | Production |
|-----|------------|
| `DEPLOY_ENFORCE_PHASE2_INVARIANTS` | true |
| `KEEPER_ENFORCE_COMPLETION_INVARIANTS` | true |
| `X402_RELAYER_PRIVATE_KEY` | set (no bare `PRIVATE_KEY` fallback) |

---

## Phase 2 — Canary traffic (base odds only)

### 2.1 Scope

- Prefer **one** creator coin / ShareOFT lane with known oracle and gauge reserves
- Small notional swaps first (above `minSwapAmount`)
- Confirm entries appear: events / `tokenStats` / VRF requests

### 2.2 Observe

| Signal | Healthy |
|--------|---------|
| Entry creation | `LotteryEntryCreated` (or path equivalent) with non-zero request id |
| Win chance | Matches **linear** `swapUSD/250_000` capped by `baseCeilingPPM` (**no** personal mult while boostManager=0) |
| VRF settle | Local or cross-chain path settles; no stuck deferred queue |
| Jackpot | Single-vault payout only; gauge reserve decreases only on win |
| Errors | No reverts from empty ShareOFT code, pricing fail-closed → skip entry (usd=0) not brick |

### 2.3 Abort criteria (disable `lotteryConfig.isActive` or pause LM)

- Deferred VRF queue grows unbounded after pause/unpause
- Jackpot path reverts leaving payouts stuck
- Oracle deviation/staleness mass-skips without ops visibility
- Any accidental non-zero `boostManager` / `vaultGaugeVoting` without canary plan

---

## Phase 3 — Boost / gauge (later; separate change window)

Only after Phase 2 is stable:

1. Deploy rewards stack (`DeployRewardsEcosystem`): `ve4626`, `ve4626Utility`, BoostManager, GaugeVoting. The deploy script does **not** activate LM sources.
2. Verify **`boostManager.setUtility(utility)`**, **`voting.setUtility(utility)`**, and `ve4626.setBoostManager(boostManager)`; confirm LM sources are still `0`.
3. Freeze and review the final source addresses, then call `armBoostSourceTimelock()` (one-way) while both LM sources remain `0`.
4. Call `proposeBoostManager` + `proposeVe4626GaugeVoting`, wait at least 24 hours, then call both commit functions.
5. For a lock created before BoostManager wiring, call `ve4626.checkpointBoostEligibility()` and wait the full `MIN_HOLDING_BLOCKS`.
6. Canary one locker with **veLottery** + Share coverage. The raw quote reaches **2.5×** only when ve share ≥ LP share; only covered trade value receives the uplift.

**Do not** arm timelock before boost addresses are frozen.

### Boost math reminder (C5)

```text
working = min(l, 0.4·l + 0.6·L·(ve/Ve))   # l = covered Share USD
quotedBoost BPS = working/(0.4·l) ∈ [10_000, 25_000]
coverageBPS = floor(l × 10_000 / swapUSD)
effectiveBPS = 10_000 + floor((quotedBoost BPS - 10_000) × coverageBPS / 10_000)
odds = base × effectiveBPS / 10_000
```

Covered + no eligible veLottery → **1.0×** (neutral). Full coverage + full ve/LP match → **2.5×**.

---

## Phase 4 — Post-canary

- [ ] Document live LM / boost / utility addresses in `docs/reference/addresses.md` (if deployed)
- [ ] Size budget: main LM ~**23.8 KB** (+~0.8 KB headroom); new LM features need size note
- [ ] Keep Solana B2 relay off until pool verify + product OK

---

## Quick command pack (ops)

```bash
# Readiness helper (repo)
# pnpm -C frontend exec tsx --env-file=.env <path-to-verifyLotteryProductionReadiness if scripted>

# Drain deferred VRF (owner/keeper path as applicable)
# cast send $LM "processDeferredVrfBatch(uint256)" 16 --rpc-url $BASE_RPC_URL --private-key $PK
```

---

## Related code (this branch)

| Area | Notes |
|------|--------|
| Curve boost | `ve4626BoostManager.calculateBoostForPosition` → quoted BPS |
| Utility | `ve4626Utility` veVote / veChance + sync / effective* |
| LM size | PricingLib + payout via AdminModule DELEGATECALL |
| Naming | Tests/CI use `LotteryManager4626` (not CreatorLotteryManager) |
