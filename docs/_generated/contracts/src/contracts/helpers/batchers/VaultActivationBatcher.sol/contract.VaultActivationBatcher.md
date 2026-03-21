# VaultActivationBatcher
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/helpers/batchers/VaultActivationBatcher.sol)

**Inherits:**
ReentrancyGuard


## State Variables
### OP_ACTIVATE
Bitmask permission (must match `CreatorOVault.OP_ACTIVATE`)


```solidity
uint256 private constant OP_ACTIVATE = 1 << 2
```


### permit2
Permit2 contract used for signature-based transfers


```solidity
address public immutable permit2
```


## Functions
### constructor


```solidity
constructor(address _permit2) ;
```

### _executeActivateAndLaunch


```solidity
function _executeActivateAndLaunch(
    address identity,
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint8 creatorReservePercent,
    address creatorReserveRecipient,
    uint128 requiredRaise
) internal returns (address auction, uint256 auctionAmount, uint256 reserveAmount, address shareToken);
```

### batchActivate

Batch activate vault and launch auction in one transaction

User must approve this contract to spend depositAmount of creatorToken first


```solidity
function batchActivate(
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint128 requiredRaise
) external nonReentrant returns (address auction);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`creatorToken`|`address`|The creator token to deposit|
|`vault`|`address`|The vault contract|
|`wrapper`|`address`|The wrapper contract|
|`ccaStrategy`|`address`|The CCA strategy contract|
|`depositAmount`|`uint256`|Amount of creator tokens to deposit|
|`auctionPercent`|`uint8`|Percent of ■TOKEN to auction (0-100)|
|`requiredRaise`|`uint128`|Minimum ETH to raise in auction|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`auction`|`address`|The auction contract address|


### batchActivateWithReserve

Batch activate with an explicit creator/team reserve allocation.

`auctionPercent + creatorReservePercent` must be <= 100.
The remainder (if any) is returned to `msg.sender`.


```solidity
function batchActivateWithReserve(
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint8 creatorReservePercent,
    address creatorReserveRecipient,
    uint128 requiredRaise
) external nonReentrant returns (address auction);
```

### batchActivateWithPermit2For

Batch activate on behalf of a canonical identity wallet (identity-funded via Permit2).

Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
Remaining share tokens are always returned to `identity` (never `msg.sender`).


```solidity
function batchActivateWithPermit2For(
    address identity,
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint128 requiredRaise,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external nonReentrant returns (address auction);
```

### batchActivateWithPermit2ForWithReserve

Permit2 (identity-funded) activate with creator/team reserve allocation.

Remaining ■TOKENs are returned to `identity` (never msg.sender).


```solidity
function batchActivateWithPermit2ForWithReserve(
    address identity,
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint8 creatorReservePercent,
    address creatorReserveRecipient,
    uint128 requiredRaise,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external nonReentrant returns (address auction);
```

### batchActivateWithPermit2FromOperator

Batch activate on behalf of a canonical identity wallet (operator-funded via Permit2).

Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
Remaining share tokens are always returned to `identity` (never `msg.sender`).


```solidity
function batchActivateWithPermit2FromOperator(
    address identity,
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint128 requiredRaise,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external nonReentrant returns (address auction);
```

### batchActivateWithPermit2FromOperatorWithReserve

Permit2 (operator-funded) activate with creator/team reserve allocation.

Remaining ■TOKENs are returned to `identity` (never msg.sender).


```solidity
function batchActivateWithPermit2FromOperatorWithReserve(
    address identity,
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint8 creatorReservePercent,
    address creatorReserveRecipient,
    uint128 requiredRaise,
    ISignatureTransfer.PermitTransferFrom calldata permit,
    bytes calldata signature
) external nonReentrant returns (address auction);
```

## Events
### BatchActivation

```solidity
event BatchActivation(
    address indexed user, address indexed vault, uint256 depositAmount, uint256 auctionAmount, address auction
);
```

### BatchActivationFor

```solidity
event BatchActivationFor(
    address indexed operator,
    address indexed identity,
    address indexed vault,
    uint256 depositAmount,
    uint256 auctionAmount,
    address auction
);
```

### CreatorReserveAllocated
Emitted when a portion of ■TOKENs is reserved for creator/team (e.g. vesting escrow).


```solidity
event CreatorReserveAllocated(
    address indexed identity,
    address indexed recipient,
    address indexed shareToken,
    uint256 amount,
    uint8 reservePercent
);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### InvalidPercent

```solidity
error InvalidPercent();
```

### InvalidReserve

```solidity
error InvalidReserve();
```

### NotVaultOwner

```solidity
error NotVaultOwner(address expectedOwner, address actualOwner);
```

### NotAuthorizedOperator

```solidity
error NotAuthorizedOperator();
```

### PermitTokenMismatch

```solidity
error PermitTokenMismatch();
```

### PermitAmountTooLow

```solidity
error PermitAmountTooLow();
```

