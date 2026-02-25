---
title: Four Compressions
sidebar_position: 1
slug: /compressions
---

# Four Compressions

CreatorVault is easiest to understand as a system that compresses distance:

- **Deployment**: many contracts and roles become one creator action.
- **Geography**: shares become portable without fragmenting semantics.
- **Distribution**: launch becomes price discovery, not private access.
- **Engagement**: trading creates a provable onchain game loop.

## Reading Path

1. [Deployment](/compressions/deployment)
2. [Geography (Multichain)](/compressions/geography)
3. [Distribution (Launch)](/compressions/distribution)
4. [Engagement (Game Loop)](/compressions/engagement)

## System Flow (High Level)

```mermaid
flowchart TD
  UserOrFan["User_or_Fan"] --> SmartAccount["SmartAccount_wallet"]
  SmartAccount --> DeployFlow["DeployFlow(OneClick)"]
  DeployFlow --> Vault["ERC4626_Vault"]
  Vault --> StrategyModule["Strategy_module"]
  Vault --> Wrapper["VaultWrapper"]
  Wrapper --> OFTShares["OFT_shares"]
  OFTShares --> OtherChains["Other_chains"]
  OFTShares --> CCA["CCA_auction"]
  CCA --> V4Pool["UniswapV4_pool"]
  V4Pool --> Fee["Trading_fee(6.9%)"]
  Fee --> LotteryPot["Lottery_pot"]
  LotteryPot --> VRF["Chainlink_VRF_draw"]
```

## Next Actions

- [Getting Started](/getting-started)
- [Architecture](/architecture)
- [Three Primitives](/primitives)

