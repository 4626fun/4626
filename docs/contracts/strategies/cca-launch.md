---
title: CCA Launch Strategy
sidebar_position: 2
---

# CCA Launch Strategy

Uniswap Continuous Clearing Auction integration for fair launch price discovery.

## Purpose

The CCA Launch Strategy:
- Runs CCA price discovery with explicit lifecycle tracking.
- Supports deterministic failed-auction finalization and relaunch safety.
- Migrates graduated auctions into a Uniswap v4 LP position.
- Derives launch floor price onchain from oracle data (manipulation-resistant).
- Exposes non-blocking backing telemetry (vault economics stay live).

## Auction Flow

```
Creator deposits/wraps into ShareOFT
   ↓
Batcher enforces 40/40/20 split
  - 40% CCA auction
  - 40% creator vesting
  - 20% strategy LP reserve
   ↓
Auction runs
   ↓
If graduated: sweepCurrency() → migrate() (v4 LP migration primitive)
   ↓
Hook config/alignment step (separate) before declaring launch complete
   ↓
If failed: finalizeFailedAuction() / sweepUnsoldTokens() clears strategy state for relaunch
```

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
