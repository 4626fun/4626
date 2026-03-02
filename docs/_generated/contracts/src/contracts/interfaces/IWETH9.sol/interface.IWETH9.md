# IWETH9
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/interfaces/IWETH9.sol)

**Inherits:**
IERC20

**Title:**
IWETH9

**Author:**
WETH9

Interface for Wrapped Ether (WETH9).

Used by swap and LP tooling.


## Functions
### deposit

Deposit ETH to get WETH


```solidity
function deposit() external payable;
```

### withdraw

Withdraw WETH to get ETH


```solidity
function withdraw(uint256 amount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of WETH to withdraw|


