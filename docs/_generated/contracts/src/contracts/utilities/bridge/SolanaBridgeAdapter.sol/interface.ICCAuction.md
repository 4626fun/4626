# ICCAuction
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

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

