import Mathlib

/-!
# CreatorGaugeController fee-split conservation (4626)

This file formalizes the fee-split conservation properties of the 4626
`CreatorGaugeController` at the **default launch constants**, with the creator
treasury lane switched off (`creatorShareBps = 0`, so it is omitted from the
model).

## Default launch constants

* `lottery  = 6900`  (69.00 %)
* `burn     =  961`  ( 9.61 %)
* `protocol = 2139`  (21.39 %)   -- this is the protocol / voters lane
* `maxBps   = 10000`

All arithmetic is performed with natural-number (floor) division, exactly as
Solidity integer arithmetic does.

**Important — do not swap the constants.** `burn` is `961` (**9.61 %**) and
`protocol`/voters is `2139` (**21.39 %**). These two lanes are *not*
interchangeable: the two distribution paths below route the rounding residual to
different buckets (residual-to-burn versus residual-to-voters), producing
genuinely different splits for the same fee `F`.
-/

namespace CreatorGaugeController

/-- Basis-point denominator. -/
def maxBps : ℕ := 10000

/-- Lottery lane, 69.00 %. -/
def lottery : ℕ := 6900

/-- Burn lane, **9.61 %** (do not confuse with the protocol lane). -/
def burn : ℕ := 961

/-- Protocol / voters lane, **21.39 %** (do not confuse with the burn lane). -/
def protocol : ℕ := 2139

/-! ## Part 1 — the three active lanes exhaust the basis points -/

/-- The three active lanes sum exactly to `maxBps`
(`lottery + burn + protocol = maxBps`). -/
theorem lanes_sum_maxBps : lottery + burn + protocol = maxBps := by
  decide

/-! ## Part 2 — ShareOFT residual-to-burn path

Matches `_splitShareOftAmount` / `previewDistribution`: the lottery and protocol
lanes are floored independently, and the burn bucket absorbs the residual. -/

/-- Lottery amount on the ShareOFT path: `F * lottery / maxBps`. -/
def shareOft_L (F : ℕ) : ℕ := F * lottery / maxBps

/-- Protocol amount on the ShareOFT path: `F * protocol / maxBps`. -/
def shareOft_P (F : ℕ) : ℕ := F * protocol / maxBps

/-- Burn amount on the ShareOFT path is the residual: `F - L - P`. -/
def shareOft_B (F : ℕ) : ℕ := F - shareOft_L F - shareOft_P F

/-- Conservation on the ShareOFT residual-to-burn path: `L + B + P = F`. -/
theorem shareOft_conservation (F : ℕ) :
    shareOft_L F + shareOft_B F + shareOft_P F = F := by
  have hL : shareOft_L F ≤ F * lottery / maxBps := le_of_eq rfl
  have hLP : shareOft_L F + shareOft_P F ≤ F := by
    have h1 : F * lottery / maxBps + F * protocol / maxBps
        ≤ (F * lottery + F * protocol) / maxBps := Nat.add_div_le_add_div _ _ _
    have h2 : (F * lottery + F * protocol) / maxBps ≤ F := by
      have : F * lottery + F * protocol = F * (lottery + protocol) := by ring
      rw [this]
      calc F * (lottery + protocol) / maxBps
          ≤ F * maxBps / maxBps := by
            apply Nat.div_le_div_right
            apply Nat.mul_le_mul_left
            decide
        _ = F := by
            rw [Nat.mul_div_cancel]; decide
    exact le_trans h1 h2
  simp only [shareOft_B]
  omega

/-- ShareOFT path at `F = 69000`: `(L, B, P) = (47610, 6631, 14759)`. -/
theorem shareOft_example :
    shareOft_L 69000 = 47610 ∧ shareOft_B 69000 = 6631 ∧ shareOft_P 69000 = 14759 := by
  refine ⟨?_, ?_, ?_⟩ <;> decide

/-! ## Part 3 — Vault-share residual-to-voters path

Matches `_distributeVaultShares`: the burn and lottery lanes are floored
independently, and the protocol / voters bucket absorbs the residual. -/

/-- Burn amount on the vault-share path: `F * burn / maxBps`. -/
def vault_B (F : ℕ) : ℕ := F * burn / maxBps

/-- Lottery amount on the vault-share path: `F * lottery / maxBps`. -/
def vault_L (F : ℕ) : ℕ := F * lottery / maxBps

/-- Protocol / voters amount on the vault-share path is the residual: `F - B - L`. -/
def vault_P (F : ℕ) : ℕ := F - vault_B F - vault_L F

/-- Conservation on the vault-share residual-to-voters path: `L + B + P = F`. -/
theorem vault_conservation (F : ℕ) :
    vault_L F + vault_B F + vault_P F = F := by
  have hBL : vault_B F + vault_L F ≤ F := by
    have h1 : F * burn / maxBps + F * lottery / maxBps
        ≤ (F * burn + F * lottery) / maxBps := Nat.add_div_le_add_div _ _ _
    have h2 : (F * burn + F * lottery) / maxBps ≤ F := by
      have : F * burn + F * lottery = F * (burn + lottery) := by ring
      rw [this]
      calc F * (burn + lottery) / maxBps
          ≤ F * maxBps / maxBps := by
            apply Nat.div_le_div_right
            apply Nat.mul_le_mul_left
            decide
        _ = F := by
            rw [Nat.mul_div_cancel]; decide
    exact le_trans h1 h2
  simp only [vault_P]
  omega

/-- Vault-share path at `F = 69000`: `(L, B, P) = (47610, 6630, 14760)`. -/
theorem vault_example :
    vault_L 69000 = 47610 ∧ vault_B 69000 = 6630 ∧ vault_P 69000 = 14760 := by
  refine ⟨?_, ?_, ?_⟩ <;> decide

/-! ## Part 4 — bounded residual, no unpaid dust

The residual bucket in each path differs from the naive independent floor of that
lane by at most `3` (in fact at most `2`), and is always at least the naive
floor.  Because conservation (`L + B + P = F`) holds exactly, every fee unit is
assigned to some bucket: there is never an unpaid dust bucket. -/

/-- Naive independent floor of the burn lane. -/
def naive_burn (F : ℕ) : ℕ := F * burn / maxBps

/-- Naive independent floor of the protocol / voters lane. -/
def naive_protocol (F : ℕ) : ℕ := F * protocol / maxBps

/-- The ShareOFT burn residual is at least, and at most `3` above, the naive
independent burn floor. -/
theorem shareOft_B_bounded (F : ℕ) :
    naive_burn F ≤ shareOft_B F ∧ shareOft_B F ≤ naive_burn F + 3 := by
  simp only [naive_burn, shareOft_B, shareOft_L, shareOft_P,
    maxBps, lottery, burn, protocol]
  omega

/-- The vault-share protocol/voters residual is at least, and at most `3` above,
the naive independent protocol floor. -/
theorem vault_P_bounded (F : ℕ) :
    naive_protocol F ≤ vault_P F ∧ vault_P F ≤ naive_protocol F + 3 := by
  simp only [naive_protocol, vault_P, vault_B, vault_L,
    maxBps, lottery, burn, protocol]
  omega

/-- No unpaid dust: on the ShareOFT path every fee unit is assigned to a bucket
(restatement of conservation). -/
theorem shareOft_no_dust (F : ℕ) :
    shareOft_L F + shareOft_B F + shareOft_P F = F := shareOft_conservation F

/-- No unpaid dust: on the vault-share path every fee unit is assigned to a
bucket (restatement of conservation). -/
theorem vault_no_dust (F : ℕ) :
    vault_L F + vault_B F + vault_P F = F := vault_conservation F

end CreatorGaugeController
