# IContinuousClearingAuction
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/CCALaunchStrategy.sol)

**Title:**
IContinuousClearingAuction

Interface for individual CCA auctions


## Functions
### submitBid


```solidity
function submitBid(uint256 maxPrice, uint128 amount, address owner, uint256 prevTickPrice, bytes calldata hookData)
    external
    payable
    returns (uint256 bidId);
```

### checkpoint


```solidity
function checkpoint() external;
```

### exitBid


```solidity
function exitBid(uint256 bidId) external;
```

### claimTokens


```solidity
function claimTokens(uint256 bidId) external;
```

### isGraduated


```solidity
function isGraduated() external view returns (bool);
```

### sweepCurrency


```solidity
function sweepCurrency() external;
```

### sweepUnsoldTokens


```solidity
function sweepUnsoldTokens() external;
```

### clearingPrice


```solidity
function clearingPrice() external view returns (uint256);
```

### currencyRaised


```solidity
function currencyRaised() external view returns (uint256);
```

### totalSupply


```solidity
function totalSupply() external view returns (uint128);
```

### onTokensReceived


```solidity
function onTokensReceived() external;
```

### startBlock


```solidity
function startBlock() external view returns (uint64);
```

### endBlock


```solidity
function endBlock() external view returns (uint64);
```

### claimBlock


```solidity
function claimBlock() external view returns (uint64);
```

### sweepCurrencyBlock


```solidity
function sweepCurrencyBlock() external view returns (uint256);
```

### sweepUnsoldTokensBlock


```solidity
function sweepUnsoldTokensBlock() external view returns (uint256);
```

