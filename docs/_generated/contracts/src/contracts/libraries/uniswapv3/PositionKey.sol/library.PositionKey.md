# PositionKey
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/libraries/uniswapv3/PositionKey.sol)

**Title:**
PositionKey

**Author:**
0xakita.eth

Helper for Uniswap v3 position key derivation.

Local implementation to avoid v3-periphery dependency.


## Functions
### compute


```solidity
function compute(address owner, int24 tickLower, int24 tickUpper) internal pure returns (bytes32);
```

