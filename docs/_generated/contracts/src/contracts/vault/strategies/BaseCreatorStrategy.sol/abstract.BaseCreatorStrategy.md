# BaseCreatorStrategy
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/vault/strategies/BaseCreatorStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), Ownable, ReentrancyGuard

**Title:**
BaseCreatorStrategy

**Author:**
0xakita.eth (CreatorVault)

Base strategy contract for CreatorOVault yield strategies

SINGLE-TOKEN PATTERN:
- Each strategy manages one token (the Creator Coin)
- Compatible with the IStrategy interface
- Inherit this contract and implement _deployFunds() and _freeFunds()

ARCHITECTURE:
CreatorOVault → BaseCreatorStrategy → [CharmStrategy, AaveStrategy, etc.]
└──> External yield protocols

REQUIRED OVERRIDES:
- _deployFunds(amount) - Deploy funds to yield source
- _freeFunds(amount) - Withdraw from yield source
- _totalDeployed() - Get total value in yield source
- _harvest() - Collect yields


## State Variables
### ASSET
The underlying token this strategy manages


```solidity
IERC20 public immutable ASSET
```


### vault
The vault this strategy serves


```solidity
address public vault
```


### strategyName
Strategy metadata


```solidity
string public strategyName
```


### isActive_
Strategy state


```solidity
bool public isActive_
```


### isEmergencyMode

```solidity
bool public isEmergencyMode
```


### totalDeposited
Accounting


```solidity
uint256 public totalDeposited
```


### totalWithdrawn

```solidity
uint256 public totalWithdrawn
```


### totalHarvested

```solidity
uint256 public totalHarvested
```


### lastHarvest
Performance


```solidity
uint256 public lastHarvest
```


### lastDeposit

```solidity
uint256 public lastDeposit
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### whenNotEmergency


```solidity
modifier whenNotEmergency() ;
```

### constructor

Initialize the strategy


```solidity
constructor(address _asset, address _vault, string memory _name, address _owner) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_asset`|`address`|The token this strategy manages (Creator Coin)|
|`_vault`|`address`|The CreatorOVault address|
|`_name`|`string`|Strategy name for identification|
|`_owner`|`address`|Owner address|


### isActive

Check if strategy is active


```solidity
function isActive() external view override returns (bool);
```

### asset

Get the underlying asset


```solidity
function asset() external view override returns (address);
```

### getTotalAssets

Get total assets managed by this strategy


```solidity
function getTotalAssets() external view override returns (uint256);
```

### deposit

Deposit tokens into the strategy


```solidity
function deposit(uint256 amount)
    external
    override
    nonReentrant
    onlyVault
    whenActive
    whenNotEmergency
    returns (uint256 deposited);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount to deposit|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`deposited`|`uint256`|Actual amount deposited|


### withdraw

Withdraw tokens from the strategy


```solidity
function withdraw(uint256 amount) external override nonReentrant onlyVault returns (uint256 withdrawn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount to withdraw|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`withdrawn`|`uint256`|Actual amount withdrawn|


### emergencyWithdraw

Emergency withdraw all funds


```solidity
function emergencyWithdraw() external override nonReentrant onlyVault returns (uint256 withdrawn);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`withdrawn`|`uint256`|Total amount withdrawn|


### harvest

Harvest yields from the strategy


```solidity
function harvest() external override nonReentrant onlyVault whenActive whenNotEmergency returns (uint256 profit);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`profit`|`uint256`|Amount harvested|


### rebalance

Rebalance strategy position


```solidity
function rebalance() external override nonReentrant onlyVault whenActive whenNotEmergency;
```

### _deployFunds

Deploy funds to yield source

Override in child contract


```solidity
function _deployFunds(uint256 amount) internal virtual returns (uint256 deployed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount to deploy|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`deployed`|`uint256`|Actual amount deployed|


### _freeFunds

Free funds from yield source

Override in child contract


```solidity
function _freeFunds(uint256 amount) internal virtual returns (uint256 freed);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount to free|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`freed`|`uint256`|Actual amount freed|


### _totalDeployed

Get total value deployed to yield source

Override in child contract


```solidity
function _totalDeployed() internal view virtual returns (uint256);
```

### _harvest

Harvest yields

Override in child contract


```solidity
function _harvest() internal virtual returns (uint256 profit);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`profit`|`uint256`|Amount of profit harvested|


### _rebalance

Rebalance position (optional)

Override if needed, default does nothing


```solidity
function _rebalance() internal virtual;
```

### setVault

Set new vault address


```solidity
function setVault(address _vault) external onlyOwner;
```

### activate

Activate strategy


```solidity
function activate() external onlyOwner;
```

### deactivate

Deactivate strategy


```solidity
function deactivate() external onlyOwner;
```

### enableEmergencyMode

Enable emergency mode


```solidity
function enableEmergencyMode() external onlyOwner;
```

### disableEmergencyMode

Disable emergency mode


```solidity
function disableEmergencyMode() external onlyOwner;
```

### rescueToken

Rescue stuck tokens (not the main asset)


```solidity
function rescueToken(address token, uint256 amount, address to) external onlyOwner;
```

### getStats

Get strategy statistics


```solidity
function getStats()
    external
    view
    returns (
        uint256 _totalDeposited,
        uint256 _totalWithdrawn,
        uint256 _totalHarvested,
        uint256 _lastHarvest,
        uint256 _lastDeposit,
        uint256 _currentBalance,
        uint256 _deployedBalance
    );
```

### localBalance

Get local token balance


```solidity
function localBalance() external view returns (uint256);
```

### deployedBalance

Get deployed balance


```solidity
function deployedBalance() external view returns (uint256);
```

## Events
### VaultSet

```solidity
event VaultSet(address indexed vault);
```

### StrategyActivated

```solidity
event StrategyActivated();
```

### StrategyDeactivated

```solidity
event StrategyDeactivated();
```

### EmergencyModeEnabled

```solidity
event EmergencyModeEnabled();
```

### EmergencyModeDisabled

```solidity
event EmergencyModeDisabled();
```

## Errors
### NotVault

```solidity
error NotVault();
```

### NotActive

```solidity
error NotActive();
```

### EmergencyMode

```solidity
error EmergencyMode();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

