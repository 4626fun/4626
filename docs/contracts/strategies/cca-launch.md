---
title: Share CCA Launch Arm
sidebar_position: 2
---

# Share CCA Launch Arm

**Product role:** **Vault arm** (not a leg / not `addStrategy`) that runs the **auction** selling tradable ■ ShareOFT for native ETH at a clearing price before secondary mesh liquidity.

Uniswap Continuous Clearing Auction (CCA) integration for price discovery on Uniswap V4. Onchain name: `CCALaunchArm` (legacy: `CCALaunchStrategy` / `ccaLaunchStrategy`).

Runs CCA price discovery with explicit lifecycle tracking, supports deterministic failed-auction finalization and relaunch safety, and on graduation `migrate()` initializes the ShareOFT/native-ETH V4 pool and wires the oracle — **no LP mint** at migrate (mesh arm handles liquidity later). Launch floor price is derived onchain from oracle data. Non-blocking backing telemetry keeps vault economics live during the auction.

## Auction Flow

On **finalize** (after the creator deposits creator coin and the batcher wraps into `■` ShareOFT), the batcher enforces a fixed **four-way split** of wrapped share supply. Constants: `DeploymentBatcher` / `DeploymentBatcherPhase2Module` (`AUCTION_PERCENT`, `VESTING_PERCENT`, `SOLANA_ALLOC_PERCENT`, `LP_RESERVE_PERCENT`).

```text
Creator deposits creator coin → wrapper mints ■ ShareOFT
   ↓
Batcher enforces 30/30/30/10 split (of wrapped ■ supply)
  - 30% CCA auction (pending launch)
  - 30% creator linear vesting (365 days)
  - 30% LayerZero bridge to Solana (part of finalize; same ■ ticker)
  - 10% LP reserve held on launch arm for post-auction mesh seeding
   ↓
Auction runs (30% auction leg + 10% LP reserve metadata)
   ↓
If graduated: sweepCurrency() → migrate() (pool init + oracle) → mesh arm (deploy LP manager → seedLpManager → seedRebalance)
   ↓
Hook config / alignment (separate step) before declaring launch complete
   ↓
If failed: finalizeFailedAuction() / sweepUnsoldTokens() clears launch arm state for relaunch
```

**Deposit bounds:** first activation deposit must be **50M–100M** creator coin (18 decimals). The split applies to **wrapped share tokens** minted from that deposit, not raw creator coin units 1:1.

## What finalize does **not** do

Phase 2 `finalizePhase2` (batcher) only wraps the deposit and enforces the **30/30/30/10** split. It does **not**:

| Deferred step | When it runs | Onchain surface |
|---------------|--------------|-----------------|
| **Charm / Ajna strategy TVL** | Deploy-session **Phase 3** (next UserOp after finalize) | `deployPhase3Strategies` + vault `deployToStrategies()` at **45% / 45% / 10% idle** |
| **CCA graduation / `migrate()`** | **After the auction runs and succeeds** | Keeper settlement: `sweepCurrency()` → `migrate()` on the launch arm |

Phase 4 `launchDeferredAuction` **schedules** the auction (30% leg + 10% LP reserve metadata) — it does not graduate or migrate. Public DEX trading starts only after graduation + migration succeed.

## Auction timing

The launch arm schedules auctions on the **next Thursday 00:00 UTC** weekly epoch (`CCALaunchArm._deriveScheduledStartBlock`). After Phase 2 finalize, the app typically calls **`launchDeferredAuction`** (Phase 4) with the 30% auction leg plus 10% LP reserve metadata.

| Phase | Meaning |
|-------|---------|
| **AuctionScheduled** | Auction created; bids not open until `startBlock` |
| **AuctionLive** | Bids accepted until `endBlock` |
| **Graduated** | `sweepCurrency()` → `migrate()` eligible after delays |
| **Failed** | `finalizeFailedAuction()` / `sweepUnsoldTokens()` clears state for relaunch |

**Charm 99/1 bootstrap (not CCA):** when the Charm strategy first seeds an empty LP, it targets ~**99% creator coin / 1% USDC** — this runs in **Phase 3**, separate from the auction.

## Key Functions

```solidity
function launchAuctionWithReserve(
  uint256 amount, uint256 lpReserveAmount, uint256 floorPrice,
  uint128 requiredRaise, bytes calldata auctionSteps
) external returns (address);  // floorPrice legacy/ignored; floor derived onchain

function getAuctionStatus() external view
  returns (address auction, bool isActive, bool isGraduated, uint256 clearingPrice, uint256 currencyRaised);

function getLifecycleStatus() external view returns (LifecycleStatus memory);
function previewLaunchPricing() external view
  returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
function migrate() external;
function finalizeFailedAuction() external;
```

## Launch Completion Caveat

`migrate()` performs pool initialization and LP position migration, but does not itself finalize hook `setTaxConfig`. Canonical launch completion requires sweep success, migrate success, and hook config active and aligned to the intended `tradeFeeCollector`.

## Launch pricing

Launch floor is derived onchain from the lane oracle via `IOracle4626` (`getAssetPrice`, `getEthPrice`), then converted to Q96. Configurable launch discount (`launchDiscountBps`) and tick spacing (`launchTickSpacingBps`). Stale/invalid oracle data reverts launch (`LaunchOracleStale`, `LaunchOracleInvalidPrice`). Frontend `computeMarketFloorQuote` is diagnostic only.

## Share Economics During Auction

Vault economics are **not frozen** during auctions. Strategy snapshots launch-time backing telemetry when configured with `backingVault`. API/UI expose drift fields (`assetsDelta`, `supplyDelta`) — warning-only, do not block settlement or migration.

Prev: [CreatorGaugeController](/contracts/governance/gauge-controller) · Next: [LotteryManager4626](/contracts/utilities/lottery-manager)
