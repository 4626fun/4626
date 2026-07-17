---
title: Jackpot payout fraction (proven)
sidebar_label: Jackpot payout (proven)
sidebar_position: 17
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/jackpot-payout">Jackpot payout</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">All targets (proven)</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">Jackpot payout fraction</h1>
  <p class="audit-hero__subtitle">Machine-checked: a winner receives 69% of each vault’s jackpot <strong>reserve</strong> — not 69% of fees twice.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text"><code>payout(R) = ⌊R · 6900 / 10000⌋</code> never exceeds <code>R</code>, and <code>payout + left = R</code>. The constant <strong>6900</strong> matches fee <code>lotteryShareBps</code> numerically but scales a <strong>different base</strong> (reserve vs incoming fee).</div>
</div>

## Plain claim

A winner receives **69% of each vault’s jackpot reserve**. Fee routing already filled the reserve; payout takes 69% of what is sitting there.

## Worked example

| Reserve R | Payout (69%) | Left in reserve |
|-----------|--------------|-----------------|
| 10,000 | 6,900 | 3,100 |
| 0 | 0 | 0 |
| Three vaults at 10,000 each | 20,700 total | 9,300 total left |

## Formula (onchain model)

```text
payout(R) = ⌊R · 6900 / 10000⌋
left(R)   = R − payout(R)
```

## What Lean proved

Aristotle project `0837752f-e2f3-4eb3-b5e1-f63c14b64615` builds with **no `sorry` / `admit`**:

- `payout_le` / `payout_add_leftover`
- `payout_mono`
- `payout_10000` / `payout_zero`
- `totalPayout_eq_sum_map` / `totalPayout_le_sum`
- `rewardBps_independent_of_lotteryShareBps` (numeric equality only)

## Where it lives in code

- `LotteryManager` `rewardPercentage = 6900`
- Operator notes: `docs/audits/aristotle/jackpot-payout/`

## Read next

- [Gauge fee-split](/audits/aristotle/gauge-fee-split) — same 6900 on fee amounts
- [LotteryManager](/contracts/utilities/lottery-manager)
- [All Lean targets](/audits/aristotle/lean-proof-targets)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>This is independent of fee-split lottery BPS even though both use 6900. Confusing the two bases would double-count the 69% story in product copy.</p>
</div>

</div>
