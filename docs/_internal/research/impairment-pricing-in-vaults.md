# Impairment Pricing in Vaults

This document explains why 4626 uses a side-pocket rights model for true impairment, and when that model should be triggered.

For implementation details, see:
- [`impairement.md`](/research/impairement)
- [`state-machine-rights-separation.md`](/research/state-machine-rights-separation)

---

## The Problem

When one strategy becomes unpriceable (hacked, frozen, or functionally illiquid), there is no mathematically fair single NAV for pooled shares:

1. **Mark at full value**: exiting users may over-withdraw, leaving losses for stayers.
2. **Mark at zero/exclude immediately**: exiting users may forfeit value that later recovers.

Both choices create wealth transfer under uncertainty.

---

## Why a Formula Is Not Enough

DeFi adds constraints that make naive pricing unsafe:

- **Atomic arbitrage**: wrong prices are exploited in-block.
- **Composability pressure**: many integrations assume one fungible ERC-4626 share class.
- **No objective oracle for broken positions**: discretionary marking introduces governance trust.

---

## Adopted v1 Position

For **true impairment**, use mechanism design over mark guessing:

1. **Freeze fast** (`Suspect` mode) to close atomic arbitrage windows.
2. **Snapshot rights at trip boundary**.
3. **Resume clean-book vault** after finalization.
4. **Distribute only realized recovery** to epoch claim holders.

This keeps main shares fungible while preserving fairness for pre-impairment holders.

---

## Trigger Taxonomy

### Mark-to-market stress (no side-pocket)

If strategy remains objectively priceable and redeemable under known slippage/risk, handle through normal vault controls and rebalancing.

### True impairment (side-pocket path)

Use side-pocketing when valuation is unavailable or non-credible, with objective signals such as:
- persistent valuation readiness failure,
- failed withdraw probes / unreconciled debt,
- protocol pause/freeze/exploit signals,
- guardian emergency trip lane for immediate safety.

---

## Composability Trade-Off (v1)

v1 does not include claim-aware integration adapters. Therefore:

- if shares are held by wrappers/lending markets at `tripBlock`, those contracts receive claims,
- beneficial-owner pass-through is not guaranteed in v1.

This is an explicit and documented v1 trade-off.

---

## Why Non-Transferable Claims in v1

Non-transferability keeps distribution accounting simple and robust while launching:

- avoids reward-debt complexity for secondary claim markets,
- reduces ambiguity during partial recoveries,
- lowers attack surface in first deployment.

Transferability is intentionally deferred to v2 with redesigned accounting.

---

## Governance Boundaries

Governance/guardian may freeze and manage lifecycle transitions, but must not be able to assign discretionary impaired NAV or redirect recovery outside snapshot claim rules.

This boundary is mandatory for auditability and user trust.

---

## Summary

For unpriceable strategy events, 4626 v1 treats impairment as a **rights-separation problem**, not a pricing-formula problem:

- main ERC-4626 share = clean book,
- epoch claim rights = impaired recovery,
- payouts = realized proceeds only.
