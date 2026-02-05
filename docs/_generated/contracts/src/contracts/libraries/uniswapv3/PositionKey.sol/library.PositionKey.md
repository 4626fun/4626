# PositionKey
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/libraries/uniswapv3/PositionKey.sol)

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

