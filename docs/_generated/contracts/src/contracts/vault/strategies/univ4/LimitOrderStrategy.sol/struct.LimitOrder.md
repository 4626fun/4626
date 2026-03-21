# LimitOrder
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)


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

