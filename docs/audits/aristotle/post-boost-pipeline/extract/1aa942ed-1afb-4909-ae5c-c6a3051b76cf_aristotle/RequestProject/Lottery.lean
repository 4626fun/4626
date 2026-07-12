import Mathlib

/-!
# Post-boost lottery PPM pipeline (ERC-4626 style)

This file formalizes the post-boost lottery "parts per million" (PPM) pipeline.

All arithmetic is over `ℕ`, using integer (truncating) division only.
-/

namespace Lottery

/-- The boosted PPM value: the base scaled by the covered basis points
(with truncating division by `10000`), plus the gauge PPM. -/
def boosted (base coveredBps gaugePPM : ℕ) : ℕ :=
  base * coveredBps / 10000 + gaugePPM

/-- The scaled PPM value: the boosted value scaled by the USD multiplier
basis points (with truncating division by `10000`). -/
def scaled (base coveredBps gaugePPM usdMultiplierBps : ℕ) : ℕ :=
  boosted base coveredBps gaugePPM * usdMultiplierBps / 10000

/-- The final win chance, capped at `maxWinChance`. -/
def final (base coveredBps gaugePPM usdMultiplierBps maxWinChance : ℕ) : ℕ :=
  min (scaled base coveredBps gaugePPM usdMultiplierBps) maxWinChance

/-- **Property 1.** The final win chance never exceeds the cap. -/
theorem final_le_maxWinChance
    (base coveredBps gaugePPM usdMultiplierBps maxWinChance : ℕ) :
    final base coveredBps gaugePPM usdMultiplierBps maxWinChance ≤ maxWinChance := by
  simp [final]

/-- **Property 4.** With a unit USD multiplier (`10000` bps), scaling is the identity. -/
theorem scaled_eq_boosted_of_unit_multiplier
    (base coveredBps gaugePPM : ℕ) :
    scaled base coveredBps gaugePPM 10000 = boosted base coveredBps gaugePPM := by
  simp [scaled]

/-- **Property 2.** With unit covered basis points, no gauge PPM and a unit USD
multiplier, the final value reduces to `min base maxWinChance`. -/
theorem final_eq_min_base
    (base coveredBps gaugePPM usdMultiplierBps maxWinChance : ℕ)
    (hcov : coveredBps = 10000) (hgauge : gaugePPM = 0)
    (hmul : usdMultiplierBps = 10000) :
    final base coveredBps gaugePPM usdMultiplierBps maxWinChance =
      min base maxWinChance := by
  subst hcov hgauge hmul
  simp [final, scaled, boosted]

/-- **Property 3.** Monotonicity of `boosted` in the covered basis points:
increasing `coveredBps` (keeping the other parameters fixed) does not decrease
`boosted`. -/
theorem boosted_mono_coveredBps
    (base gaugePPM coveredBps₁ coveredBps₂ : ℕ)
    (h : coveredBps₁ ≤ coveredBps₂) :
    boosted base coveredBps₁ gaugePPM ≤ boosted base coveredBps₂ gaugePPM := by
  unfold boosted
  gcongr

/-- **Property 5.** If `base ≤ maxWinChance`, unit covered basis points, no gauge
PPM and a unit USD multiplier, the final value is exactly `base`. -/
theorem final_eq_base
    (base coveredBps gaugePPM usdMultiplierBps maxWinChance : ℕ)
    (hbase : base ≤ maxWinChance)
    (hcov : coveredBps = 10000) (hgauge : gaugePPM = 0)
    (hmul : usdMultiplierBps = 10000) :
    final base coveredBps gaugePPM usdMultiplierBps maxWinChance = base := by
  subst hcov hgauge hmul
  simp [final, scaled, boosted, Nat.min_eq_left hbase]

end Lottery
