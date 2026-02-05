# ICrossChainERC20Factory
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/services/bridge/interfaces/ICrossChainERC20Factory.sol)

Minimal interface for Base's CrossChainERC20Factory used by the Base↔Solana bridge.
Factory address (Base mainnet): 0xDD56781d0509650f8C2981231B6C917f2d5d7dF2


## Functions
### BEACON


```solidity
function BEACON() external view returns (address);
```

### isCrossChainErc20


```solidity
function isCrossChainErc20(address token) external view returns (bool);
```

### deploy


```solidity
function deploy(bytes32 remoteToken, string calldata name, string calldata symbol, uint8 decimals)
    external
    returns (address);
```

