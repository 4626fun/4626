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
   veVote           veChance
     │                 │
     ▼                 ▼
 GaugeVoting      BoostManager → Lottery mult
 (+ fees)         (single envelope + coverage)
```

| Decision | Choice |
|----------|--------|
| ■ placement | **Only** product name **ve■4626** |
| Desk | **`ve4626Utility`** |
| Lanes | **vote** / **chance** (not credit/unit/power) |
| Token type | **`ve4626UtilityToken`** non-transferable ERC-20 — **not B20** |
| Total power | Curve-style dual-decay `getTotalVotingPower()` |
| Lottery boost | **0.4×–1.0×** `calculateBoostForPosition(l,L,ve)` (2.5× tokenless → full); additive PPM ≡ 0 |
| Pool mapping | `l`=covered Share USD, `L`=creator Share supply USD, `ve`=effectiveChance |
| Decay vs claims | `sync` burns excess (chance first, then vote) |
| Stale utilities (P1) | `previewUtilities` / `effective*`; gauge `vote()` syncs; boost uses `effectiveChanceOf` |
| Gauge freeze | 1h before epoch end |
| Launch | Leave LM `boostManager` / `vaultGaugeVoting` at 0 until canary; personal boost later |

---

## Code map

| Path | Role |
|------|------|
| `contracts/shared/governance/ve4626.sol` | Lock + dual-decay |
| `contracts/shared/governance/ve4626Utility.sol` | claim / forfeit / sync / effective* |
| `contracts/shared/governance/ve4626UtilityToken.sol` | Non-transferable ERC-20 |
| `contracts/shared/governance/ve4626BoostManager.sol` | `calculateBoostForPosition` 0.4–1.0; `setUtility` → effective chance |
| `contracts/shared/governance/ve4626GaugeVoting.sol` | `setUtility` → sync + effective vote + freeze |
| `LotteryManager4626._applyBoost` | No additive lock PPM |
| `script/DeployRewardsEcosystem.s.sol` | Deploys + `setUtility` on voting + boost |
| `test/ve4626.RightsSplitAndDualDecay.t.sol` | Dual-decay + utility + P1 consumers |

---

## Audit notes (boost, 2026-07-09)

| Item | Status |
|------|--------|
| Formula `0.4·l + 0.6·L·(ve/Ve)`, cap `1.0·l` | Implemented |
| ve = `effectiveChanceOf` when utility wired | Implemented |
| LM uses `calculateBoostForPosition` + total Share USD as `L` | Implemented |
| Additive lock PPM | Removed (`getTotalProbabilityBoost` ≡ 0) |
| Delta vs LiquidityGaugeV5 | Gauge caps at **2.5·l**; we cap at **1.0·l** (product) |
| Full mult never exceeds base odds | By design (1.0× max); gauge PPM can still add |
| Launch | LM boost sources stay 0 until canary |

## Validation

```bash
forge test --match-contract Ve4626RightsSplitAndDualDecayTest
forge test --match-contract Ve4626BoostManagerMathTest
forge test --match-contract 'Ve4626|PauseGuards|BoostSource|AmoeLinear'
```

---

## Ops follow-ups (not code)

1. Deploy rewards ecosystem (or partial) on Base  
2. Confirm `setUtility` on BoostManager + GaugeVoting (sets chance/vote tokens)  
3. Keep lottery LM sources 0 until canary; leave personal boost off day one  
4. Arm `armBoostSourceTimelock` when boost source addresses final  
5. Hub ShareOFT forwarders (separate lottery readiness)  

