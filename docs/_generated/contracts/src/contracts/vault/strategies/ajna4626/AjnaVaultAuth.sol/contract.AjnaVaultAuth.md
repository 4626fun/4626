# AjnaVaultAuth
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/ajna4626/AjnaVaultAuth.sol)

**Title:**
AjnaVaultAuth

Policy hub for the inner Ajna ERC-4626 vault.

Keeps the role and configuration surface separate from the vault so the
outer CreatorOVault integration can swap operators without redeploying
strategy logic.


## State Variables
### MAX_AJNA_BUCKET_INDEX

```solidity
uint256 internal constant MAX_AJNA_BUCKET_INDEX = 7_388
```


### admin

```solidity
address public admin
```


### pendingAdmin

```solidity
address public pendingAdmin
```


### swapper

```solidity
address public swapper
```


### keepers

```solidity
mapping(address => bool) public keepers
```


### paused

```solidity
bool public paused
```


### depositCap

```solidity
uint256 public depositCap
```


### bufferRatio

```solidity
uint256 public bufferRatio
```


### toll

```solidity
uint256 public toll
```


### tax

```solidity
uint256 public tax
```


### minBucketIndex

```solidity
uint256 public minBucketIndex
```


## Functions
### onlyAdmin


```solidity
modifier onlyAdmin() ;
```

### constructor


```solidity
constructor(address initialAdmin) ;
```

### isAdmin


```solidity
function isAdmin(address account) external view returns (bool);
```

### isSwapper


```solidity
function isSwapper(address account) external view returns (bool);
```

### isKeeper


```solidity
function isKeeper(address account) external view returns (bool);
```

### isAdminOrKeeper


```solidity
function isAdminOrKeeper(address account) external view returns (bool);
```

### isAdminOrSwapper


```solidity
function isAdminOrSwapper(address account) external view returns (bool);
```

### transferAdmin


```solidity
function transferAdmin(address nextAdmin) external onlyAdmin;
```

### acceptAdmin


```solidity
function acceptAdmin() external;
```

### setSwapper


```solidity
function setSwapper(address nextSwapper) external onlyAdmin;
```

### setKeeper


```solidity
function setKeeper(address keeper, bool isKeeper_) external onlyAdmin;
```

### pause


```solidity
function pause() external onlyAdmin;
```

### unpause


```solidity
function unpause() external onlyAdmin;
```

### setDepositCap


```solidity
function setDepositCap(uint256 nextDepositCap) external onlyAdmin;
```

### setBufferRatio


```solidity
function setBufferRatio(uint256 nextBufferRatio) external onlyAdmin;
```

### setToll


```solidity
function setToll(uint256 nextToll) external onlyAdmin;
```

### setTax


```solidity
function setTax(uint256 nextTax) external onlyAdmin;
```

### setMinBucketIndex


```solidity
function setMinBucketIndex(uint256 nextMinBucketIndex) external onlyAdmin;
```

### retrieveFees

Withdraw accumulated fee tokens to admin.

FIX: F-20 — accepts any ERC-20 token to handle multi-token fee scenarios.
CAUTION: admin must ensure `token` is a fee token, not vault collateral.
Only callable by admin; tokens always sent to the current admin address.


```solidity
function retrieveFees(address token, uint256 amount) external onlyAdmin;
```

## Events
### AdminSet

```solidity
event AdminSet(address indexed admin);
```

### AdminTransferStarted

```solidity
event AdminTransferStarted(address indexed currentAdmin, address indexed pendingAdmin);
```

### SwapperSet

```solidity
event SwapperSet(address indexed swapper);
```

### KeeperSet

```solidity
event KeeperSet(address indexed keeper, bool isKeeper);
```

### Paused

```solidity
event Paused();
```

### Unpaused

```solidity
event Unpaused();
```

### DepositCapSet

```solidity
event DepositCapSet(uint256 depositCap);
```

### BufferRatioSet

```solidity
event BufferRatioSet(uint256 bufferRatioBps);
```

### TollSet

```solidity
event TollSet(uint256 tollBps);
```

### TaxSet

```solidity
event TaxSet(uint256 taxBps);
```

### MinBucketIndexSet

```solidity
event MinBucketIndexSet(uint256 minBucketIndex);
```

## Errors
### NotAuthorized

```solidity
error NotAuthorized();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### FeeTooHigh

```solidity
error FeeTooHigh();
```

### BufferRatioTooHigh

```solidity
error BufferRatioTooHigh();
```

### InvalidMinBucketIndex

```solidity
error InvalidMinBucketIndex();
```

### NotPendingAdmin

```solidity
error NotPendingAdmin();
```

