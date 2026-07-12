---
title: Lean proof targets (next 5)
sidebar_label: Next targets
sidebar_position: 12
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

<div class="audit-hub">

<nav class="audit-path" aria-label="Aristotle">
  <a class="audit-path__step" href="/audits">Audits hub</a>
  <a class="audit-path__step" href="/audits/aristotle">Aristotle</a>
  <a class="audit-path__step" href="/audits/aristotle">Introduction</a>
  <a class="audit-path__step" href="/audits/aristotle/curve-boost">2.5× boost (proven)</a>
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/lean-proof-targets">Next targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Verification complete</span>
  <h1 class="audit-hero__title">Next five Lean targets</h1>
  <p class="audit-hero__subtitle">Each target has a plain claim, a worked example, the onchain formula, and a copy-paste Aristotle prompt. All five are <strong>Proven</strong> (no <code>sorry</code>/<code>admit</code>). New here? Read the <a href="/audits/aristotle">Introduction</a>, then the proven <a href="/audits/aristotle/curve-boost">2.5× boost</a>.</p>
  <div class="home-hero__actions">
    <a class="home-btn home-btn--primary" href="/audits/aristotle/curve-boost">Proven 2.5× boost<span class="home-btn__arrow" aria-hidden="true">→</span></a>
  </div>
</section>

<div class="docs-at-a-glance">

**Canonical fee BPS (onchain):** lottery **69%** (6900) · burn **9.61%** (961) · voters **21.39%** (2139). Sum = 10000. Creator treasury lane is off (`creatorShareBps = 0`) — omit from examples. Do not swap burn and voters.

</div>

## At a glance

| # | Claim in one sentence | Status | Read |
|---|----------------------|--------|------|
| 1 | Win chance scales linearly with USD trade size ($1 → 0.0004%), then hits a ceiling | **Proven** | [Base win chance](/audits/aristotle/base-win-chance) · `fedb2c3c…042f` |
| 2 | After boosts/multipliers, win chance never exceeds the hard cap (default 15%) | **Proven** | [Post-boost pipeline](/audits/aristotle/post-boost-pipeline) · `5d0e6454…c84d` |
| 3 | A uniform VRF roll wins with exactly the stated probability | **Proven** | [VRF fairness](/audits/aristotle/vrf-fairness) · `e1fdf9eb…34d5` |
| 4 | Fee BPS sum to 100%; floor residuals stay on an onchain lane (burn or voters), not a fifth bucket | **Proven** | [Fee-split](/audits/aristotle/gauge-fee-split) · `28ab1f5d…58ab` |
| 5 | Jackpot pays 69% of each vault **reserve** (same number as fee lottery BPS, different base) | **Proven** | [Jackpot payout](/audits/aristotle/jackpot-payout) · `0837752f…4615` |

---

## 1. Base win probability

**Status:** Proven · Project `fedb2c3c-b7a9-41bc-bd53-5a105964042f` · **Code:** `LotteryManager4626.calculateWinChance`

### Plain claim

Every $1 of eligible swap USD adds **4 PPM** (0.0004%) of win chance, until the pre-boost ceiling (default **4%** at $10k).

### Worked example

| Trade | PPM | Chance |
|-------|-----|--------|
| $1 | 4 | 0.0004% |
| $100 | 400 | 0.04% |
| $1,000 | 4,000 | 0.4% |
| $10,000 | 40,000 | **4%** (hits ceiling) |
| $20,000 | 40,000 | still **4%** |

### Formula

Onchain (USDC 1e6 units):

```text
winChancePPM = min(⌊swapAmountUSD / 250_000⌋, baseCeilingPPM)
```

Default `baseCeilingPPM = 40_000`. So `$1 → 1_000_000 / 250_000 = 4` PPM.

Lean encoding note: dollar table labels use the equivalent `min(⌊usdDollars · 1_000_000 / 250_000⌋, c)`. Literal `usd / 250000` with dollar numerals would truncate to 0 under ℕ division.

### Done when Lean proves

Table rows above; always `≤` ceiling; monotone in USD; `$1 → 4 PPM` equals `0.0004%` as a rational. **Done** — see [Base win chance (proven)](/audits/aristotle/base-win-chance).

<details>
<summary>Aristotle prompt (copy-paste)</summary>

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

</details>

---

## 2. Post-boost win-chance pipeline

**Status:** Proven · Project `5d0e6454-fa61-4503-b438-250c771ec84d` · **Code:** `_applyBoost` then multipliers / cap

### Plain claim

Personal boost (up to 2.5×), optional gauge add, and USD multiplier can raise odds — but the final chance is always capped (default **15%**). Neutral boost leaves the base chance unchanged.

### Worked example

| base | covered boost | gauge | multiplier | max | final |
|------|---------------|-------|------------|-----|-------|
| 40,000 PPM (4%) | 1.0× (10,000 BPS) | 0 | 1.0× | 15% | **4%** |
| 40,000 | 2.5× | 0 | 1.0× | 15% | **10%** |
| 40,000 | 2.5× | 0 | 1.0× | 5% | **5%** (cap binds) |

### Formula

```text
boosted = ⌊base · coveredBps / 10_000⌋ + gaugePPM
scaled  = ⌊boosted · usdMultiplierBps / 10_000⌋
final   = min(scaled, maxWinChancePPM)
```

`coveredBps` comes from the [proven Curve blend](/audits/aristotle/curve-boost).

### Done when Lean proves

Always `final ≤ max`; identity path when boost/gauge/multiplier are neutral; monotone in boost before the cap. **Done** — see [Post-boost pipeline (proven)](/audits/aristotle/post-boost-pipeline).

<details>
<summary>Aristotle prompt (copy-paste)</summary>

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

</details>

---

## 3. VRF decision fairness

**Status:** Proven · Project `e1fdf9eb-ab16-46fe-9d75-e02705a934d5` · **Code:** `(randomWords[0] % 1_000_000) < winChancePPM`

### Plain claim

If randomness is uniform over one million outcomes, the chance of winning equals `winChancePPM / 1_000_000`. A 4% listed chance is a real 4% under that model.

### Worked example

| winChancePPM | Probability |
|--------------|-------------|
| 0 | 0% (never) |
| 40,000 | **4%** |
| 150,000 | **15%** |
| 1,000,000 | 100% (always) |

### Formula

```text
win  ⇔  (r mod 1_000_000) < winChancePPM
P(win) = winChancePPM / 1_000_000    when 0 ≤ winChancePPM ≤ 1_000_000
```

### Done when Lean proves

Counting / probability equality; edge cases 0 and full; corollary that 40,000 PPM = 4%. **Done** — see [VRF fairness (proven)](/audits/aristotle/vrf-fairness).

<details>
<summary>Aristotle prompt (copy-paste)</summary>

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

</details>

---

## 4. Gauge fee-split conservation

**Status:** Proven · Project `28ab1f5d-2e57-4131-86d2-128ba0f458ab` · **Code:** `CreatorGaugeController` — `_splitShareOftAmount` / `previewDistribution` (ShareOFT path) and `_distributeVaultShares` (vault-share path)

### Plain claim

Every trade fee is split **69% jackpot / 9.61% burn / 21.39% voters**. Those three BPS add to 100%. (The creator treasury lane exists in code but is **off** at `creatorShareBps = 0`, so we omit it from the examples.) Integer flooring does **not** create an unpaid dust wallet: the residual is assigned to burn or voters.

### Worked example (`F = 69_000`)

Independent floors (for reference):

| Lane | BPS | `⌊F · bps / 10000⌋` |
|------|-----|---------------------|
| Jackpot | 6900 | 47,610 |
| Burn | 961 | **6,630** |
| Voters | 2139 | 14,759 |
| Sum of floors | — | 68,999 |

Onchain residual assignment (exact conservation `jackpot + burn + voters = F`):

| Path | Residual goes to | Jackpot | Burn | Voters | Sum |
|------|------------------|---------|------|--------|-----|
| **ShareOFT fees** (`_splitShareOftAmount` / `previewDistribution`) | **burn** | 47,610 | **6,631** | 14,759 | 69,000 |
| **Vault-share distribute** (`_distributeVaultShares`) | **voters** | 47,610 | 6,630 | **14,760** | 69,000 |

### Formula

```text
6900 + 961 + 2139 = 10000   -- creatorShareBps = 0 (omitted)

-- ShareOFT path (pending ■ fees)
L = ⌊F · 6900 / 10000⌋
P = ⌊F · 2139 / 10000⌋
B = F − L − P              -- residual to burn

-- Vault-share path
B = ⌊F · 961 / 10000⌋
L = ⌊F · 6900 / 10000⌋
P = F − B − L              -- residual to voters
```

### Done when Lean proves

BPS sum identity; both residual styles conserve `L+B+P = F`; for `F = 69000`, ShareOFT path yields `(47610, 6631, 14759)` and vault-share path yields `(47610, 6630, 14760)` as `(jackpot, burn, voters)`. **Done** — see [Fee-split (proven)](/audits/aristotle/gauge-fee-split).

<details>
<summary>Aristotle prompt (copy-paste)</summary>

```text
Formalize 4626 CreatorGaugeController fee-split conservation in Lean 4.

Default launch constants (creator treasury lane off):
  lottery = 6900, burn = 961, protocol = 2139, maxBps = 10000
  -- creatorShareBps = 0; omit from the model

Prove:
1. lottery + burn + protocol = maxBps

2. ShareOFT residual-to-burn path (matches _splitShareOftAmount / previewDistribution):
     L := F * lottery / maxBps
     P := F * protocol / maxBps
     B := F - L - P
   Prove L + B + P = F for all F,
   and for F = 69000: (L, B, P) = (47610, 6631, 14759)

3. Vault-share residual-to-voters path (matches _distributeVaultShares):
     B := F * burn / maxBps
     L := F * lottery / maxBps
     P := F - B - L
   Prove L + B + P = F for all F,
   and for F = 69000: (L, B, P) = (47610, 6630, 14760)

4. Optional: B in (2) and P in (3) differ from the naive independent floor
   by at most 3 (bounded residual), and never introduce an unpaid dust bucket.

No sorry/admit. Document that burn is 9.61% and protocol/voters 21.39% (do not swap).
```

</details>

---

## 5. Jackpot payout fraction

**Status:** Proven · Project `0837752f-e2f3-4eb3-b5e1-f63c14b64615` · **Code:** `rewardPercentage = 6900` on LotteryManager

### Plain claim

A winner receives **69% of each vault’s jackpot reserve**. That is not “69% of fees again” — fee routing already filled the reserve; payout takes 69% of what is sitting there.

### Worked example

| Reserve R | Payout (69%) | Left in reserve |
|-----------|--------------|-----------------|
| 10,000 | 6,900 | 3,100 |
| 0 | 0 | 0 |
| Three vaults at 10,000 each | 20,700 total | 9,300 total left |

### Formula

```text
payout(R) = ⌊R · 6900 / 10000⌋
left(R)   = R − payout(R)
```

Same **6900** number as fee `lotteryShareBps`, different quantity (reserve vs incoming fee).

### Done when Lean proves

`payout ≤ R`; conservation `payout + left = R`; multi-vault sum ≤ sum of reserves; naming that distinguishes fee-split #4 from payout #5. **Done** — see [Jackpot payout (proven)](/audits/aristotle/jackpot-payout).

<details>
<summary>Aristotle prompt (copy-paste)</summary>

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

</details>

---

## How to submit (operators)

```bash
export ARISTOTLE_API_KEY='arstl_...'
aristotle submit "$(cat prompt.txt)" --wait
aristotle download <project-id> --destination result.tar.gz
```

Store Lean artifacts under `docs/audits/aristotle/<topic>/`, then mark the target **Proven** on the [Introduction](/audits/aristotle) and link a public summary page like [Curve 2.5× boost](/audits/aristotle/curve-boost).

## Related

- [Aristotle introduction](/audits/aristotle)
- [Curve 2.5× boost (proven)](/audits/aristotle/curve-boost)
- [LotteryManager](/contracts/utilities/lottery-manager)
- [GaugeController](/contracts/governance/gauge-controller)

</div>
