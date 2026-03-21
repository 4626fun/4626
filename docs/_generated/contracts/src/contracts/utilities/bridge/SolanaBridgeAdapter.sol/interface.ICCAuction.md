# ICCAuction
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

**Title:**
ICCAuction

**Author:**
0xakita.eth

Interface for Continuous Clearing Auction


## Functions
### submitBid


```solidity
function submitBid(uint256 maxPrice, uint128 amount, address owner, uint256 prevTickPrice, bytes calldata hookData)
    external
    payable
    returns (uint256 bidId);
```

### claimTokens


```solidity
function claimTokens(uint256 bidId) external;
```

### exitBid


```solidity
function exitBid(uint256 bidId) external;
```

