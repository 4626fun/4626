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

set_option pp.fullNames true
set_option pp.structureInstances true
set_option pp.coercions.types true
set_option pp.funBinderTypes true
set_option pp.letVarTypes true
set_option pp.piBinderTypes true

set_option grind.warning false

namespace VRF4626

/-- Total number of buckets in the 4626 VRF win check. -/
def N : ℕ := 1000000

/-- The win predicate: with random value `r` and threshold `p`,
the check wins iff `r % N < p`. -/
def win (r p : ℕ) : Prop := r % N < p

instance (r p : ℕ) : Decidable (win r p) := by
  unfold win; infer_instance

/-- The set of winning random draws in `range N` for threshold `p`. -/
def winners (p : ℕ) : Finset ℕ := (Finset.range N).filter (fun r => win r p)

/-- The win probability as a rational number. -/
def prob (p : ℕ) : ℚ := (winners p).card / N

/-- Counting: for `p ≤ N`, exactly `p` of the `N` draws win. -/
theorem card_winners (p : ℕ) (hp : p ≤ N) : (winners p).card = p := by
  unfold winners win
  have : (Finset.range N).filter (fun r => r % N < p) = Finset.range p := by
    ext r
    simp only [Finset.mem_filter, Finset.mem_range]
    constructor
    · rintro ⟨hr, h⟩; rwa [Nat.mod_eq_of_lt hr] at h
    · intro hr
      have hrN : r < N := lt_of_lt_of_le hr hp
      exact ⟨hrN, by rwa [Nat.mod_eq_of_lt hrN]⟩
  rw [this, Finset.card_range]

/-- The probability equals `p / N`. -/
theorem prob_eq (p : ℕ) (hp : p ≤ N) : prob p = (p : ℚ) / N := by
  unfold prob; rw [card_winners p hp]

/-- Threshold `0` gives probability `0`. -/
theorem prob_zero : prob 0 = 0 := by
  rw [prob_eq 0 (by norm_num [N])]; simp

/-- Threshold `N` gives probability `1`. -/
theorem prob_full : prob N = 1 := by
  rw [prob_eq N le_rfl]
  have : (N : ℚ) ≠ 0 := by norm_num [N]
  field_simp

/-- Corollary: threshold `40000` gives probability `4/100 = 0.04`. -/
theorem prob_40000 : prob 40000 = 4 / 100 := by
  rw [prob_eq 40000 (by norm_num [N])]; norm_num [N]

end VRF4626
