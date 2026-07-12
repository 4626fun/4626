# Jackpot payout fraction (TARGET 5)

Date: 2026-07-11

Aristotle project: `0837752f-e2f3-4eb3-b5e1-f63c14b64615`
Task: `75681343-cb43-46b1-ae19-bf38eb6021a0`

| Task | Role | Status |
|------|------|--------|
| `75681343-cb43-46b1-ae19-bf38eb6021a0` | Jackpot payout fraction | COMPLETE |

## Plain claim

A winner receives 69% of each vault’s jackpot reserve. That is not “69% of fees again” — fee routing already filled the reserve; payout takes 69% of what is sitting there.

## Worked example

| Reserve R | Payout (69%) | Left |
|-----------|--------------|------|
| 10,000 | 6,900 | 3,100 |
| 0 | 0 | 0 |

## Formula

```text
payout(R) = ⌊R · 6900 / 10000⌋
left(R)   = R − payout(R)
```

Same 6900 number as fee `lotteryShareBps`, different base (reserve vs fee).

## What Lean proved

Build succeeds with no `sorry`/`admit`. Namespace `Jackpot4626` in `RequestProject/Jackpot.lean`:

- `payout_le` — `payout R ≤ R`
- `payout_add_leftover` — conservation
- `payout_mono`
- `payout_10000` / `payout_zero`
- `totalPayout_eq_sum_map` / `totalPayout_le_sum`
- `rewardBps_independent_of_lotteryShareBps` — numeric equality only; reserve base ≠ fee base

Artifact: `result.tar.gz`.
