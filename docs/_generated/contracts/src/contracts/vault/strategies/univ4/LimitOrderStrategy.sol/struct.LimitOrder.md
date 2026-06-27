# LimitOrder
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)


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

