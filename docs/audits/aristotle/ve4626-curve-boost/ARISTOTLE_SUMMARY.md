# ve4626 Curve Boost Verification

Date: 2026-07-10

Aristotle project: `46f81830-e389-4fe4-b03d-63bd050d8b0b`

Final corrected-code task: `5d7b6ebe-1a70-4900-a3c2-98c1bf13f96c`

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

## Proven model

```text
tokenlessWorking = floor(0.4 * l)
working = min(tokenlessWorking + floor(floor(0.6 * L) * ve / Ve), l)
rawBoost = clamp(floor(working * 10_000 / tokenlessWorking), 10_000, 25_000)

coverageBPS = floor(min(shareUSD, swapUSD) * 10_000 / swapUSD)
effectiveBPS = 10_000 + floor((rawBoost - 10_000) * coverageBPS / 10_000)
```

`l == 0`, `tokenlessWorking == 0`, or zero coverage returns the neutral `10_000` BPS result.

## Lean results

The final Aristotle project builds without `sorry` or `admit`. It proves:

- `curveBoost_mem_Icc`
- `curveBoost_u_zero`
- `curveBoost_U_zero`
- `curveBoost_full_iff`
- pre-cap monotonicity in `u` and `L`, and antitonicity in `U` and `l`
- `effectiveBoost_mem_Icc`
- `effectiveBoost_zero_coverage`
- `effectiveBoost_lt_curveBoost_of_undercovered`
- `rawBoost_mem_Icc`
- `rawBoost_tokenless`
- `coverageBPS_le`
- `effectiveBPS_mem_Icc`
- `effectiveBPS_zero_coverage`
- `effectiveBPS_lt_rawBoost_of_partial`
- `workingCorr_accumulator_le_L`
- `rawBoost_anti_Ve`

## Repository implementation

- `ve4626BoostManager.calculateBoostForPosition` returns the tokenless-normalized raw multiplier.
- `LotteryManager4626._applyBoost` blends only the covered fraction of the uplift.
- `ve4626BoostManager._powerShare` uses effective `veLottery` for the numerator and live total ve4626 power for the denominator.
- Forge regression tests cover neutral, partial, full, tiny-coverage, cap, decay, live-denominator, and additive gauge behavior.
