---
title: Post-boost win chance (proven)
sidebar_label: Post-boost pipeline (proven)
sidebar_position: 14
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/post-boost-pipeline">Post-boost pipeline</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">All targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">Post-boost win-chance pipeline</h1>
  <p class="audit-hero__subtitle">Machine-checked: personal boost, gauge add, and USD multiplier never push final win chance above the hard cap.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text">Final PPM is always <code>min(scaled, maxWinChance)</code>. With neutral boost (10,000 BPS), zero gauge, and unit USD multiplier, final equals <code>min(base, max)</code> — and equals <code>base</code> when base is already under the cap.</div>
</div>

## Plain claim

Personal boost (up to 2.5×), optional gauge add, and USD multiplier can raise odds — but the final chance is always capped. Neutral boost leaves the base chance unchanged.

## Worked example

| base | covered boost | gauge | multiplier | max | final |
|------|---------------|-------|------------|-----|-------|
| 40,000 PPM (4%) | 1.0× (10,000 BPS) | 0 | 1.0× | 15% | 4% |
| 40,000 | 2.5× | 0 | 1.0× | 15% | 10% |
| 40,000 | 2.5× | 0 | 1.0× | 5% | 5% (cap binds) |

## Formula (onchain model)

```text
boosted = ⌊base · coveredBps / 10_000⌋ + gaugePPM
scaled  = ⌊boosted · usdMultiplierBps / 10_000⌋
final   = min(scaled, maxWinChancePPM)
```

`coveredBps` comes from the proven [Curve 2.5× blend](/audits/aristotle/curve-boost) ∈ [10,000, 25,000].

## What Lean proved

Aristotle project `5d0e6454-fa61-4503-b438-250c771ec84d` builds with **no `sorry` / `admit`**:

- `final_le_maxWinChance`
- `final_eq_min_base` (neutral parameters)
- `boosted_mono_coveredBps`
- `scaled_eq_boosted_of_unit_multiplier`
- `final_eq_base` (base ≤ max + neutral parameters)

## Where it lives in code

- `LotteryManager4626._applyBoost` then multipliers / cap
- Operator notes: `docs/audits/aristotle/post-boost-pipeline/`

## Read next

- [Base win chance](/audits/aristotle/base-win-chance)
- [Curve 2.5× boost](/audits/aristotle/curve-boost)
- [VRF fairness](/audits/aristotle/vrf-fairness)
- [All Lean targets](/audits/aristotle/lean-proof-targets)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>This model takes <code>coveredBps</code> as an input in range; it does not re-prove Curve working-balance algebra (already proven separately).</p>
</div>

</div>
