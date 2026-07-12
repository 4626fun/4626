# VRF decision fairness (TARGET 3)

Date: 2026-07-11

Aristotle project: `e1fdf9eb-ab16-46fe-9d75-e02705a934d5`
Task: `d62074a2-03f0-4969-a5de-b1733055425c`

| Task | Role | Status |
|------|------|--------|
| `d62074a2-03f0-4969-a5de-b1733055425c` | VRF win-check fairness | COMPLETE |

## Plain claim

If randomness is uniform over one million outcomes, the chance of winning equals `winChancePPM / 1_000_000`. A 4% listed chance is a real 4% under that model.

## Formula

```text
win  ⇔  (r mod 1_000_000) < winChancePPM
P(win) = winChancePPM / 1_000_000    when 0 ≤ winChancePPM ≤ 1_000_000
```

## What Lean proved

Build succeeds with no `sorry`/`admit`. Namespace `VRF4626` (Finset counting):

- `card_winners` — `|winners p| = p` for `p ≤ N`
- `prob_eq` — `prob p = (p : ℚ) / N`
- `prob_zero` / `prob_full`
- `prob_40000` — `prob 40000 = 4 / 100`

Artifact: `result.tar.gz`.

## Local validation

Local `lake build` **skipped** on this host (Mathlib cache decompress + compile OOMs / freezes the machine). Validation gate used: Aristotle task COMPLETE + source scan with no `sorry`/`admit`.
