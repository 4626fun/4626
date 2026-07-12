# Base win probability (TARGET 1)

Date: 2026-07-11

Aristotle project: `fedb2c3c-b7a9-41bc-bd53-5a105964042f`
Task: `ced635ad-7399-4bce-b6ff-ce3bb19244b2`

| Task | Role | Status |
|------|------|--------|
| `ced635ad-7399-4bce-b6ff-ce3bb19244b2` | Base winChancePPM model | COMPLETE |

## Plain claim

Every $1 of eligible swap USD adds 4 PPM (0.0004%) of win chance, until the pre-boost ceiling (default 4% at $10k).

## Worked example

| Trade | PPM | Chance |
|-------|-----|--------|
| $1 | 4 | 0.0004% |
| $10 | 40 | 0.004% |
| $100 | 400 | 0.04% |
| $1,000 | 4,000 | 0.4% |
| $10,000 | 40,000 | 4% (ceiling) |
| $20,000 | 40,000 | still 4% |

## Formula

Lean encodes dollar inputs with the onchain USDC 1e6 scale:

```text
winChancePPM(usdDollars, c) = min(⌊usdDollars · 1_000_000 / 250_000⌋, c)
                            = min(usdDollars · 4, c)
```

Equivalent to Solidity `swapAmountUSD / 250_000` when `swapAmountUSD` is in 1e6 units.

## What Lean proved

Build succeeds with no `sorry`/`admit`. Namespace `Lottery4626` in `RequestProject/Main.lean`:

- `conv_eq` — `usd * 1_000_000 / 250_000 = usd * 4`
- `winChancePPM_1` … `winChancePPM_20000` — table examples
- `winChancePPM_le_ceiling` — always `≤` ceiling
- `winChancePPM_monotone` — monotone in USD for fixed ceiling
- `ppm_four_eq_fraction` — `(4 : ℚ)/1_000_000 = 0.0004/100` (0.0004%)

Artifact: `result.tar.gz` (extracted under `extract/`).
