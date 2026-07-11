---
title: Formal verification (Aristotle / Lean)
sidebar_label: Formal verification
sidebar_position: 20
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

# Formal verification (Aristotle / Lean)

4626 uses [Aristotle](https://aristotle.harmonic.fun/) (Harmonic) to produce **machine-checked Lean 4 proofs** of the protocol’s mathematical claims — lottery odds, boost envelopes, fee splits, and payout fractions.

This is **complementary** to the June 2026 [technical security review](/audits/fable): Lean proves abstract formulas and conservation lemmas; it does not replace Solidity audits, Foundry tests, or operational controls.

## Status

| Area | Status | Notes |
|------|--------|--------|
| Curve personal boost (1.0×–2.5×) + coverage blend | Proven | See internal summary under `docs/audits/aristotle/ve4626-curve-boost/` |
| Base win chance, boost pipeline, VRF fairness, gauge split, jackpot payout | **Queued targets** | Ready-to-submit prompts: [Lean proof targets](/audits/aristotle/lean-proof-targets) |

## Read next

- [Lean proof targets (top 5)](/audits/aristotle/lean-proof-targets) — statements, formulas, and Aristotle submit prompts
- [Fees, auction, and lottery](/overview/how-it-works) — product overview
- [LotteryManager](/contracts/utilities/lottery-manager) — win chance and VRF surface
- [GaugeController](/contracts/governance/gauge-controller) — fee split and jackpot custody

## Disclaimer

Published Lean targets describe **intended mathematical models**. Until a target is marked **Proven** with a linked Lean artifact (or Aristotle project ID), treat it as a verification backlog item — not a completed certificate.
