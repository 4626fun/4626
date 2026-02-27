---
title: Auction (CCA)
sidebar_position: 20
slug: /primitives/market/auction
---

# Auction (CCA)

4626 uses a Uniswap CCA-style auction as the default launch/distribution mechanism for a new vault.

At a high level:

- The vault mints share tokens (shareOFT)
- A portion of shares is sold via auction to discover a market-clearing price
- The resulting price becomes the initial market anchor for the vault/share pair

This is the **Market** primitive because it is where price discovery, liquidity formation, and launch-time attack surfaces concentrate.

## Why CCA

- **Fair distribution**: public price discovery instead of private allocations
- **Composable**: downstream integrations can assume a price-bearing pool exists
- **Auditable**: auction parameters and resulting clearing price are onchain facts

## Related docs

- [Distribution (Launch)](/compressions/distribution)
- [Tokenomics](/tokenomics)
- [CCA Launch Strategy Contract](/contracts/strategies/cca-launch)

