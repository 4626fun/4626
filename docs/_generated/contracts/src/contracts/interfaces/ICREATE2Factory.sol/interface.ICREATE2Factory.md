# ICREATE2Factory
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/ICREATE2Factory.sol)

**Title:**
ICREATE2Factory

**Author:**
0xakita.eth

Interface for a CREATE2 factory with access control.

Used by deployment helpers to deterministically deploy contracts.


## Functions
### deploy

Deploy a contract using CREATE2


```solidity
function deploy(bytes32 salt, bytes memory bytecode) external returns (address addr);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`salt`|`bytes32`|Deterministic salt for address generation|
|`bytecode`|`bytes`|Contract bytecode including constructor parameters|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`addr`|`address`|Address of the deployed contract|


### computeAddress

Compute the address of a contract before deployment


```solidity
function computeAddress(bytes32 salt, bytes32 bytecodeHash) external view returns (address addr);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`salt`|`bytes32`|Deterministic salt|
|`bytecodeHash`|`bytes32`|Keccak256 hash of the bytecode|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`addr`|`address`|Predicted address of the contract|


### isAuthorized

Check if an address is authorized to deploy


```solidity
function isAuthorized(address deployer) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`deployer`|`address`|Address to check|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if authorized|


### owner

Get the owner of the factory


```solidity
function owner() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|Owner address|


