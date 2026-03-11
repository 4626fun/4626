# OVaultHubComposer
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/utilities/messaging/OVaultHubComposer.sol)

**Inherits:**
ILayerZeroComposer, [ICreatorOVaultComposer](/contracts/interfaces/ovault/ICreatorOVaultComposer.sol/interface.ICreatorOVaultComposer.md), Ownable, ReentrancyGuard

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


### creatorMeshes

```solidity
mapping(address => CreatorMesh) internal creatorMeshes
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

### configureCreatorMesh


```solidity
function configureCreatorMesh(
    address creatorToken,
    address vault,
    address assetMeshToken,
    address shareMeshToken,
    uint32 solanaEid,
    bytes32 solanaAssetPeer,
    bytes32 solanaSharePeer
) external override onlyOwner;
```

### pauseCreatorMesh


```solidity
function pauseCreatorMesh(address creatorToken, bool paused) external override onlyOwner;
```

### creatorMesh


```solidity
function creatorMesh(address creatorToken)
    external
    view
    override
    returns (
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer,
        bool paused
    );
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

### _enforceMeshInvariants


```solidity
function _enforceMeshInvariants(
    uint8 action,
    address creatorToken,
    address sourceOft,
    uint32 srcEid,
    bytes32 composeFrom
) internal view;
```

## Events
### ComposeSenderAllowed

```solidity
event ComposeSenderAllowed(address indexed sender, bool allowed);
```

### CreatorMeshConfigured

```solidity
event CreatorMeshConfigured(
    address indexed creatorToken,
    address indexed vault,
    address assetMeshToken,
    address shareMeshToken,
    uint32 solanaEid,
    bytes32 solanaAssetPeer,
    bytes32 solanaSharePeer
);
```

### CreatorMeshPaused

```solidity
event CreatorMeshPaused(address indexed creatorToken, bool paused);
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

### CreatorMeshPausedError

```solidity
error CreatorMeshPausedError(address creatorToken);
```

### CreatorMeshVaultMismatch

```solidity
error CreatorMeshVaultMismatch(address expected, address actual);
```

### CreatorMeshAssetTokenMismatch

```solidity
error CreatorMeshAssetTokenMismatch(address expected, address actual);
```

### CreatorMeshShareTokenMismatch

```solidity
error CreatorMeshShareTokenMismatch(address expected, address actual);
```

### CreatorMeshSrcEidMismatch

```solidity
error CreatorMeshSrcEidMismatch(uint32 expected, uint32 actual);
```

### CreatorMeshPeerMismatch

```solidity
error CreatorMeshPeerMismatch(bytes32 expected, bytes32 actual);
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

## Structs
### CreatorMesh

```solidity
struct CreatorMesh {
    address vault;
    address assetMeshToken;
    address shareMeshToken;
    uint32 solanaEid;
    bytes32 solanaAssetPeer;
    bytes32 solanaSharePeer;
    bool paused;
}
```

