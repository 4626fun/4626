# ICCAuction
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/services/bridge/SolanaBridgeAdapter.sol)

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

