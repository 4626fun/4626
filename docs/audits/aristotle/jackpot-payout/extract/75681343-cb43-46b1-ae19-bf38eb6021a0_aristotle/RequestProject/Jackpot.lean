import Mathlib

open scoped BigOperators

namespace Jackpot4626

/-- The jackpot reward, expressed in basis points (bps): 6900 bps = 69%. -/
def rewardBps : ℕ := 6900

/-- The payout for a reserve `R`: `R * rewardBps / 10000` (integer/floor division). -/
def payout (R : ℕ) : ℕ := R * rewardBps / 10000

/-- What is left of the reserve after the payout is taken. -/
def leftover (R : ℕ) : ℕ := R - payout R

/-!
### Note on the shared constant `6900`

The fee-split parameter `lotteryShareBps` (defined below) is *also* `6900`, but it
is a completely independent quantity: `rewardBps` scales the **reserve** `R`, whereas
`lotteryShareBps` scales a **fee** amount. They coincide numerically by accident, not by
definition, so no lemma here should be read as relating the two roles. See
`rewardBps_independent_of_lotteryShareBps` below, which merely records the numeric equality
while emphasizing the distinct base quantities.
-/

/-- The (unrelated) fee-split parameter, in basis points. -/
def lotteryShareBps : ℕ := 6900

/-- 1. The payout never exceeds the reserve. -/
theorem payout_le (R : ℕ) : payout R ≤ R := by
  unfold payout rewardBps
  calc R * 6900 / 10000 ≤ R * 10000 / 10000 := by
        apply Nat.div_le_div_right
        exact Nat.mul_le_mul_left R (by norm_num)
    _ = R := by rw [Nat.mul_div_cancel] ; norm_num

/-- 2. Payout plus leftover reconstructs the reserve. -/
theorem payout_add_leftover (R : ℕ) : payout R + leftover R = R := by
  unfold leftover
  rw [Nat.add_sub_cancel' (payout_le R)]

/-- 3. Payout is monotone in the reserve. -/
theorem payout_mono : Monotone payout := by
  intro a b hab
  unfold payout
  apply Nat.div_le_div_right
  exact Nat.mul_le_mul_right rewardBps hab

/-- 4a. Explicit example: full 10000-unit reserve pays out 6900. -/
theorem payout_10000 : payout 10000 = 6900 := by
  unfold payout rewardBps ; norm_num

/-- 4b. Explicit example: zero reserve pays out zero. -/
theorem payout_zero : payout 0 = 0 := by
  unfold payout ; simp

/-- The total payout over a list of reserves. -/
def totalPayout (Rs : List ℕ) : ℕ := (Rs.map payout).sum

/-- 5a. Total payout is the sum of the per-reserve payouts (by definition). -/
theorem totalPayout_eq_sum_map (Rs : List ℕ) :
    totalPayout Rs = (Rs.map payout).sum := rfl

/-- 5b. Total payout never exceeds the total reserves. -/
theorem totalPayout_le_sum (Rs : List ℕ) : totalPayout Rs ≤ Rs.sum := by
  unfold totalPayout
  induction Rs with
  | nil => simp
  | cons r rs ih =>
      simp only [List.map_cons, List.sum_cons]
      exact Nat.add_le_add (payout_le r) ih

/-- 6. `rewardBps` and `lotteryShareBps` are numerically equal (both `6900`), but this
equality is purely coincidental: `rewardBps` multiplies a reserve while `lotteryShareBps`
multiplies a fee. This lemma records the number, not any semantic relationship. -/
theorem rewardBps_independent_of_lotteryShareBps :
    rewardBps = lotteryShareBps := rfl

end Jackpot4626
