# LimitOrder
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)


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

