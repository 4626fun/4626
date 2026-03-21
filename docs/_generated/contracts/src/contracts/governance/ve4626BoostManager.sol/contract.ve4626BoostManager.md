# ve4626BoostManager
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/governance/ve4626BoostManager.sol)

**Inherits:**
Ownable, ReentrancyGuard


## State Variables
### BOOST_PRECISION

```solidity
uint256 public constant BOOST_PRECISION = 10_000
```


### MAX_VE_BOOST

```solidity
uint256 public constant MAX_VE_BOOST = 25_000
```


### MIN_HOLDING_BLOCKS

```solidity
uint256 public constant MIN_HOLDING_BLOCKS = 10
```


### ve4626

```solidity
Ive4626 public immutable ve4626
```


### baseBoost

```solidity
uint256 public baseBoost = 10_000
```


### maxBoost

```solidity
uint256 public maxBoost = 25_000
```


### minVotingPower

```solidity
uint256 public minVotingPower = 0.1 ether
```


### boostParametersLocked

```solidity
bool public boostParametersLocked
```


### lastBalanceUpdateBlock

```solidity
mapping(address => uint256) public lastBalanceUpdateBlock
```


## Functions
### constructor


```solidity
constructor(address _ve4626, address _owner) Ownable(_owner);
```

### calculateBoost


```solidity
function calculateBoost(address user) public view returns (uint256);
```

### calculateBoostWithProtection


```solidity
function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier);
```

### getTotalProbabilityBoost


```solidity
function getTotalProbabilityBoost(address user) external view returns (uint256 totalBoostBps);
```

### getCoverageBps

Coverage is now purely based on held creator shares in USD

No ve lock matching, no per-creator lock required - one ve4626 lock only


```solidity
function getCoverageBps(
    address,
    /*user*/
    address,
    /*registry*/
    address,
    /*creatorCoin*/
    address,
    /*shareBalanceToken*/
    uint256 creatorShareBalanceUSD,
    uint256 swapAmountUSD
) external pure returns (uint256 coverageBps);
```

### updateBalanceTracking


```solidity
function updateBalanceTracking(address user) external;
```

### setBoostParameters


```solidity
function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner;
```

### setMinVotingPower


```solidity
function setMinVotingPower(uint256 _minPower) external onlyOwner;
```

### hasBoost


```solidity
function hasBoost(address user) external view returns (bool);
```

## Events
### BoostCalculated

```solidity
event BoostCalculated(address indexed user, uint256 boostMultiplier);
```

### BoostParametersUpdated

```solidity
event BoostParametersUpdated(uint256 baseBoost, uint256 maxBoost);
```

### MinVotingPowerUpdated

```solidity
event MinVotingPowerUpdated(uint256 minPower);
```

### BalanceTrackingUpdated

```solidity
event BalanceTrackingUpdated(address indexed user, uint256 blockNumber);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidBoostParameters

```solidity
error InvalidBoostParameters();
```

### BoostParametersAreLocked

```solidity
error BoostParametersAreLocked();
```

