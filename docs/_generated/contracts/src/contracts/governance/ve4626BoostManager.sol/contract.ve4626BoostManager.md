# ve4626BoostManager
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/governance/ve4626BoostManager.sol)

**Inherits:**
Ownable, ReentrancyGuard


## State Variables
### BOOST_PRECISION
Precision for boost calculations (10000 = 100%)


```solidity
uint256 public constant BOOST_PRECISION = 10000
```


### MAX_VE_BOOST
Maximum boost for ve4626 lockers (2.5x)


```solidity
uint256 public constant MAX_VE_BOOST = 25000
```


### MIN_HOLDING_BLOCKS
Minimum holding blocks for flash loan protection


```solidity
uint256 public constant MIN_HOLDING_BLOCKS = 10
```


### ve4626
ve4626 token


```solidity
Ive4626 public immutable ve4626
```


### gaugeController
GaugeController (optional, for probability boost)


```solidity
ICreatorGaugeController public gaugeController
```


### baseBoost
Base boost (1.0x = 10000 bps)


```solidity
uint256 public baseBoost = 10000
```


### maxBoost
Max boost (2.5x = 25000 bps)


```solidity
uint256 public maxBoost = 25000
```


### minVotingPower
Minimum ve4626 to participate


```solidity
uint256 public minVotingPower = 0.1 ether
```


### lastBalanceUpdateBlock
Flash loan protection: last balance update block


```solidity
mapping(address => uint256) public lastBalanceUpdateBlock
```


### boostParametersLocked
Boost parameters locked after first set


```solidity
bool public boostParametersLocked
```


## Functions
### constructor


```solidity
constructor(address _ve4626, address _owner) Ownable(_owner);
```

### calculateBoost


```solidity
function calculateBoost(address user) public view returns (uint256 boostMultiplier);
```

### calculateBoostWithProtection


```solidity
function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier);
```

### getBoostWithEvent


```solidity
function getBoostWithEvent(address user) external returns (uint256 boostMultiplier);
```

### getTotalProbabilityBoost


```solidity
function getTotalProbabilityBoost(address user) external view returns (uint256 totalBoostBps);
```

### previewBoost


```solidity
function previewBoost(address user)
    external
    view
    returns (uint256 multiplier, bool hasLock, uint256 lockTimeRemaining);
```

### getBoostInfo


```solidity
function getBoostInfo(address user)
    external
    view
    returns (
        uint256 boostMultiplier,
        uint256 userVotingPower,
        uint256 totalVotingPower,
        uint256 userShareBps,
        bool isProtected
    );
```

### updateBalanceTracking


```solidity
function updateBalanceTracking(address user) external;
```

### setBoostParameters


```solidity
function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner;
```

### setGaugeController


```solidity
function setGaugeController(address _controller) external onlyOwner;
```

### setMinVotingPower


```solidity
function setMinVotingPower(uint256 _minPower) external onlyOwner;
```

### hasBoost


```solidity
function hasBoost(address user) external view returns (bool);
```

### getBoostPercentage


```solidity
function getBoostPercentage(address user) external view returns (uint256);
```

### getMaxBoost


```solidity
function getMaxBoost() external view returns (uint256);
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

### GaugeControllerUpdated

```solidity
event GaugeControllerUpdated(address indexed controller);
```

### MinVotingPowerUpdated

```solidity
event MinVotingPowerUpdated(uint256 minPower);
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

