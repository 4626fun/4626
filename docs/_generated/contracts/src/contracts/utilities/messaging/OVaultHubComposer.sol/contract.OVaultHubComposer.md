# OVaultHubComposer
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/utilities/messaging/OVaultHubComposer.sol)

**Inherits:**
ILayerZeroComposer, Ownable, ReentrancyGuard

**Title:**
OVaultHubComposer

Base-side LayerZero compose receiver for cross-chain deposit/redeem intents.

The destination OFT credits tokens to this contract first, then EndpointV2 calls
`lzCompose`. This contract executes wrapper deposit/withdraw and enforces strict
balance-delta invariants so a compose packet can never spend or mint more than
the packet-provided OFT amount.


## State Variables
### ACTION_DEPOSIT

```solidity
uint8 public constant ACTION_DEPOSIT = 1
```


### ACTION_REDEEM

```solidity
uint8 public constant ACTION_REDEEM = 2
```


### registry

```solidity
ICreatorRegistry public immutable registry
```


### endpoint

```solidity
address public immutable endpoint
```


### allowedComposeSenders

```solidity
mapping(address => bool) public allowedComposeSenders
```


## Functions
### constructor


```solidity
constructor(address _registry, address _owner) Ownable(_owner);
```

### setAllowedComposeSender


```solidity
function setAllowedComposeSender(address sender, bool allowed) external onlyOwner;
```

### lzCompose


```solidity
function lzCompose(
    address _from,
    bytes32 _guid,
    bytes calldata _message,
    address _executor,
    bytes calldata _extraData
) external payable override nonReentrant;
```

### _composeDeposit


```solidity
function _composeDeposit(
    address creatorToken,
    address shareOft,
    address wrapper,
    address receiver,
    uint256 amountIn,
    uint256 minSharesOut
) internal returns (uint256 sharesOut);
```

### _composeRedeem


```solidity
function _composeRedeem(
    address creatorToken,
    address shareOft,
    address wrapper,
    address receiver,
    uint256 amountIn,
    uint256 minAssetsOut
) internal returns (uint256 assetsOut);
```

### _validateCreatorBindings


```solidity
function _validateCreatorBindings(address creatorToken, address wrapper) internal view returns (address shareOft);
```

## Events
### ComposeSenderAllowed

```solidity
event ComposeSenderAllowed(address indexed sender, bool allowed);
```

### DepositComposed

```solidity
event DepositComposed(
    bytes32 indexed guid,
    address indexed sourceOft,
    address indexed receiver,
    address creatorToken,
    address wrapper,
    uint256 assetsIn,
    uint256 sharesOut,
    uint32 srcEid,
    address composeFrom
);
```

### RedeemComposed

```solidity
event RedeemComposed(
    bytes32 indexed guid,
    address indexed sourceOft,
    address indexed receiver,
    address creatorToken,
    address wrapper,
    uint256 sharesIn,
    uint256 assetsOut,
    uint32 srcEid,
    address composeFrom
);
```

## Errors
### OnlyEndpoint

```solidity
error OnlyEndpoint();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### SenderNotAllowed

```solidity
error SenderNotAllowed(address sender);
```

### UnknownAction

```solidity
error UnknownAction(uint8 action);
```

### SourceOftMismatch

```solidity
error SourceOftMismatch(address expected, address actual);
```

### CanonicalShareOftMismatch

```solidity
error CanonicalShareOftMismatch(address expected, address actual);
```

### WrapperMismatch

```solidity
error WrapperMismatch(address expected, address actual);
```

### WrapperCreatorTokenMismatch

```solidity
error WrapperCreatorTokenMismatch(address expected, address actual);
```

### WrapperShareOftMismatch

```solidity
error WrapperShareOftMismatch(address expected, address actual);
```

### InsufficientComposerBalance

```solidity
error InsufficientComposerBalance(address token, uint256 available, uint256 requiredAmount);
```

### InputSpendInvariantFailed

```solidity
error InputSpendInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedSpend);
```

### OutputMintInvariantFailed

```solidity
error OutputMintInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedMint);
```

### ResidualBalanceInvariantFailed

```solidity
error ResidualBalanceInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance);
```

