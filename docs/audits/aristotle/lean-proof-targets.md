---
title: Lean proof targets (top 5)
sidebar_label: Lean proof targets
sidebar_position: 21
last_updated: '2026-07-11'
audience:
  - developers
  - protocols
  - operators
stage: use
owner: docs-team
last_reviewed: '2026-07-11'
status: current
---

# Lean proof targets (top 5)

Ready-to-submit [Aristotle](https://aristotle.harmonic.fun/) prompts for the next machine-checked lemmas after the Curve **2.5×** boost work. Each target includes the onchain formula, what “done” means, and a copy-paste prompt.

**Canonical BPS (onchain):** `lotteryShareBps = 6900`, `burnShareBps = 961`, `protocolShareBps = 2139`, `creatorShareBps = 0` (sum `10000`). See `CreatorGaugeController`.

**Already proven (do not re-submit unless the formula changes):** Curve working-balance boost `working / (0.4 · l) ∈ [1.0, 2.5]` and coverage blend `effectiveBPS = 10000 + ⌊(rawBoost − 10000) · coverageBPS / 10000⌋`.

---

## 1. Base win probability

**Status:** Queued  
**Code:** `LotteryManager4626.calculateWinChance` — `winChancePPM = swapValueUSD / 250_000`, capped at `baseCeilingPPM` (default `40_000` PPM = 4%).

### Model

```text
winChancePPM(usd) = min(⌊usd / 250_000⌋, baseCeilingPPM)
```

Product table (with default ceiling):

| Trade USD | Win chance PPM | Percent |
|-----------|----------------|---------|
| 1 | 4 | 0.0004% |
| 10 | 40 | 0.004% |
| 100 | 400 | 0.04% |
| 1_000 | 4_000 | 0.4% |
| 10_000 | 40_000 | 4% (ceiling) |
| 20_000 | 40_000 | 4% (still ceiling) |

### Done when Lean proves

- Exact values for the table rows above (with `baseCeilingPPM = 40_000`).
- Monotonicity in `usd`.
- `winChancePPM ≤ baseCeilingPPM` for all `usd ≥ 0`.
- Equivalence: `$1 → 4 PPM` matches the public “$1 = 0.0004%” claim.

### Aristotle prompt

```text
Formalize and prove in Lean 4 (Mathlib) the 4626 lottery base win-chance model.

Definitions (ℕ, integer division):
  winChancePPM (usd baseCeilingPPM : ℕ) := min (usd / 250000) baseCeilingPPM

Prove:
1. winChancePPM 1 40000 = 4
2. winChancePPM 10 40000 = 40
3. winChancePPM 100 40000 = 400
4. winChancePPM 1000 40000 = 4000
5. winChancePPM 10000 40000 = 40000
6. winChancePPM 20000 40000 = 40000
7. ∀ usd c, winChancePPM usd c ≤ c
8. Monotone in usd for fixed c
9. Lemma stating that 4 PPM = 4 / 1_000_000 = 0.0004% as a rational equality

No sorry/admit. Prefer Nat lemmas; avoid floats.
```

---

## 2. Post-boost win-chance pipeline

**Status:** Queued  
**Code:** `_applyBoost` / personal boost + optional gauge PPM + `usdMultiplierBps`, then clamp to `maxWinChance` (default `150_000` PPM = 15%).

### Model (abstract)

```text
base      = winChancePPM(swapUSD, baseCeilingPPM)
rawBoost  ∈ [10000, 25000]          -- BPS; 1.0×–2.5× (Curve target, already proven)
covered   = coverage blend of rawBoost  -- already proven shape
boosted   = ⌊base · covered / 10000⌋ + gaugeBoostPPM   -- gauge add optional
scaled    = ⌊boosted · usdMultiplierBps / 10000⌋      -- 10000 = identity
final     = min(scaled, maxWinChancePPM)
```

### Done when Lean proves

- If `covered = 10000` and `gauge = 0` and `usdMultiplierBps = 10000`, then `final = min(base, maxWinChance)`.
- `final ≤ maxWinChance` always.
- Increasing `covered` or `usdMultiplierBps` (with fixed others) does not decrease `final` before the cap.
- Neutral boost (`covered = 10000`, `gauge = 0`) leaves base unchanged before multiplier/cap.

### Aristotle prompt

```text
Formalize the 4626 post-boost lottery PPM pipeline in Lean 4.

Parameters (ℕ):
  base, coveredBps, gaugePPM, usdMultiplierBps, maxWinChance : ℕ
  with 10000 ≤ coveredBps ≤ 25000
  and usdMultiplierBps ≥ 10000
  and maxWinChance > 0

Define:
  boosted := base * coveredBps / 10000 + gaugePPM
  scaled  := boosted * usdMultiplierBps / 10000
  final   := min scaled maxWinChance

Prove:
1. final ≤ maxWinChance
2. coveredBps = 10000 → gaugePPM = 0 → usdMultiplierBps = 10000 → final = min base maxWinChance
3. Monotonicity: increasing coveredBps (others fixed) does not decrease boosted (hence not final before cap)
4. usdMultiplierBps = 10000 → scaled = boosted
5. base ≤ maxWinChance → coveredBps = 10000 → gaugePPM = 0 → usdMultiplierBps = 10000 → final = base

No sorry/admit. Integer division only.
```

---

## 3. VRF decision fairness

**Status:** Queued  
**Code:** `(randomWords[0] % 1_000_000) < winChancePPM` in the VRF callback path.

### Model

Treat VRF output as uniform on `{0,…,N−1}` with `N = 1_000_000`. Win iff `r % N < p` for `p = winChancePPM ≤ N`.

### Done when Lean proves

- For uniform `r`, `P(r % N < p) = p / N` when `0 ≤ p ≤ N`.
- Special case: `p = 0` never wins; `p = N` always wins.
- Tie to target 1: `$10_000` at ceiling ⇒ `p = 40_000` ⇒ probability `4%`.

### Aristotle prompt

```text
Prove in Lean 4 (Mathlib probability / Finset counting) the fairness of the 4626 VRF win check.

Let N : ℕ := 1000000.
For p ≤ N, and r drawn uniformly from Fin N (or range 0..N-1),
define win (r p) := (r.val % N) < p   -- or equivalent Fin encoding.

Prove:
1. card { r // win r p } = p when modeling r ∈ range N
2. Probability = p / N as a Rat (or ENNReal) equality
3. p = 0 → probability 0; p = N → probability 1
4. Corollary: p = 40000 → probability = 4 / 100 = 0.04

No sorry/admit. Prefer finite counting over measure theory if shorter.
```

---

## 4. Gauge fee-split conservation

**Status:** Queued  
**Code:** `CreatorGaugeController` constants — jackpot / burn / voters / creator.

### Model

```text
lotteryShareBps  = 6900   -- 69% → jackpotCustodian (ShareOFT ■)
burnShareBps     = 961    -- 9.61% → unwrap + burn vault shares (▢) for PPS
protocolShareBps = 2139   -- 21.39% → voter/protocol branch (ShareOFT ■)
creatorShareBps  = 0      -- creator ongoing treasury lane (off by default)

MAX_BPS = 10000
sum = 6900 + 961 + 2139 + 0 = 10000
```

Floor split of fee amount `F`:

```text
toLottery  = ⌊F · 6900 / 10000⌋
toBurn     = ⌊F · 961 / 10000⌋
toProtocol = ⌊F · 2139 / 10000⌋
remainder  = F - toLottery - toBurn - toProtocol   -- dust from flooring
```

### Done when Lean proves

- BPS sum identity.
- `toLottery + toBurn + toProtocol ≤ F` and `remainder < 4` (or exact identity you choose for the remainder policy).
- Example: `F = 69_000` yields the published approximate dollar table up to flooring.

### Aristotle prompt

```text
Formalize 4626 CreatorGaugeController fee-split conservation in Lean 4.

Constants:
  lottery = 6900, burn = 961, protocol = 2139, creator = 0, maxBps = 10000

Prove:
1. lottery + burn + protocol + creator = maxBps
2. For any F : ℕ, define
     L := F * lottery / maxBps
     B := F * burn / maxBps
     P := F * protocol / maxBps
     R := F - L - B - P
   Then L + B + P ≤ F and R < 4
3. Compute F = 69000: state L, B, P explicitly and prove the equalities
4. Optional: show L / F approaches 69/100 as a rational bound for large F

No sorry/admit. Document that burn is 9.61% and protocol/voters 21.39% (do not swap).
```

---

## 5. Jackpot payout fraction

**Status:** Queued  
**Code:** `LotteryManager4626` default `rewardPercentage: 6900` — winner receives **69% of each vault’s jackpot reserve**, not 69% of trade fees again.

### Model

For each vault reserve `R`:

```text
payout(R) = ⌊R · 6900 / 10000⌋
left(R)   = R - payout(R)
```

Multi-vault win over reserves `R₁…Rₙ`:

```text
totalPayout = Σ payout(Rᵢ)
```

### Done when Lean proves

- `payout(R) ≤ R` and `left(R) = R - payout(R)`.
- `payout(R) = 0` when `R < 10000 / 6900` edge cases handled via floor.
- Distinguish clearly from fee-split lemma #4: payout BPS applies to **reserve**, fee BPS applies to **incoming fees**.
- Optional: `singleVaultJackpotOnly` mode is a product flag — model both “one vault” and “sum over vaults” if stating multi-vault claims.

### Aristotle prompt

```text
Formalize 4626 jackpot payout fraction in Lean 4.

Let rewardBps : ℕ := 6900
Define payout (R : ℕ) := R * rewardBps / 10000
Define left (R : ℕ) := R - payout R

Prove:
1. ∀ R, payout R ≤ R
2. ∀ R, payout R + left R = R
3. payout is monotone in R
4. Explicit examples: payout 10000 = 6900; payout 0 = 0
5. For a list of reserves, totalPayout = sum (map payout), and totalPayout ≤ sum reserves
6. Short comment/lemma name making clear this is independent of the fee-split
   lotteryShareBps (also 6900): same number, different base quantity (reserve vs fee)

No sorry/admit.
```

---

## How to submit

```bash
export ARISTOTLE_API_KEY='arstl_...'
# CLI
aristotle submit "$(cat prompt.txt)" --wait

# or Python
# project = await Project.create(prompt="...")
```

After a task completes, download the Lean tarball (`aristotle download <project-id>`), store artifacts under `docs/audits/aristotle/<topic>/`, and flip that target’s **Status** to **Proven** on this page with the project ID.

## Related

- [Formal verification hub](/audits/aristotle)
- [Curve boost Aristotle summary](https://github.com/wenakita/4626/blob/main/docs/audits/aristotle/ve4626-curve-boost/ARISTOTLE_SUMMARY.md) (repo; not all internal audit notes are published on docs.4626.fun)
- [LotteryManager](/contracts/utilities/lottery-manager)
- [GaugeController](/contracts/governance/gauge-controller)
