# ICreatorOVaultWrapperComposer
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/utilities/messaging/OVaultHubComposer.sol)


## Functions
### creatorCoin


```solidity
function creatorCoin() external view returns (address);
```

### shareOFT


```solidity
function shareOFT() external view returns (address);
```

### depositFor


```solidity
function depositFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 shareOFTOut);
```

### withdrawFor


```solidity
function withdrawFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 creatorCoinOut);
```

