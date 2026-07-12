# Summary of changes for run 43082c39-4908-4ef5-9210-c0a2b6092842
Formalized the 4626 CreatorGaugeController fee-split conservation in Lean 4, in `RequestProject/CreatorGaugeController.lean` (namespace `CreatorGaugeController`). The file builds cleanly with no `sorry`/`admit`; all theorems depend only on standard axioms.

Default launch constants (creator treasury lane off, `creatorShareBps = 0` omitted) are encoded as defs: `lottery = 6900`, `burn = 961`, `protocol = 2139`, `maxBps = 10000`. All arithmetic uses natural-number (floor) division to match Solidity integer arithmetic.

Results proved:
1. `lanes_sum_maxBps`: `lottery + burn + protocol = maxBps`.
2. ShareOFT residual-to-burn path (`_splitShareOftAmount` / `previewDistribution`): with `L = F*lottery/maxBps`, `P = F*protocol/maxBps`, `B = F - L - P`, the theorem `shareOft_conservation` proves `L + B + P = F` for all `F`, and `shareOft_example` proves that for `F = 69000`, `(L, B, P) = (47610, 6631, 14759)`.
3. Vault-share residual-to-voters path (`_distributeVaultShares`): with `B = F*burn/maxBps`, `L = F*lottery/maxBps`, `P = F - B - L`, the theorem `vault_conservation` proves `L + B + P = F` for all `F`, and `vault_example` proves that for `F = 69000`, `(L, B, P) = (47610, 6630, 14760)`.
4. Bounded residual (optional): `shareOft_B_bounded` and `vault_P_bounded` prove the residual bucket is at least the naive independent floor of its lane and exceeds it by at most 3. `shareOft_no_dust` / `vault_no_dust` restate exact conservation, so no fee unit is ever left in an unpaid dust bucket.

The module docstring documents that burn is 9.61% and protocol/voters is 21.39%, and explicitly warns the two must not be swapped (the two paths route the rounding residual to different buckets).