# CharmAlphaVaultDeploy
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/vault/strategies/univ3/CharmAlphaVaultDeploy.sol)

**Inherits:**
[CharmAlphaVault](/contracts/vault/strategies/univ3/CharmAlphaVault.sol/contract.CharmAlphaVault.md)

**Title:**
CharmAlphaVaultDeploy

**Author:**
0xakita.eth

Deployment-oriented Charm Alpha Vault variant.

Used by AA deployment flows to bundle vault + rebalance logic.


## State Variables
### _initialized

```solidity
bool private _initialized
```


### baseThreshold

```solidity
int24 public baseThreshold
```


### limitThreshold

```solidity
int24 public limitThreshold
```


### maxTwapDeviation

```solidity
int24 public maxTwapDeviation
```


### twapDuration

```solidity
uint32 public twapDuration
```


### keeper

```solidity
address public keeper
```


### lastRebalance

```solidity
uint256 public lastRebalance
```


### lastTick

```solidity
int24 public lastTick
```


## Functions
### constructor


```solidity
constructor(
    address _pool,
    uint256 _protocolFee,
    uint256 _maxTotalSupply,
    string memory _name,
    string memory _symbol
) CharmAlphaVault(_pool, _protocolFee, _maxTotalSupply, _name, _symbol);
```

### initializeAndTransfer


```solidity
function initializeAndTransfer(
    address _newGovernance,
    address _newKeeper,
    int24 _baseThreshold,
    int24 _limitThreshold,
    int24 _maxTwapDeviation,
    uint32 _twapDuration
) external onlyGovernance;
```

### rebalance


```solidity
function rebalance() external;
```

### getTick


```solidity
function getTick() public view returns (int24 tick);
```

### getTwap


```solidity
function getTwap() public view returns (int24);
```

### _rebalanceInternal


```solidity
function _rebalanceInternal() internal;
```

### _floor


```solidity
function _floor(int24 tick) internal view returns (int24);
```

### _checkThreshold


```solidity
function _checkThreshold(int24 threshold, int24 _tickSpacing) internal pure;
```

### setKeeper


```solidity
function setKeeper(address _keeper) external onlyGovernance;
```

### setBaseThreshold


```solidity
function setBaseThreshold(int24 _baseThreshold) external onlyGovernance;
```

### setLimitThreshold


```solidity
function setLimitThreshold(int24 _limitThreshold) external onlyGovernance;
```

### setMaxTwapDeviation


```solidity
function setMaxTwapDeviation(int24 _maxTwapDeviation) external onlyGovernance;
```

### setTwapDuration


```solidity
function setTwapDuration(uint32 _twapDuration) external onlyGovernance;
```

## Events
### Rebalanced

```solidity
event Rebalanced(int24 tick, uint256 timestamp);
```

