# PositionKey
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/libraries/uniswapv3/PositionKey.sol)

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

