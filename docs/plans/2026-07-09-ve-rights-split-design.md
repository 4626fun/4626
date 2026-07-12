# Design: ve■4626 utilities + dual-decay (implemented)

**Status:** Implemented in repo (2026-07-09). Live mainnet still unwired until deploy.  
**Naming authority:** [ve-naming.md](../contracts/governance/ve-naming.md)

---

## Final product model

```
■ → lock → ve■4626 (ve4626, dual-decay)
              │
              ▼ ve4626Utility
     ┌────────┴────────┐
     ▼                 ▼
   ve33           veLottery
     │                 │
     ▼                 ▼
 GaugeVoting      BoostManager → Lottery mult
 (+ fees)         (single envelope + coverage)
```

| Decision | Choice |
|----------|--------|
| ■ placement | **Only** product name **ve■4626** |
| Desk | **`ve4626Utility`** |
| Lanes | **ve33** / **veLottery** (not `veLotto`; Vote/Chance rejected) |
| Token type | **`ve4626UtilityToken`** non-transferable ERC-20 — **not B20** |
| Total power | Curve-style dual-decay `getTotalVotingPower()` |
| Lottery boost | **1.0×–2.5×** tokenless-normalized `calculateBoostForPosition(l,L,ve)`; additive lock PPM ≡ 0 |
| Pool mapping | `l`=covered Share USD, `L`=creator Share supply USD, `ve`=effectiveVeLottery, `Ve`=live total ve4626 |
| Coverage | `1 + (l/swapUSD)·(boost-1)` applies uplift only to covered trade value |
| Decay vs claims | `sync` burns excess (veLottery first, then ve33) |
| Stale utilities (P1) | `previewUtilities` / `effective*`; gauge `vote()` syncs; boost uses `effectiveVeLotteryOf` || Gauge freeze | 1h before epoch end |
| Launch | Leave LM `boostManager` / `vaultGaugeVoting` at 0 until canary; personal boost later |

---

## Code map

| Path | Role |
|------|------|
| `contracts/shared/governance/ve4626.sol` | Lock + dual-decay |
| `contracts/shared/governance/ve4626Utility.sol` | claim / forfeit / sync / effective* |
| `contracts/shared/governance/ve4626UtilityToken.sol` | Non-transferable ERC-20 |
| `contracts/shared/governance/ve4626BoostManager.sol` | `calculateBoostForPosition` 1.0–2.5; `setUtility` → effective veLottery |
| `contracts/shared/governance/ve4626GaugeVoting.sol` | `setUtility` → sync + effective ve33 + freeze || `LotteryManager4626._applyBoost` | No additive lock PPM |
| `script/DeployRewardsEcosystem.s.sol` | Deploys + `setUtility` on voting + boost |
| `test/ve4626.RightsSplitAndDualDecay.t.sol` | Dual-decay + utility + P1 consumers |

---

## Audit notes (boost, 2026-07-09)

| Item | Status |
|------|--------|
| Formula `0.4·l + 0.6·L·(ve/Ve)`, cap `1.0·l` | Implemented |
| ve = `effectiveVeLotteryOf` when utility wired | Implemented |
| Ve = live `getTotalVotingPower()` | Implemented |
| LM uses `calculateBoostForPosition` + total Share USD as `L` | Implemented |
| LM blends uplift by `l/swapUSD` coverage | Implemented |
| Additive lock PPM | Removed (`getTotalProbabilityBoost` ≡ 0) |
| LiquidityGaugeV5 parity | Working balance caps at `l`; normalized multiplier caps at **2.5×** |
| Unboosted behavior | Neutral **1.0×**; gauge PPM can still add || Launch | LM boost sources stay 0 until canary |

## Validation

```bash
forge test --match-contract Ve4626RightsSplitAndDualDecayTest
forge test --match-contract Ve4626BoostManagerMathTest
forge test --match-contract 'Ve4626|PauseGuards|BoostSource|AmoeLinear'
```

---

## Ops follow-ups (not code)

1. Deploy rewards ecosystem (or partial) on Base  
2. Confirm `setUtility` on BoostManager + GaugeVoting (sets veLottery/ve33 tokens)
3. Keep lottery LM sources 0 until canary; leave personal boost off day one  
4. Arm `armBoostSourceTimelock` when boost source addresses final  
5. Hub ShareOFT forwarders (separate lottery readiness)  

