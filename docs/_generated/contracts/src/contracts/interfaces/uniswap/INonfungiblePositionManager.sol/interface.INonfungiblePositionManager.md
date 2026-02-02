# INonfungiblePositionManager
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/interfaces/uniswap/INonfungiblePositionManager.sol)

**Title:**
INonfungiblePositionManager

**Author:**
Uniswap Labs

Interface for Uniswap V3 position manager minting.

Used by LP strategy deployments.


## Functions
### mint


```solidity
function mint(MintParams calldata params)
    external
    payable
    returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
```

## Structs
### MintParams

```solidity
struct MintParams {
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
}
```

