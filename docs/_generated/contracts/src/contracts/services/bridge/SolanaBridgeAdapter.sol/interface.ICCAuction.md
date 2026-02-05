# ICCAuction
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/services/bridge/SolanaBridgeAdapter.sol)

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

