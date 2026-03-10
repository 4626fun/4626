# LimitOrder
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)


```solidity
struct LimitOrder {
int24 tickLower;
int24 tickUpper;
uint256 liquidity;
uint256 tokenId; // V4 position NFT
bool isBuyOrder; // true = support (below price), false = resistance (above price)
uint256 createdAt;
bool isActive;
}
```

