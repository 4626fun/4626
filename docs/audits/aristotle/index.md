---
title: Formal verification (Aristotle / Lean)
sidebar_label: Formal verification
sidebar_position: 10
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

<nav class="audit-path" aria-label="Formal verification">
  <a class="audit-path__step" href="/audits">Audits hub</a>
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle">Formal verification</a>
  <a class="audit-path__step" href="/audits/aristotle/curve-boost">2.5× boost (proven)</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">Next targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Machine-checked math</span>
  <h1 class="audit-hero__title">Formal verification</h1>
  <p class="audit-hero__subtitle">4626 uses Aristotle (Harmonic) to produce Lean&nbsp;4 proofs of lottery odds, boost math, fee splits, and payout fractions. These proofs check formulas — they do not replace Solidity audits or Foundry tests.</p>
  <div class="home-hero__actions">
    <a class="home-btn home-btn--primary" href="/audits/aristotle/curve-boost">Read proven 2.5× boost<span class="home-btn__arrow" aria-hidden="true">→</span></a>
    <a class="home-btn home-btn--ghost" href="/audits/aristotle/lean-proof-targets">Next five targets</a>
  </div>
</section>

<div class="docs-at-a-glance">

**In plain English:** a Lean proof is a machine-checked argument that a claim is true. If Lean accepts it, the formula holds under the stated model — not “the whole protocol is safe,” but “this math claim is correct.”

</div>

## What is published

| Claim | Status | Read |
|-------|--------|------|
| Personal lottery boost is **1.0×–2.5×** (Curve working balance + coverage blend) | **Proven** | [Curve 2.5× boost](/audits/aristotle/curve-boost) |
| Base win chance ($1 → 0.0004%) | Queued | [Target 1](/audits/aristotle/lean-proof-targets#1-base-win-probability) |
| Boosted win chance never exceeds the hard cap | Queued | [Target 2](/audits/aristotle/lean-proof-targets#2-post-boost-win-chance-pipeline) |
| VRF roll matches the stated probability | Queued | [Target 3](/audits/aristotle/lean-proof-targets#3-vrf-decision-fairness) |
| Fee split BPS sum to 100%; floor residuals go to burn or voters (no unpaid dust) | Queued | [Target 4](/audits/aristotle/lean-proof-targets#4-gauge-fee-split-conservation) |
| Jackpot pays 69% of **reserve** (not fees twice) | Queued | [Target 5](/audits/aristotle/lean-proof-targets#5-jackpot-payout-fraction) |

## How to read a claim

1. **Plain claim** — one sentence anyone can check against product docs.
2. **Worked example** — numbers you can recalculate by hand.
3. **Formula** — the onchain integer model.
4. **Proven / still open** — whether Lean already accepted it.

## Related product docs

- [Fees, auction, and lottery](/overview/how-it-works)
- [LotteryManager](/contracts/utilities/lottery-manager)
- [GaugeController](/contracts/governance/gauge-controller)
- [June 2026 security review](/audits/fable)

<div class="audit-limitations">
  <div class="audit-limitations__title">Disclaimer</div>
  <p>Queued targets are a verification backlog until marked <strong>Proven</strong> with a Lean artifact or Aristotle project ID. Proven models cover the stated formulas only — not runtime config, operator keys, or off-model Solidity paths.</p>
</div>

</div>
