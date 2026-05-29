# Creator Vault Business Logic — Core Structure & Canonical Value Lanes

**Status**: Canonical reference (per AGENTS.md "Canonical Lane Terminology" policy).  
**Date**: 2026-05 (initial version created during general audit)  
**Purpose**: Single source of truth for the five mandated value lanes, their triggers, custody, authority, and on-chain wiring. Eliminates ambiguity between "creator earnings", "payoutRecipient", "external revenue", etc.

---

## The Five Mandated Canonical Lanes

AGENTS.md requires these exact names in docs, UI copy, commit messages, and code comments. Bare `payoutRecipient` (outside raw on-chain identifiers) and "externalRevenueRecipient" / unqualified "creator earnings" are forbidden.

### 1. tradeFeeCollector
- **Lane**: ShareOFT / hook **trade-fee** plane (and optional hook fee plane).
- **Destination domain**: `CreatorGaugeController` (via `tradeFeeCollector()` on CreatorShareOFT and `feeRecipient` on CCALaunchStrategy).
- **Trigger**: Native ShareOFT transfers (SwapOnly → non-SwapOnly) + configured hook fees.
- **Custody / Routing**: Gauge receives fees → distributes to burn, jackpotReserve, creatorTreasury (if enabled), protocol/voter rewards.
- **On-chain identifiers**:
  - `CreatorShareOFT.tradeFeeCollector()`
  - `CCALaunchStrategy.feeRecipient`
  - `CreatorGaugeController` (primary recipient in most deployments)
- **Notes**: This is the primary ongoing fee lane for vault shares. Distinct from creator coin external revenue.

### 2. creatorCoinPayoutRecipient
- **Lane**: Creator Coin **external earnings** (protocol rewards, secondary market fees, etc. that accrue to the creator coin itself).
- **Destination**: `PayoutRouter.convertAndQueue(...)` → swap to creatorCoin → deposit into vault → `VaultShareBurnStream` (ownerless, gradual burn for holder PPS accretion).
- **Trigger**: External revenue events on the creator coin (not vault share trading fees).
- **Authority / Gating**: Authorized queuers (keeper + deploy-session paths); permissionless drip via `VaultShareBurnStream.checkpoint()`.
- **On-chain identifiers**:
  - Creator Coin `payoutRecipient` setter (Zora coin contract — this is the raw field name that must be qualified in all docs/comments as `creatorCoinPayoutRecipient`).
  - `PayoutRouter`
  - `VaultShareBurnStream`
- **Policy**: Never call this the "trade-fee" lane or conflate with `tradeFeeCollector`. In router mode it feeds holder PPS accretion, not a direct creator treasury spend.

### 3. creatorTreasury
- **Lane**: Creator **ongoing** lane from gauge `creatorShareBps`.
- **Destination**: Direct to creator-controlled treasury (when `creatorShareBps > 0`).
- **Trigger**: Gauge distribution when the creator ongoing share is enabled.
- **Enforcement**: `setFeeSplit(...)` / `setCreatorTreasury(...)` require `creatorTreasury != address(0)` when `creatorShareBps > 0`.
- **On-chain**: `CreatorGaugeController.creatorTreasury`
- **Default**: Disabled (`creatorShareBps = 0`).

### 4. jackpotCustodian
- **Lane**: Jackpot reserve (vault-share units).
- **Custody**: `CreatorGaugeController.jackpotReserve`
- **Authority split**: Gauge only custodies. Selection and payout is performed by a separate authority.
- **On-chain**: `CreatorGaugeController.jackpotReserve`

### 5. jackpotPayoutAuthority
- **Lane**: The entity that selects winners and pays out the jackpot.
- **Implementation**: `CreatorLotteryManager.payJackpot(...)` → deposits into the gauge's jackpot reserve.
- **Critical invariant**: Custody (`jackpotCustodian`) and payout authority must always be split. Never conflate them into a single "lottery wallet".
- **On-chain**: `CreatorLotteryManager`

---

## Separation of the Two Creator Coin Earnings Planes (SC-05)

The architecture deliberately keeps two distinct planes for creator coin value accrual:

- **Trade-fee lane** (`tradeFeeCollector` domain) — from vault share trading activity (ShareOFT + hook). Flows through the gauge.
- **External revenue lane** (`creatorCoinPayoutRecipient` domain) — from the creator coin's own activity (protocol rewards, etc.). Routed via PayoutRouter → burn stream for holder benefit.

`PayoutRouter` and `VaultShareBurnStream` exist specifically to handle the external lane safely and gradually.

---

## On-Chain vs Documentation Rules

- Raw on-chain identifiers (e.g., struct fields named `payoutRecipient` in DeploymentBatcher or Zora coin contracts) may retain their historical names for ABI / calldata compatibility.
- **All** surrounding comments, error messages, variable names in new code, UI labels, docs, and commit messages **must** use the five canonical terms above and qualify the lane explicitly.
- "Creator earnings" without a lane qualifier is forbidden.

---

## References

- AGENTS.md — "Canonical Lane Terminology" section (repo-level authority).
- `docs/audits/general-audit-2026-05.md` and `general-audit-2026-05-sc-hygiene.md` (findings SC-01, SC-02, Lens B).
- `CreatorGaugeController`, `CreatorShareOFT`, `PayoutRouter`, `VaultShareBurnStream`, `CreatorLotteryManager`, `CCALaunchStrategy`, `DeploymentBatcher` (phase-2 paths).

---

*This document is the canonical reference. Update it when lane mechanics, routing, or enforcement change. All other docs must defer to it.*

---

## Current Mainnet Reference Implementation (v1.11.2-pipe-a / v1.12 epoch, May 2026)

**Active split Phase-1 Deployment Batcher**: `0xa99058f424FB3ACC639F59355C65C40149030651`

**Key live infrastructure (from `frontend/src/config/contracts.defaults.ts` BASE_DEFAULTS + AKITA/ERC4626 defaults)**:

- `protocolTreasury`: `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` (cold — creatorTreasury target when enabled, protocol share fallback)
- `lotteryManager`: `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` (jackpotPayoutAuthority)
- `registry`: `0x3f64087dc361Ad52300409E5873b26941D6418B6` (CreatorRegistry)
- `solanaBridgeAdapter`: `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1`

**Per-creator example (AKITA, the current grandfathered reference vault)**:
- Creator Token: `0x5b674196812451b7cec024fe9d22d2c0b172fa75`
- GaugeController: `0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1` (receives `tradeFeeCollector` role for this vault)
- CreatorOVault: `0x82C06EaAE27B1Ca31fA29F22341A162A670A4471`
- ShareOFT: `0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57`

**Lane wiring notes for current greenfield deploys**:
- `tradeFeeCollector` for a new vault's ShareOFT and CCALaunchStrategy is set to the per-creator `GaugeController` deployed in Phase 2.
- `creatorCoinPayoutRecipient` (the raw `payoutRecipient` field in Phase2CoreParams) is forced to `address(0)` in the batcher for greenfield deploys. The actual creatorCoin payout recipient is set post-deploy by the owner via `CreatorCoin.setPayoutRecipient(...)` (typically to the PayoutRouter for the external earnings lane).
- `creatorTreasury` is left at zero unless the creator explicitly enables `creatorShareBps > 0` via `setFeeSplit` / `setCreatorTreasury`.
- `jackpotCustodian` = the GaugeController's `jackpotReserve`.
- `jackpotPayoutAuthority` = the global `lotteryManager`.

**Module versions (v1.12+)**:
- CreatorOVault core/strategies/admin modules are the v2 storage version (`CreatorOVaultModuleStorage.v2`).
- Phase 3 strategies (Charm + Ajna) are the current recommended pair for paid `vault_full_deploy` entitlements.

**Important policy reminders for this epoch**:
- Greenfield Phase 2 finalize is payable (LZ native fee for ShareOFT peer wiring + Pipe A auto-bridge).
- `finalizePhase2` no longer requires `meteoraAlphaVault` / `solanaIxs` bytes (those are handled out-of-band via the Solana provisioner + keeper).
- `PayoutRouter` is the canonical path for the `creatorCoinPayoutRecipient` lane on new vaults (authorized queuer pattern).

This section will be updated when the active batcher, module set, or lane routing changes. The source of truth for the current epoch is the combination of this document + `frontend/src/config/contracts.defaults.ts` + the live `DeploymentBatcher` getters.