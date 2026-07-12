# Post-boost win-chance pipeline (TARGET 2)

Date: 2026-07-11

Aristotle project: `5d0e6454-fa61-4503-b438-250c771ec84d`
Task: `1aa942ed-1afb-4909-ae5c-c6a3051b76cf`

| Task | Role | Status |
|------|------|--------|
| `1aa942ed-1afb-4909-ae5c-c6a3051b76cf` | Post-boost PPM pipeline | COMPLETE |

## Plain claim

Personal boost (up to 2.5×), optional gauge add, and USD multiplier can raise odds — but the final chance is always capped. Neutral boost leaves the base chance unchanged.

## Formula

```text
boosted = ⌊base · coveredBps / 10_000⌋ + gaugePPM
scaled  = ⌊boosted · usdMultiplierBps / 10_000⌋
final   = min(scaled, maxWinChancePPM)
```

`coveredBps` comes from the proven Curve blend ∈ [10000, 25000].

## What Lean proved

Build succeeds with no `sorry`/`admit`. Namespace `Lottery` in `RequestProject/Lottery.lean`:

- `final_le_maxWinChance`
- `final_eq_min_base` (neutral boost/gauge/multiplier)
- `boosted_mono_coveredBps`
- `scaled_eq_boosted_of_unit_multiplier`
- `final_eq_base` (when base ≤ max and parameters neutral)

Artifact: `result.tar.gz`.

## Local validation

Local `lake build` **skipped** on this host (Mathlib cache decompress + compile OOMs / freezes the machine). Validation gate used: Aristotle task COMPLETE + source scan with no `sorry`/`admit`.
