---
title: Curve 2.5× boost (proven)
sidebar_label: 2.5× boost (proven)
sidebar_position: 11
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/curve-boost">2.5× boost (proven)</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">Next targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">Curve 2.5× personal boost</h1>
  <p class="audit-hero__subtitle">Machine-checked: lottery personal boost stays between 1.0× and 2.5×, and only the covered fraction of that uplift applies to a trade.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text">The corrected Curve working-balance model is sound for the stated rules. Raw boost is bounded to <strong>10,000–25,000 BPS</strong> (1.0×–2.5×). Coverage blending never exceeds the raw boost. Full 2.5× requires ve share ≥ LP share on the trade.</div>
</div>

## Plain claim

Holding ve■4626 can raise your lottery odds by up to **2.5×** versus a tokenless baseline — never more under this model — and only for the portion of the trade covered by your ShareOFT balance.

## Worked example

| Situation | Result |
|-----------|--------|
| No eligible ve | **1.0×** (neutral — 10,000 BPS) |
| Full ve match + full Share coverage | **2.5×** (25,000 BPS) |
| Full ve match but only half Share coverage | Uplift is **half** of the way from 1.0× to 2.5× → **1.75×** |

Coverage blend (same shape Lean proved):

```text
effectiveBPS = 10_000 + ⌊(rawBoost − 10_000) · coverageBPS / 10_000⌋
```

Example: `rawBoost = 25_000`, `coverageBPS = 5_000` (50%) → `effectiveBPS = 17_500` (1.75×).

## Formula (onchain model)

```text
tokenlessWorking = ⌊0.4 · l⌋
working          = min(tokenlessWorking + ⌊⌊0.6 · L⌋ · ve / Ve⌋, l)
rawBoost         = clamp(⌊working · 10_000 / tokenlessWorking⌋, 10_000, 25_000)

coverageBPS      = ⌊min(shareUSD, swapUSD) · 10_000 / swapUSD⌋
effectiveBPS     = 10_000 + ⌊(rawBoost − 10_000) · coverageBPS / 10_000⌋
```

Where `l` is covered skin this trade, `L` is pool size (creator Share supply USD), `ve` / `Ve` are effective veLottery and live total ve power.

**Do not confuse:**

| Ratio | Range | Meaning |
|-------|-------|---------|
| `working / l` | 0.4 → 1.0 | Fraction of position that “works” |
| `working / (0.4 · l)` | **1.0 → 2.5** | Quoted boost vs tokenless baseline |

Zero position, zero tokenless working, or zero coverage → neutral **10,000 BPS**.

## What Lean proved

New to this section? Start with the [Aristotle introduction](/audits/aristotle) (what Lean, Aristotle, and “no sorry” mean).

Aristotle project `46f81830-e389-4fe4-b03d-63bd050d8b0b` builds with **no `sorry` / `admit`**. Core lemmas include:

- Boost stays in `[1.0, 2.5]` (`curveBoost_mem_Icc`, `rawBoost_*`)
- Full 2.5× iff ve share ≥ LP share (`curveBoost_full_iff`)
- Closed form `min(5/2, 1 + (3/2)·r)` (`curveBoost_eq_min_r`)
- `working ≤ l`; coverage and effective BPS bounds
- Boost is antitone in total `Ve` (larger total ve → weaker personal share)

Shipping delta checks (oracle window, covered floor, LM coverage blend) were also confirmed against the same project.

## Where it lives in code

- `ve4626BoostManager.calculateBoostForPosition` — raw Curve multiplier
- `LotteryManager4626._applyBoost` — coverage blend into win chance
- Foundry: `ve4626BoostManager.t.sol`, `LotteryManager4626.Hardening.t.sol`

## Read next

- [Aristotle introduction](/audits/aristotle) — how proofs work
- [Base win chance](/audits/aristotle/base-win-chance) · [Post-boost](/audits/aristotle/post-boost-pipeline) · [VRF](/audits/aristotle/vrf-fairness) · [Fee-split](/audits/aristotle/gauge-fee-split) · [Jackpot](/audits/aristotle/jackpot-payout)
- [All Lean targets](/audits/aristotle/lean-proof-targets)
- [LotteryManager](/contracts/utilities/lottery-manager)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>This page summarizes a Lean model of the boost formulas. Live lottery boost sources may remain unset until ops enables them. Full operator notes remain in the repo under <code>docs/audits/aristotle/ve4626-curve-boost/</code>.</p>
</div>

</div>
