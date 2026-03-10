# ICreatorOVaultWrapperComposer
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/utilities/messaging/OVaultHubComposer.sol)


## Functions
### creatorCoin


```solidity
function creatorCoin() external view returns (address);
```

### shareOFT


```solidity
function shareOFT() external view returns (address);
```

### deposit


```solidity
function deposit(uint256 amount, uint256 minOut) external returns (uint256 shareOFTOut);
```

### withdraw


```solidity
function withdraw(uint256 amount, uint256 minOut) external returns (uint256 creatorCoinOut);
```

