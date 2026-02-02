# IContinuousClearingAuction
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/vault/strategies/CCALaunchStrategy.sol)

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

