# ICreatorOVaultWrapperComposer
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/messaging/OVaultHubComposer.sol)


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

