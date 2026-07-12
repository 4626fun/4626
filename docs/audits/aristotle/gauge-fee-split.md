---
title: Gauge fee-split conservation (proven)
sidebar_label: Fee-split (proven)
sidebar_position: 16
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
  <a class="audit-path__step audit-path__step--current" href="/audits/aristotle/gauge-fee-split">Fee-split</a>
  <a class="audit-path__step" href="/audits/aristotle/lean-proof-targets">All targets</a>
</nav>

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Proven · Aristotle / Lean&nbsp;4</span>
  <h1 class="audit-hero__title">Gauge fee-split conservation</h1>
  <p class="audit-hero__subtitle">Machine-checked: lottery / burn / voters BPS sum to 100%, and floor residuals stay on an onchain lane — never an unpaid dust bucket.</p>
</section>

<div class="audit-verdict">
  <div class="audit-verdict__label">Verdict</div>
  <div class="audit-verdict__text"><strong>6900 + 961 + 2139 = 10000</strong>. Burn is <strong>9.61%</strong>; voters/protocol are <strong>21.39%</strong> (do not swap). ShareOFT fees residual to burn; vault-share distribute residual to voters. Both paths conserve <code>L + B + P = F</code>.</div>
</div>

## Plain claim

Every trade fee is split **69% jackpot / 9.61% burn / 21.39% voters**. Those three BPS add to 100%. Creator treasury lane is off (`creatorShareBps = 0`) and omitted. Integer flooring does **not** create an unpaid dust wallet.

## Worked example (`F = 69_000`)

| Path | Residual to | Jackpot | Burn | Voters | Sum |
|------|-------------|---------|------|--------|-----|
| ShareOFT fees | burn | 47,610 | **6,631** | 14,759 | 69,000 |
| Vault-share distribute | voters | 47,610 | 6,630 | **14,760** | 69,000 |

## Formula (onchain model)

```text
6900 + 961 + 2139 = 10000

-- ShareOFT (_splitShareOftAmount / previewDistribution)
L = ⌊F · 6900 / 10000⌋
P = ⌊F · 2139 / 10000⌋
B = F − L − P

-- Vault-share (_distributeVaultShares)
B = ⌊F · 961 / 10000⌋
L = ⌊F · 6900 / 10000⌋
P = F − B − L
```

## What Lean proved

Aristotle project `28ab1f5d-2e57-4131-86d2-128ba0f458ab` builds with **no `sorry` / `admit`**:

- `lanes_sum_maxBps`
- `shareOft_conservation` / `shareOft_example`
- `vault_conservation` / `vault_example`
- Residual bounds (`shareOft_B_bounded`, `vault_P_bounded`) and no-dust restatements

## Where it lives in code

- `CreatorGaugeController` — `_splitShareOftAmount` / `previewDistribution` / `_distributeVaultShares`
- Operator notes: `docs/audits/aristotle/gauge-fee-split/`

## Read next

- [Jackpot payout](/audits/aristotle/jackpot-payout) — same 6900 number, different base
- [GaugeController](/contracts/governance/gauge-controller)
- [All Lean targets](/audits/aristotle/lean-proof-targets)

<div class="audit-limitations">
  <div class="audit-limitations__title">Scope note</div>
  <p>Creator treasury lane (<code>creatorShareBps</code>) is omitted because launch default is <code>0</code>. Do not treat this as a proof that an enabled creator lane still conserves without a fourth residual rule.</p>
</div>

</div>
