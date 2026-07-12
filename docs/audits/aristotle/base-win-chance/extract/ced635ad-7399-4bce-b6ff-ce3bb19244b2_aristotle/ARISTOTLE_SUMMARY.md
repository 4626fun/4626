# Summary of changes for run ced635ad-7399-4bce-b6ff-ce3bb19244b2
Formalized and proved the 4626 lottery base win-chance PPM model in `RequestProject/Main.lean` (namespace `Lottery4626`). All theorems build with no `sorry`/`admit` and use only standard axioms.

**Definition correction.** The supplied informal definition `min (usd / 250000) baseCeilingPPM` is inconsistent with the required values: with truncating natural-number division `1 / 250000 = 0`, so it would give `winChancePPM 1 40000 = 0`, not the required `4`. The intended model converts one US dollar to `1_000_000 / 250_000 = 4` PPM, so the correct definition is `winChancePPM usd baseCeilingPPM := min (usd * 1000000 / 250000) baseCeilingPPM` (the conversion term equals `usd * 4`). This reproduces every required value and is documented in the file's docstring.

**Proved results:**
- `conv_eq`: `usd * 1000000 / 250000 = usd * 4` (the core conversion).
- `winChancePPM_1 … winChancePPM_20000`: the six required numerical values (1→4, 10→40, 100→400, 1000→4000, 10000→40000, and 20000→40000 after the cap).
- `winChancePPM_le_ceiling`: `winChancePPM usd c ≤ c` for all `usd c`.
- `winChancePPM_monotone`: monotone in `usd` for a fixed ceiling.
- `ppm_four_eq_fraction`: `(4 : ℚ)/1000000 = (0.0004)/100`, i.e. 4 PPM = 0.0004%.

All work is committed and pushed. Everything is over ℕ (integer division) and ℚ, with no floats.