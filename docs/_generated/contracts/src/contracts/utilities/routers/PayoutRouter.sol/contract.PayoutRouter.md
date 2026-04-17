# PayoutRouter
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/routers/PayoutRouter.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
PayoutRouter

**Author:**
0xakita.eth

Receives external revenue and routes value into the vault via an enforceable burn stream.

Design goals:
- Safe CreatorCoin payoutRecipient path: never reverts on ERC20 transfers (no hooks needed).
- Can accept ETH: wraps to WETH (kept until processed).
- Converts payout tokens → creator coin via Uniswap V3 (exactInput path), deposits into the vault,
and queues the minted vault shares into a burn stream (dripped/burned over time).
- Owner/keeper-gated processing to prevent griefing via bad swap params.

Notes:
- The burn stream MUST be configured on the vault (one-time) so it can burn its own shares.
- Vault shares minted to the burn stream are not withdrawable (no owner escape hatch), satisfying
"not trust me bro" enforceability.


## State Variables
### creatorCoin

```solidity
IERC20 public immutable creatorCoin
```


### vault

```solidity
address public immutable vault
```


### burnStream

```solidity
address public immutable burnStream
```


### swapRouter

```solidity
address public immutable swapRouter
```


### weth

```solidity
address public immutable weth
```


### PROTOCOL_REWARDS

```solidity
address public constant PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B
```


### keeper
Optional keeper (bot/operator) allowed to process swaps.


```solidity
address public keeper
```


### swapDeadlineBuffer

```solidity
uint256 public swapDeadlineBuffer = 15 minutes
```


### swapPathToCreator
tokenIn => Uniswap V3 encoded path ending in `creatorCoin`.

Path encoding: tokenIn (20) + fee (3) + tokenMid (20) [+ fee (3) + tokenOut (20) ...]


```solidity
mapping(address => bytes) public swapPathToCreator
```


### approvedExternalSwapTargets
Optional allowlist of external swap executors (e.g. universal routers).


```solidity
mapping(address => bool) public approvedExternalSwapTargets
```


### approvedExternalSwapSpenders
Optional allowlist of spenders approved for tokenIn transferFrom.


```solidity
mapping(address => bool) public approvedExternalSwapSpenders
```


## Functions
### onlyOwnerOrKeeper


```solidity
modifier onlyOwnerOrKeeper() ;
```

### constructor


```solidity
constructor(
    address _creatorCoin,
    address _vault,
    address _burnStream,
    address _owner,
    address _swapRouter,
    address _weth
) Ownable(_owner);
```

### receive


```solidity
receive() external payable;
```

### setKeeper


```solidity
function setKeeper(address newKeeper) external onlyOwner;
```

### removeKeeper


```solidity
function removeKeeper() external onlyOwner;
```

### setSwapDeadlineBuffer


```solidity
function setSwapDeadlineBuffer(uint256 _buffer) external onlyOwner;
```

### setSwapPath

Set the Uniswap V3 swap path for a payout token.

This also pre-approves the router to spend tokenIn.


```solidity
function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner;
```

### setExternalSwapTargetApproval

Approve or revoke an external swap execution target.


```solidity
function setExternalSwapTargetApproval(address target, bool approved) external onlyOwner;
```

### setExternalSwapSpenderApproval

Approve or revoke an external swap spender (token allowance receiver).


```solidity
function setExternalSwapSpenderApproval(address spender, bool approved) external onlyOwner;
```

### convertAndQueue

Convert external-revenue token into creatorCoin and inject into the vault (PPS-only).


```solidity
function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
    external
    nonReentrant
    onlyOwnerOrKeeper
    returns (uint256 creatorOut, uint256 sharesQueued);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokenIn`|`address`|Payout token to convert (e.g. USDC, WETH, ZORA). Use creatorCoin to inject directly.|
|`amountIn`|`uint256`|Amount of tokenIn to convert/inject (must already be held by this router).|
|`minCreatorOut`|`uint256`|Minimum creatorCoin received from swap (slippage guard). Ignored when tokenIn==creatorCoin.|


### convertViaExternalAndQueue

Convert via allowlisted external swap target, then queue creatorCoin into the vault.

This is intended for aggregated routing flows (e.g. offchain quote + encoded calldata).


```solidity
function convertViaExternalAndQueue(ExternalSwapParams calldata params)
    external
    nonReentrant
    onlyOwnerOrKeeper
    returns (uint256 creatorOut, uint256 sharesQueued);
```

### processBatch

Structured batch processing for swap/deposit actions in one transaction.

kind=0 => convertAndQueue path; kind=1 => external swap path.


```solidity
function processBatch(BatchAction[] calldata actions)
    external
    nonReentrant
    onlyOwnerOrKeeper
    returns (uint256 totalCreatorOut, uint256 totalSharesQueued);
```

### emergencyWithdraw

Emergency withdraw any token (including payouts) to a safe address.

Intended for safety; does not attempt to preserve PPS semantics.
FIX: PR-06 — NOTE: This is an intentional admin override that bypasses enforceability.
It can drain WETH/creatorCoin held for pending processing. Use only for genuine emergencies.


```solidity
function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant;
```

### protocolRewardsClaimable

Return claimable protocol rewards assigned to this router.


```solidity
function protocolRewardsClaimable() external view returns (uint256);
```

### claimProtocolRewards

Claim an explicit amount of protocol rewards into this router.

Claimed ETH is wrapped to WETH by `receive()`.


```solidity
function claimProtocolRewards(uint256 amount) external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed);
```

### claimAllProtocolRewards

Claim all currently claimable protocol rewards into this router.

Claimed ETH is wrapped to WETH by `receive()`.


```solidity
function claimAllProtocolRewards() external onlyOwnerOrKeeper nonReentrant returns (uint256 claimed);
```

### _convertAndQueueViaV3OrDirect


```solidity
function _convertAndQueueViaV3OrDirect(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
    internal
    returns (uint256 creatorOut, uint256 sharesQueued);
```

### _convertViaExternalAndQueue


```solidity
function _convertViaExternalAndQueue(
    address tokenIn,
    uint256 amountIn,
    uint256 minCreatorOut,
    address spender,
    address swapTarget,
    bytes calldata swapCallData
) internal returns (uint256 creatorOut, uint256 sharesQueued);
```

### _queueCreatorOut


```solidity
function _queueCreatorOut(uint256 creatorOut) internal returns (uint256 sharesQueued);
```

### _readAddress


```solidity
function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr);
```

### _revertWithBytes


```solidity
function _revertWithBytes(bytes memory revertData) internal pure;
```

### _claimProtocolRewards


```solidity
function _claimProtocolRewards(uint256 amount) internal;
```

## Events
### KeeperUpdated

```solidity
event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
```

### SwapPathSet

```solidity
event SwapPathSet(address indexed tokenIn, bytes path);
```

### ConvertedAndQueued

```solidity
event ConvertedAndQueued(address indexed tokenIn, uint256 amountIn, uint256 creatorOut, uint256 vaultSharesQueued);
```

### ExternalSwapTargetApprovalSet

```solidity
event ExternalSwapTargetApprovalSet(address indexed target, bool approved);
```

### ExternalSwapSpenderApprovalSet

```solidity
event ExternalSwapSpenderApprovalSet(address indexed spender, bool approved);
```

### ExternalSwapAndQueued

```solidity
event ExternalSwapAndQueued(
    address indexed tokenIn,
    address indexed swapTarget,
    address indexed spender,
    uint256 amountIn,
    uint256 creatorOut,
    uint256 vaultSharesQueued
);
```

### BatchProcessed

```solidity
event BatchProcessed(uint256 actionCount, uint256 totalCreatorOut, uint256 totalSharesQueued);
```

### ProtocolRewardsClaimed

```solidity
event ProtocolRewardsClaimed(address indexed claimer, uint256 amount);
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### NotAuthorized

```solidity
error NotAuthorized();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### PathNotSet

```solidity
error PathNotSet(address tokenIn);
```

### InvalidPath

```solidity
error InvalidPath(address tokenIn);
```

### ExternalSwapTargetNotApproved

```solidity
error ExternalSwapTargetNotApproved(address target);
```

### ExternalSwapSpenderNotApproved

```solidity
error ExternalSwapSpenderNotApproved(address spender);
```

### ExternalSwapOverspent

```solidity
error ExternalSwapOverspent(address tokenIn, uint256 spent, uint256 maxAmountIn);
```

### MinCreatorOutNotMet

```solidity
error MinCreatorOutNotMet(uint256 minExpected, uint256 actualOut);
```

### InvalidBatchAction

```solidity
error InvalidBatchAction(uint8 kind);
```

### ExternalSwapCallFailed

```solidity
error ExternalSwapCallFailed();
```

### ProtocolRewardsClaimFailed

```solidity
error ProtocolRewardsClaimFailed();
```

## Structs
### ExternalSwapParams

```solidity
struct ExternalSwapParams {
    address tokenIn;
    uint256 amountIn;
    uint256 minCreatorOut;
    address spender;
    address swapTarget;
    bytes swapCallData;
}
```

### BatchAction

```solidity
struct BatchAction {
    // kind=0 => convertAndQueue (v3 path/direct creator coin)
    // kind=1 => convertViaExternalAndQueue (allowlisted external swap target/spender)
    uint8 kind;
    address tokenIn;
    uint256 amountIn;
    uint256 minCreatorOut;
    address spender;
    address swapTarget;
    bytes swapCallData;
}
```

