---
title: VRF win-check fairness (proven)
sidebar_label: VRF fairness (proven)
sidebar_position: 15
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/vrf-fairness">VRF fairness</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">All targets (proven)</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">VRF decision fairness</h1>
  <p class="audit-hero__subtitle">Machine-checked: a uniform roll over one million outcomes wins with exactly <code>winChancePPM / 1_000_000</code>.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text">Under uniform randomness over <code>N = 1_000_000</code> outcomes, the win check <code>(r mod N) &lt; p</code> has probability exactly <code>p / N</code>. A listed <strong>4%</strong> chance (<code>p = 40_000</code>) is a real <strong>4%</strong> in this model.</div>
</div>

## Plain claim

If randomness is uniform over one million outcomes, the chance of winning equals `winChancePPM / 1_000_000`. A 4% listed chance is a real 4% under that model.

## Worked example

| winChancePPM | Probability |
|--------------|-------------|
| 0 | 0% (never) |
| 40,000 | **4%** |
| 150,000 | **15%** |
| 1,000,000 | 100% (always) |

## Formula (onchain model)

```text
win  ⇔  (r mod 1_000_000) < winChancePPM
P(win) = winChancePPM / 1_000_000    when 0 ≤ winChancePPM ≤ 1_000_000
```

## What Lean proved

Aristotle project `e1fdf9eb-ab16-46fe-9d75-e02705a934d5` builds with **no `sorry` / `admit`** (Finset counting):

- `card_winners` — exactly `p` winners in `range N` when `p ≤ N`
- `prob_eq` — `prob p = (p : ℚ) / N`
- `prob_zero` / `prob_full`
- `prob_40000` — `prob 40000 = 4 / 100`

## Where it lives in code

- `(randomWords[0] % 1_000_000) < winChancePPM` in `LotteryManager4626`
- Operator notes: `docs/audits/aristotle/vrf-fairness/`

## Read next

- [Base win chance](/audits/aristotle/base-win-chance)
- [Post-boost pipeline](/audits/aristotle/post-boost-pipeline)
- [All Lean targets](/audits/aristotle/lean-proof-targets)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>This proves fairness of the comparison under a uniform model of <code>r</code>. It does not verify VRF entropy quality or Chainlink / local VRF wiring.</p>
</div>

</div>
