# PositionKey
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/libraries/uniswapv3/PositionKey.sol)

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

