---
title: Charm Executive Brief
sidebar_position: 1
---

# Executive Brief: Charm Alpha Vaults V2 + 4626fun Integration

Date: 2026-03-24  
Audience: protocol, treasury, and risk stakeholders

## Bottom Line

The stack is contract-sound but **economically fragile under synchronous ERC-4626 expectations**. The main risk is not reentrancy-style contract breakage; it is **fairness drift between accounting value and realizable exit value** when concentrated-liquidity inventory, oracle freshness, and automation liveness diverge.

## Key Strengths

- Native Charm contracts have clear role boundaries and explicit rebalance guards.
- 4626fun adds valuation-readiness checks, strategy-debt fallbacks, transfer exactness checks, and withdrawal delay controls.
- Wrapper layer validates ShareOFT mint/burn behavior and normalization accounting.
- Queue + CSW execution path includes dedupe/retry controls and owner-index checks.

## Highest Risks

1. **Accounting value can overstate executable value** during stress.  
2. **Synchronous wrapper UX can mislead** users on real redemption timing/value.  
3. **Rebalance policy can be economically bad while rule-compliant** (parameter sensitivity).  
4. **Operational liveness concentration** (multi-path automation, CSW owner drift, bundler/paymaster dependence).

## Recommended Operating Model

Adopt an **async/queued redemption-first model**:

- Present three values in UX/API: accounting value, executable-now value, queued estimate.
- Use conservative valuation bounds for mint/redeem fairness.
- Enforce one canonical producer and one canonical executor for Charm actions.
- Keep explicit runbooks for owner-index drift, queue backlog, and oracle staleness.

## Go / No-Go

- Native safety: **7/10**
- Accounting integrity: **5/10**
- Valuation honesty: **4/10**
- Rebalance robustness: **4/10**
- Automation resilience: **5/10**
- Overall deployability: **4.5/10**

**Decision:** No broad production rollout with current synchronous semantics.  
**Allowed next step:** constrained pilot with strict TVL caps and queue-first redemption disclosures.

## Blockers Before Scale

1. Wrapper-level queue-equivalent redemption path.
2. Conservative executable valuation model.
3. Hardened rebalance parameter envelope and governance change controls.
4. Single-path automation topology with strict idempotency and incident SLOs.

