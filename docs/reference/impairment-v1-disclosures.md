---
title: Impairment v1 disclosures
sidebar_position: 4
---

# Impairment v1 disclosures

Public behavior summary for `CreatorOVault` **impairment side-pocketing v1** (new vault launches on module storage v3).

## What v1 does

- Keeps one fungible ERC-4626 share for clean-book operations.
- Uses trip-boundary snapshots to lock recovery rights for impaired epochs.
- Uses non-transferable v1 claims (epoch-scoped).
- Uses realized-only recovery accounting through `CreatorORecoveryEscrow`.
- Excludes finalized impaired strategies from clean-book `totalAssets()`.

## What v1 does not do

- No transferable claims.
- No claim-aware pass-through adapters for wrappers/lending markets.
- No onchain historical share checkpoints for eligibility (Merkle-root snapshot flow is used in v1).

## Critical user disclosure

If your shares are held by another contract at `tripBlock` (for example a wrapper, lending market, or pooled integration), that contract receives claim rights in v1. The vault does not infer beneficial ownership across external integrations.

## Trust boundaries

- Guardian/emergency roles may trip impairment to protect users.
- Trip/finalize cannot assign discretionary impaired NAV to the clean book.
- Recovery distribution is constrained to epoch claims and realized inflows.

## Settlement and flow behavior

- During `Suspect` mode:
  - `deposit` / `mint` revert.
  - `withdraw` / `redeem` revert.
  - `maxDeposit` / `maxMint` / `maxWithdraw` / `maxRedeem` return `0`.
- Claims cannot mint before root finalization.
- Finalization cannot occur before challenge-window unlock.

## Claim and recovery caps (June 2026 audit remediation)

These guards were added in the June 2026 audit pass (C-2 / C-3 / H-1) and are
enforced on-chain by `CreatorOVaultCoreModule` and `CreatorORecoveryEscrow`:

- **Mint cap (C-2).** Cumulative claims minted for an epoch can never exceed
  the epoch's `totalClaimSupply`. A proposed root whose leaves sum past the
  cap reverts with `ClaimSupplyExceeded` once the cap is reached, instead of
  silently diluting honest claim holders.
- **Epoch-scoped escrow accounting (C-2).** `CreatorORecoveryEscrow` rejects
  any claim that would push `claimedByEpochAsset` past
  `recoveredByEpochAsset` for that epoch/asset (`ClaimExceedsRecovered`).
  One epoch's claims can never drain recoveries notified for another epoch.
- **False-alarm trips destroy the claim surface (C-3).** `clearImpairmentTrip`
  zeroes the epoch's `snapshotRoot`, `totalClaimSupply`, and `recoveryAsset`
  and resets the challenge-window state. Cleared epochs can never mint claims
  or receive recovery notifications (`ImpairmentRootRequired`). Legitimate
  post-finalize `Resolved` epochs keep their root and stay claimable.
- **Recovery notification guards (H-1).** `notifyImpairmentRecovery` reverts
  on zero amounts, and when the recovery asset is the creator coin the
  transfer goes through tracked-balance accounting so clean-book
  `totalAssets()` immediately reflects the escrowed outflow (no double
  counting between the vault book and the escrow).

## Release notes template text

Use the following text in release communication:

1. v1 introduces impairment epochs with trip-boundary snapshots and non-transferable claim rights.
2. clean-book ERC-4626 operations resume after impairment finalization.
3. realized recoveries are paid through epoch claims; recoveries are not merged back into clean NAV.
4. integrations holding vault shares at snapshot block receive contract-level claims unless claim-aware adapters are added.

