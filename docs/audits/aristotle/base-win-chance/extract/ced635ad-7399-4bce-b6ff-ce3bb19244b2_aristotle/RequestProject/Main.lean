import Mathlib

open scoped BigOperators
open scoped Real
open scoped Nat
open scoped Classical
open scoped Pointwise

set_option maxHeartbeats 8000000
set_option maxRecDepth 4000
set_option synthInstance.maxHeartbeats 20000
set_option synthInstance.maxSize 128

set_option relaxedAutoImplicit false
set_option autoImplicit false

set_option grind.warning false

namespace Lottery4626

/-!
# The 4626 lottery base win-chance model

The win chance is expressed in parts-per-million (PPM). A player's spend `usd`
(in whole US dollars) is converted to a PPM win chance and then capped by a
per-model ceiling `baseCeilingPPM`.

## Note on the definition

The originally supplied informal definition

    winChancePPM (usd baseCeilingPPM : ℕ) := min (usd / 250000) baseCeilingPPM

is inconsistent with the required numerical behaviour: with truncating natural
division, `1 / 250000 = 0`, so it would give `winChancePPM 1 40000 = 0`, not the
required `4`. The intended conversion is one US dollar = `1_000_000 / 250_000 = 4`
PPM, i.e. `usd * 1_000_000 / 250_000` (equal to `usd * 4`), capped by the ceiling.
We use that corrected definition below, which reproduces every required value
(`1 → 4`, `10 → 40`, …, `10000 → 40000`, `20000 → 40000` after the cap).
-/

/-- Base win chance in parts-per-million: convert `usd` dollars to PPM at a rate
of `1_000_000 / 250_000 = 4` PPM per dollar, then cap by `baseCeilingPPM`. -/
def winChancePPM (usd baseCeilingPPM : ℕ) : ℕ :=
  min (usd * 1000000 / 250000) baseCeilingPPM

/-- The core conversion `usd * 1_000_000 / 250_000` equals `usd * 4`. -/
theorem conv_eq (usd : ℕ) : usd * 1000000 / 250000 = usd * 4 := by
  rw [show (1000000 : ℕ) = 4 * 250000 from rfl, ← Nat.mul_assoc, Nat.mul_div_cancel]
  omega

/-! ## Required numerical values -/

theorem winChancePPM_1 : winChancePPM 1 40000 = 4 := by decide

theorem winChancePPM_10 : winChancePPM 10 40000 = 40 := by decide

theorem winChancePPM_100 : winChancePPM 100 40000 = 400 := by decide

theorem winChancePPM_1000 : winChancePPM 1000 40000 = 4000 := by decide

theorem winChancePPM_10000 : winChancePPM 10000 40000 = 40000 := by decide

theorem winChancePPM_20000 : winChancePPM 20000 40000 = 40000 := by decide

/-! ## Structural properties -/

/-- The win chance never exceeds the ceiling. -/
theorem winChancePPM_le_ceiling (usd c : ℕ) : winChancePPM usd c ≤ c :=
  min_le_right _ _

/-- The win chance is monotone in `usd` for a fixed ceiling. -/
theorem winChancePPM_monotone (c : ℕ) : Monotone (fun usd => winChancePPM usd c) := by
  intro a b hab
  exact min_le_min (Nat.div_le_div_right (Nat.mul_le_mul_right _ hab)) le_rfl

/-! ## PPM as a rational fraction

`4` PPM means `4 / 1_000_000`, which equals `0.0004%` (i.e. `0.0004 / 100`). -/

theorem ppm_four_eq_fraction : (4 : ℚ) / 1000000 = (0.0004 : ℚ) / 100 := by
  norm_num

end Lottery4626
