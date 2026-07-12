# Summary of changes for run 75681343-cb43-46b1-ae19-bf38eb6021a0
Created `RequestProject/Jackpot.lean` (namespace `Jackpot4626`) formalizing the 4626 jackpot payout fraction. It builds cleanly with no `sorry`/`admit`.

Definitions:
- `rewardBps : ℕ := 6900`
- `payout (R : ℕ) := R * rewardBps / 10000`
- `leftover (R : ℕ) := R - payout R`
- `totalPayout (Rs : List ℕ) := (Rs.map payout).sum`
- `lotteryShareBps : ℕ := 6900` (the separate fee-split constant)

Proved theorems:
1. `payout_le : ∀ R, payout R ≤ R`
2. `payout_add_leftover : ∀ R, payout R + leftover R = R`
3. `payout_mono : Monotone payout`
4. `payout_10000 : payout 10000 = 6900` and `payout_zero : payout 0 = 0`
5. `totalPayout_eq_sum_map : totalPayout Rs = (Rs.map payout).sum` and `totalPayout_le_sum : totalPayout Rs ≤ Rs.sum`
6. `rewardBps_independent_of_lotteryShareBps : rewardBps = lotteryShareBps`, with a docstring/comment block emphasizing that although both equal 6900, `rewardBps` scales the reserve while `lotteryShareBps` scales a fee — the equality is numeric only, with no semantic dependence.