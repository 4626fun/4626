# ve4626 Curve Boost Verification

Date: 2026-07-10 (delta refresh 2026-07-11)

Aristotle project: `46f81830-e389-4fe4-b03d-63bd050d8b0b`

| Task | Role | Status |
|------|------|--------|
| `5d7b6ebe-1a70-4900-a3c2-98c1bf13f96c` | Corrected Curve boost + effectiveBPS | COMPLETE |
| `e308abbb-3d22-4161-9f6c-03605330dd93` | Curve 2.5× analysis C1–C6 confirm | COMPLETE |
| `6fb0af61-13a0-49b0-a81d-9c1da934ede5` | Shipping delta D1–D3 (PricingLib + floor) | COMPLETE |

## Verdict

The corrected implementation is sound for the modeled Curve working-balance and lottery-coverage rules:

- raw personal boost is bounded to `[10_000, 25_000]` BPS (`1.0x` to `2.5x`)
- no eligible ve power is neutral at `10_000` BPS
- zero ShareOFT coverage is neutral
- partial coverage applies strictly less than the full raw uplift when an uplift exists
- the effective covered boost stays between `10_000` BPS and the raw boost
- the working-balance accumulator cannot exceed `L` when `l <= L` and `ve <= Ve`
- the boost is antitone in `Ve`, supporting the live `ve4626.getTotalVotingPower()` denominator instead of stale utility-token `totalSupply`

The original implementation snapshot was formally shown to return `[4_000, 10_000]` BPS and to penalize a covered user with no eligible ve power to `4_000` BPS. That defect is removed by normalizing against `0.4 * l`.

Curve algebra reminder (do not confuse):

- `working / l ∈ [0.4, 1.0]` with cap `working ≤ l`
- quoted boost `working / (0.4 · l) ∈ [1.0, 2.5]`
- full 2.5× iff ve share ≥ LP share (`l/L ≤ ve/Ve`)

## Proven model

```text
tokenlessWorking = floor(0.4 * l)
working = min(tokenlessWorking + floor(floor(0.6 * L) * ve / Ve), l)
rawBoost = clamp(floor(working * 10_000 / tokenlessWorking), 10_000, 25_000)

coverageBPS = floor(min(shareUSD, swapUSD) * 10_000 / swapUSD)
effectiveBPS = 10_000 + floor((rawBoost - 10_000) * coverageBPS / 10_000)
```

`l == 0`, `tokenlessWorking == 0`, or zero coverage returns the neutral `10_000` BPS result.

## Lean results (core)

The Aristotle project builds without `sorry` or `admit`. It proves:

- `curveBoost_mem_Icc`, `curveBoost_u_zero`, `curveBoost_U_zero`, `curveBoost_full_iff`
- `curveBoost_eq_min_r` (closed form `min(5/2, 1+(3/2)·r)`)
- `working_le_l`, `working_div_l_mem_Icc`
- `curveBoostRaised_le` / `curveBoostRaised_attains_max` (cap at 2.5·l ⇒ 6.25× — non-Curve)
- pre-cap monotonicity in `u` and `L`, and antitonicity in `U` and `l`
- `effectiveBoost_*`, `rawBoost_*`, `coverageBPS_le`, `effectiveBPS_*`
- `workingCorr_accumulator_le_L`, `rawBoost_anti_Ve`

## Delta verification (2026-07-11) — D1–D3 CONFIRM

Scoped continue on the same project; new lemmas in `RequestProject/Delta.lean` (no Curve 0.4/0.6 re-derivation). Shipping snapshot: `origin/main` / PR #687 (`fc1b45bab`, `be55bd823`).

| Gate | Verdict | Notes |
|------|---------|--------|
| **D1** Windowed `oracleMaxDeviationBps` + `oracleDeviationWindow` in `LotteryManager4626PricingLib` | **CONFIRM** | Fail-closed on stale/bad/missing oracle; deviation only inside window; after window elapses same jump accepted (no permanent lockout); inactive when window or maxDev is 0 |
| **D2** Covered floor = `BOOST_PRECISION`; `setBoostParameters` rejects `baseBoost ≠ 10_000` | **CONFIRM** / Curve **MATCH** | Floor independent of storage `baseBoost`; covered path equals prior `rawBoost` |
| **D3** LM `_applyBoost` coverage blend | **CONFIRM** | Still `effectiveBPS = 10000 + ⌊(rawBoost−10000)·coverageBPS/10000⌋` |

## Repository implementation

- `ve4626BoostManager.calculateBoostForPosition` returns the tokenless-normalized raw multiplier; covered floor is `BOOST_PRECISION`.
- `LotteryManager4626._applyBoost` blends only the covered fraction of the uplift.
- `LotteryManager4626PricingLib.calculateTokenUSD` owns windowed oracle guards (linked CREATE2 library).
- `ve4626BoostManager._powerShare` uses effective `veLottery` for the numerator and live total ve4626 power for the denominator.
- Forge: `LotteryManager4626.Hardening.t.sol`, `LotteryManager4626.BytecodeLink.t.sol`, `ve4626BoostManager.t.sol`, plus renamed LM suites.
- Ops harden order: [lottery-canary-checklist-2026-07.md](../../operations/lottery-canary-checklist-2026-07.md) — boost sources stay `address(0)` until Phase 3.
