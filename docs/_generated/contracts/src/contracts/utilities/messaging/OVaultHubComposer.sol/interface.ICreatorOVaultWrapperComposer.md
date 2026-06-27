# ICreatorOVaultWrapperComposer
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/messaging/OVaultHubComposer.sol)


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

### isBeneficiaryOperator


```solidity
function isBeneficiaryOperator(address operator) external view returns (bool);
```

