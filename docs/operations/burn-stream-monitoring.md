---
title: Burn Stream Operator Runbook (L-03)
sidebar_position: 30
---

# `VaultShareBurnStream` operator runbook (L-03 remediation)

## Background

`contracts/utilities/routers/VaultShareBurnStream.sol` is **ownerless by
design** — there is no admin key that can rescue stuck shares or pause
draining mid-epoch. This is the contract's primary "not trust me bro"
enforceability promise.

The single safety valve is `recoverFailedBurns(...)`, which is gated by a
hard cap at `MAX_FAILED_BURN_ACCUMULATOR = 1_000_000e18`. If
`burnSharesForPriceIncrease` reverts persistently (vault paused, vault
share-mint blocklisted, etc.) the failed-burn accumulator monotonically
grows, and once it hits the cap, `drip()` reverts thereafter — freezing
the burn stream until manual recovery is performed.

Because the contract has no owner, **only proactive monitoring of the
on-chain `BurnFailed(...)` event protects against this stuck-state**.

## Required monitoring

Operations MUST page on the following on-chain events emitted by every
deployed `VaultShareBurnStream` instance:

- `BurnFailed(uint256 sharesAttempted, bytes reason)` — emitted any time
  `burnSharesForPriceIncrease` reverts inside `drip()`. A single emission
  is informational; **two within 24 hours** indicates a vault is
  persistently rejecting the burn and the failed-burn accumulator is
  filling up. Page on-call.

- `FailedBurnAccumulatorAdvanced(uint256 newTotal)` (if implemented in
  the deployed version) — direct visibility of the accumulator growth.

## Cap budget

The cap is `1_000_000e18` failed-burn shares. With typical drip cadences,
this budget is consumed in days/weeks if every drip reverts; in minutes
if the contract is being attacked with rapid drips.

| Drip cadence | Time to cap (approx) |
| ------------ | -------------------- |
| 1 drip/min   | ~16 hours            |
| 1 drip/10s   | ~2.7 hours           |
| 1 drip/sec   | ~16 minutes          |

## Recovery procedure

1. **Identify the underlying revert.** Read the `reason` bytes from the
   most recent `BurnFailed` event; map the selector to the vault contract
   that owns the share. Common causes:
    - Vault paused (`Paused()`)
    - Vault share-burn blocklist hit (`BurnBlocked()`)
    - Strategy reverted in the vault's `_burnShares` hook

2. **Resolve the upstream blocker.** Unpause the vault, lift the
   blocklist, or intervene in the strategy. The burn stream cannot be
   recovered while the upstream vault still rejects burns.

3. **Call `recoverFailedBurns(...)`** from the documented recovery
   address. This drains the accumulator back to zero and re-enables
   `drip()`. The recovery target is fixed at deploy time and cannot be
   changed.

## Alerting setup

Recommended Grafana / Datadog query (Base mainnet):

```
event_signature == keccak("BurnFailed(uint256,bytes)")
  AND contract_address IN <VaultShareBurnStream addresses>
  AND tx_status == 1
```

Page on `count > 1 over 24h` per address.

## References

- Contract: `contracts/utilities/routers/VaultShareBurnStream.sol`
- Audit finding: L-03 (audit 2026-04-25)
- Related fixes: BS-01..03 (early ringbuffer hardening)
