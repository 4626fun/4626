# LimitOrder
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)


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

