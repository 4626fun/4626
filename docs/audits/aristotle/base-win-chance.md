---
title: Base win chance (proven)
sidebar_label: Base win chance (proven)
sidebar_position: 13
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/base-win-chance">Base win chance</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">All targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">Base win chance ($1 → 0.0004%)</h1>
  <p class="audit-hero__subtitle">Machine-checked: eligible swap USD scales win chance linearly in PPM until the pre-boost ceiling.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text">Every <strong>$1</strong> of eligible swap USD adds <strong>4 PPM</strong> (0.0004%) of win chance until the default pre-boost ceiling of <strong>40,000 PPM (4%)</strong> at $10k. Larger trades stay capped.</div>
</div>

## Plain claim

Every $1 of eligible swap USD adds **4 PPM** (0.0004%) of win chance, until the pre-boost ceiling (default **4%** at $10k).

## Worked example

| Trade | PPM | Chance |
|-------|-----|--------|
| $1 | 4 | 0.0004% |
| $100 | 400 | 0.04% |
| $1,000 | 4,000 | 0.4% |
| $10,000 | 40,000 | **4%** (ceiling) |
| $20,000 | 40,000 | still **4%** |

## Formula (onchain model)

Solidity uses USDC **1e6** units (`swapAmountUSD`):

```text
winChancePPM = min(⌊swapAmountUSD / 250_000⌋, baseCeilingPPM)
```

Default `baseCeilingPPM = 40_000`. So `$1 → 1_000_000 / 250_000 = 4` PPM.

Lean proves the same table with dollar labels via the equivalent encoding `min(⌊usdDollars · 1_000_000 / 250_000⌋, c)`.

## What Lean proved

New to this section? Start with the [Aristotle introduction](/audits/aristotle).

Aristotle project `fedb2c3c-b7a9-41bc-bd53-5a105964042f` builds with **no `sorry` / `admit`**. Core lemmas:

- Table examples (`winChancePPM_1` … `winChancePPM_20000`)
- Always `≤` ceiling (`winChancePPM_le_ceiling`)
- Monotone in USD (`winChancePPM_monotone`)
- `4 PPM = 4/1_000_000 = 0.0004%` as a rational (`ppm_four_eq_fraction`)
- Conversion identity `usd · 1_000_000 / 250_000 = usd · 4` (`conv_eq`)

## Where it lives in code

- `LotteryManager4626.calculateWinChance`
- Operator notes: `docs/audits/aristotle/base-win-chance/`

## Read next

- [Post-boost pipeline](/audits/aristotle/post-boost-pipeline)
- [VRF fairness](/audits/aristotle/vrf-fairness)
- [All Lean targets](/audits/aristotle/lean-proof-targets)
- [LotteryManager](/contracts/utilities/lottery-manager)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>This page summarizes the linear pre-boost formula. Solidity <code>minSwapAmount</code> early-return <code>0</code> is out of the Lean model. Live boosts and post-boost caps are separate claims.</p>
</div>

</div>
