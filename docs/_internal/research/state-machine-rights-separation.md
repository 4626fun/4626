# State Machine and Rights Separation (ADR)

**Status:** Accepted for v1  
**Date:** June 1, 2026  
**Scope:** `CreatorOVault` impairment handling policy

---

## Decision

Use a two-layer impairment model:

1. **Vault mode** (`Normal`, `Suspect`) controls ERC-4626 settlement safety.
2. **Impairment epochs** (`Tripped`, `Finalized`, `Resolved`) control side-pocket recovery rights.

Main ERC-4626 shares remain fungible and represent clean-book assets only after impairment finalization. Recovery economics are separated into epoch claim rights.

---

## Why

When a strategy becomes unpriceable, formulaic NAV marking creates unfair wealth transfer. Side-pocketing avoids forced socialization at a known-wrong price while preserving clean-book fungibility for downstream integrations.

---

## v1 Policy Locks

- Snapshot boundary is the **trip block**.
- Only one active `Tripped` epoch at a time.
- Claims are **non-transferable** in v1.
- Root finalization requires a challenge window before claims are mintable.
- Recovery is recognized from realized proceeds only.
- `excludedBookValue` is diagnostic metadata only.

---

## Trust Model

- Guardian/emergency lane may freeze via `tripImpairment`, but cannot assign manual impaired NAV.
- Governance may tune controls and reinstate strategies, but cannot allocate recovery outside claim rules.
- Recovery distribution is deterministic and pro-rata to finalized snapshot claims.

---

## Required User and Integrator Disclosure

If shares are held by a wrapper/lending market at `tripBlock`, that contract receives claim rights in v1. Beneficial-owner pass-through is out of scope until claim-aware adapters are shipped.

---

## Non-Negotiable Invariants

1. No atomic ERC-4626 entry/exit settlement while vault is `Suspect`.
2. Finalized impaired strategy contributes zero to clean-book `totalAssets()`.
3. Recovery value is never counted in both clean NAV and recovery claims.
4. Post-trip entrants cannot obtain prior epoch recovery rights via deposit/mint.
5. Claims/recovery cannot be processed before root finalization.
