---
title: CCA Launch Strategy
sidebar_position: 2
---

# CCA Launch Strategy

**Product role:** Runs the **fair-launch auction** that sells vault shares for USDC at a clearing price before secondary trading — the vault’s public price-discovery step.

Uniswap Continuous Clearing Auction (CCA) integration for fair-launch price discovery on Uniswap V4.

## Purpose

The CCA Launch Strategy:
- Runs CCA price discovery with explicit lifecycle tracking.
- Supports deterministic failed-auction finalization and relaunch safety.
- Migrates graduated auctions into a Uniswap v4 LP position.
- Derives launch floor price onchain from oracle data (manipulation-resistant).
- Exposes non-blocking backing telemetry (vault economics stay live).

## Auction Flow

On **finalize** (after the creator deposits creator coin and the batcher wraps into `■` ShareOFT), the batcher enforces a fixed **four-way split** of wrapped share supply. Constants live on `DeploymentBatcher` / `DeploymentBatcherPhase2Module` (`AUCTION_PERCENT`, `VESTING_PERCENT`, `SOLANA_ALLOC_PERCENT`, `LP_RESERVE_PERCENT`).

```text
Creator deposits creator coin → wrapper mints ■ ShareOFT
   ↓
Batcher enforces 30/30/30/10 split (of wrapped ■ supply)
  - 30% fair-launch CCA auction (pending launch)
  - 30% creator linear vesting (365 days)
  - 30% LayerZero bridge to Solana (optional lane; same ■ ticker)
  - 10% LP reserve held on CCA strategy for post-auction migration
   ↓
Fair-launch auction runs (30% auction leg + 10% LP reserve metadata)
   ↓
If graduated: sweepCurrency() → migrate() (Uniswap v4 LP migration)
   ↓
Hook config / alignment (separate step) before declaring launch complete
   ↓
If failed: finalizeFailedAuction() / sweepUnsoldTokens() clears strategy state for relaunch
```

**Deposit bounds:** first activation deposit must be **50M–100M** creator coin (18 decimals). The split applies to **wrapped share tokens** minted from that deposit, not raw creator coin units 1:1.

## Auction timing

The CCA strategy schedules auctions on the **next Thursday 00:00 UTC** weekly epoch (`CCALaunchStrategy._deriveScheduledStartBlock`). After Phase 2 finalize, the app typically calls **`launchDeferredAuction`** (Phase 4) with the 30% auction leg plus 10% LP reserve metadata.

| Phase | Meaning |
|-------|---------|
| **AuctionScheduled** | Auction created; bids not open until `startBlock` |
| **AuctionLive** | Bids accepted until `endBlock` |
| **Graduated** | `sweepCurrency()` → `migrate()` eligible after delays |
| **Failed** | `finalizeFailedAuction()` / `sweepUnsoldTokens()` clears state for relaunch |

**Charm 99/1 bootstrap (not CCA):** when the Charm strategy first seeds an empty LP, it targets ~**99% creator coin / 1% USDC** — this runs in **Phase 3**, separate from the fair-launch auction.

## Key Functions

```solidity
// Launch auction with explicit LP reserve metadata.
// `floorPrice` is legacy/ignored; floor is derived onchain.
function launchAuctionWithReserve(
  uint256 amount,
  uint256 lpReserveAmount,
  uint256 floorPrice,
  uint128 requiredRaise,
  bytes calldata auctionSteps
) external returns (address);

// Legacy status (kept for compatibility).
function getAuctionStatus()
  external
  view
  returns (address auction, bool isActive, bool isGraduated, uint256 clearingPrice, uint256 currencyRaised);

// Rich lifecycle status for API/UI/keepers.
function getLifecycleStatus() external view returns (LifecycleStatus memory);

// Preview launch floor/tick from oracle data.
function previewLaunchPricing()
  external
  view
  returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);

// Trigger v4 LP migration after graduation/sweep readiness.
function migrate() external;

// Finalize failed auctions and unblock future launches.
function finalizeFailedAuction() external;
```

## Migration Parameters

- `positionManager`: v4 position minter used for LP creation.
- `positionRecipient`: recipient of the minted LP position.
- `operator`: residual sweep operator after `sweepBlock`.
- `migrationDelayBlocks`: delay from auction end to migration eligibility.
- `sweepDelayBlocks`: delay from claim readiness to residual sweeps.

## Launch Completion Caveat

- `migrate()` performs pool initialization and LP position migration, but does not itself finalize hook `setTaxConfig`.
- Canonical launch completion should require:
  - sweep success,
  - migrate success,
  - hook config active and aligned to the intended `tradeFeeCollector`.

## Launch Pricing (Hard Onchain)

- Launch floor is derived onchain from `CreatorOracle` (`getCreatorPrice` and `getEthPrice`), then converted to Q96.
- Strategy applies a configurable launch discount (`launchDiscountBps`) and aligns floor to configurable spacing (`launchTickSpacingBps`).
- Stale/invalid oracle data reverts launch (`LaunchOracleStale`, `LaunchOracleInvalidPrice`), so launch cannot proceed on unsafe pricing.
- Frontend `computeMarketFloorQuote` is diagnostic/reference only and no longer trusted as an authoritative launch input.

## Share Economics During Auction

- Vault economics are intentionally **not frozen** during auctions.
- Strategy snapshots launch-time backing telemetry (`totalAssets`, `totalSupply`) when configured with `backingVault`.
- API/UI expose drift fields for transparency (`assetsDelta`, `supplyDelta`), but these are warning-only and do not block settlement or migration.
