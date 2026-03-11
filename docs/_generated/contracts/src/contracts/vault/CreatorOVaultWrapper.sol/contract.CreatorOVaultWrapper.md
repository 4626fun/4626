# CreatorOVaultWrapper
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/vault/CreatorOVaultWrapper.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
CreatorOVaultWrapper

**Author:**
0xakita.eth - Think FriendTech, but for CreatorCoins, in ERC-4626 Omnichain Vaults

All-in-one wrapper that handles Creator Coin → ShareOFT in one transaction

COMBINES WRAPPER + COMPOSER FUNCTIONALITY:
USER-FACING (Simple):
- deposit(akita) → ■AKITA  (one tx!)
- withdraw(■AKITA) → akita (one tx!)
INTERNAL (Advanced, for integrations):
- wrap(▢AKITA) → ■AKITA
- unwrap(■AKITA) → ▢AKITA

WHAT USERS SEE:
"I deposit 1 akita, I get 1 ■AKITA"
"I withdraw 1 ■AKITA, I get 1 akita"
They never see vault shares (▢AKITA), wrapping, or the 10^3 offset.

NORMALIZATION:
The vault uses a 10^3 offset for inflation attack protection:
- Deposit 1 AKITA → ~1000 ▢AKITA (vault shares)
This wrapper normalizes the amounts:
- Wrap 1000 ▢AKITA → 1 ■AKITA (÷1000)
- Unwrap 1 ■AKITA → 1000 ▢AKITA (×1000)
Result: 1 AKITA ≈ 1 ■AKITA (clean UX!)

CROSS-CHAIN COMPATIBLE:
Constructor only takes immutables
Chain-specific shareOFT set via setShareOFT() after deployment


## State Variables
### NORMALIZATION_FACTOR
Normalization factor to offset the vault's 10^3 decimals offset

The vault uses _decimalsOffset() = 3, meaning:
- 1 AKITA deposited → ~1000 ▢AKITA shares
We normalize this in wrap/unwrap:
- Wrap: ■AKITA = ▢AKITA / 1000
- Unwrap: ▢AKITA = ■AKITA * 1000
Result: 1 AKITA ≈ 1 ■AKITA (clean UX!)


```solidity
uint256 public constant NORMALIZATION_FACTOR = 1000
```


### creatorCoin
Creator Coin token (e.g., akita) - the underlying asset


```solidity
IERC20 public immutable creatorCoin
```


### vault
CreatorOVault (ERC-4626) - converts Creator Coin to vault shares


```solidity
IERC4626 public immutable vault
```


### shareOFT
ShareOFT token (e.g., ■AKITA) - set post-deploy


```solidity
IShareOFT public shareOFT
```


### totalLocked
Tracking for wrap/unwrap accounting


```solidity
uint256 public totalLocked
```


### totalMinted

```solidity
uint256 public totalMinted
```


### totalUserDustShares

```solidity
uint256 public totalUserDustShares
```


### userDustShares

```solidity
mapping(address => uint256) public userDustShares
```


### wrapFee
Fees (basis points) - 0 by default for simplicity


```solidity
uint256 public wrapFee
```


### unwrapFee

```solidity
uint256 public unwrapFee
```


### MAX_FEE

```solidity
uint256 public constant MAX_FEE = 1000
```


### BASIS_POINTS

```solidity
uint256 public constant BASIS_POINTS = 10000
```


### feeRecipient
Fee recipient (defaults to owner)


```solidity
address public feeRecipient
```


### isWhitelisted
Whitelist (no fees)


```solidity
mapping(address => bool) public isWhitelisted
```


### totalWrapFees
Fee statistics


```solidity
uint256 public totalWrapFees
```


### totalUnwrapFees

```solidity
uint256 public totalUnwrapFees
```


## Functions
### constructor

Deploy wrapper (same address possible on all chains)


```solidity
constructor(address _creatorCoin, address _vault, address _owner) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_creatorCoin`|`address`|Creator Coin address (e.g., akita)|
|`_vault`|`address`|CreatorOVault address (ERC-4626)|
|`_owner`|`address`|Owner address|


### setShareOFT

Set the chain-specific ShareOFT (called after deploy)


```solidity
function setShareOFT(address _shareOFT) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_shareOFT`|`address`|CreatorShareOFT address (e.g., ■AKITA)|


### setFees


```solidity
function setFees(uint256 _wrapFee, uint256 _unwrapFee) external onlyOwner;
```

### setFeeRecipient


```solidity
function setFeeRecipient(address _recipient) external onlyOwner;
```

### setWhitelist


```solidity
function setWhitelist(address user, bool status) external onlyOwner;
```

### batchWhitelist


```solidity
function batchWhitelist(address[] calldata users, bool status) external onlyOwner;
```

### deposit

Deposit Creator Coin and receive ShareOFT in ONE transaction

USER SEES: akita → ■AKITA

INTERNAL FLOW:
1. Take Creator Coin from user
2. Deposit to vault → get vault shares
3. Lock vault shares, mint ShareOFT
4. Send ShareOFT to user


```solidity
function deposit(uint256 amount, uint256 minOut) external nonReentrant returns (uint256 shareOFTOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of Creator Coin to deposit|
|`minOut`|`uint256`|Minimum ShareOFT to receive (slippage protection)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`shareOFTOut`|`uint256`|Amount of ShareOFT received|


### deposit

Deposit with zero slippage protection (convenience)


```solidity
function deposit(uint256 amount) external nonReentrant returns (uint256 shareOFTOut);
```

### withdraw

Withdraw ShareOFT and receive Creator Coin in ONE transaction

USER SEES: ■AKITA → akita

INTERNAL FLOW:
1. Burn ShareOFT from user
2. Release vault shares
3. Redeem vault shares → Creator Coin
4. Send Creator Coin to user


```solidity
function withdraw(uint256 amount, uint256 minOut) external nonReentrant returns (uint256 creatorCoinOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of ShareOFT to withdraw|
|`minOut`|`uint256`|Minimum Creator Coin to receive (slippage protection)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinOut`|`uint256`|Amount of Creator Coin received|


### withdraw

Withdraw with zero slippage protection (convenience)


```solidity
function withdraw(uint256 amount) external nonReentrant returns (uint256 creatorCoinOut);
```

### wrap

Wrap vault shares → ShareOFT tokens

For advanced users who already have vault shares (▢AKITA)


```solidity
function wrap(uint256 amount) external nonReentrant returns (uint256 amountOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of vault shares to wrap|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amountOut`|`uint256`|Amount of ShareOFT tokens minted|


### unwrap

Unwrap ShareOFT tokens → vault shares

For advanced users who want vault shares (▢AKITA) directly


```solidity
function unwrap(uint256 amount) external nonReentrant returns (uint256 amountOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of ShareOFT tokens to unwrap|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amountOut`|`uint256`|Amount of vault shares released|


### _wrapInternal

Internal wrap: locks vault shares, mints NORMALIZED ShareOFT

NORMALIZATION:
1000 ▢AKITA → 1 ■AKITA
This makes: 1 AKITA ≈ 1 ■AKITA (clean UX!)


```solidity
function _wrapInternal(uint256 vaultSharesIn, address user) internal returns (uint256 shareOFTOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vaultSharesIn`|`uint256`|Vault shares to lock (already in this contract)|
|`user`|`address`|User to mint ShareOFT to and check whitelist|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`shareOFTOut`|`uint256`|Normalized share token amount (■AKITA = vaultShares / 1000)|


### _unwrapInternal

Internal unwrap: burns ShareOFT, releases DENORMALIZED vault shares

DENORMALIZATION:
1 ■AKITA → 1000 ▢AKITA
This makes: 1 ■AKITA ≈ 1 AKITA (clean UX!)


```solidity
function _unwrapInternal(uint256 shareOFTIn, address user) internal returns (uint256 vaultSharesOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`shareOFTIn`|`uint256`|Normalized share token amount (■AKITA) to burn|
|`user`|`address`|User to burn from and check whitelist|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`vaultSharesOut`|`uint256`|Denormalized vault shares (▢AKITA = ■AKITA * 1000)|


### previewDeposit

Preview how much ShareOFT you'll get for depositing Creator Coin


```solidity
function previewDeposit(uint256 creatorCoinAmount) external view returns (uint256);
```

### previewWithdraw

Preview how much Creator Coin you'll get for withdrawing ShareOFT


```solidity
function previewWithdraw(uint256 shareOFTAmount) external view returns (uint256);
```

### previewWrap

Preview wrap output (vaultShares → ShareOFT)


```solidity
function previewWrap(uint256 amount, address user) external view returns (uint256);
```

### previewUnwrap

Preview unwrap output (ShareOFT → vaultShares)


```solidity
function previewUnwrap(uint256 amount, address user) external view returns (uint256);
```

### _previewWrap

Preview wrap with normalization: vaultShares → share token (■AKITA)


```solidity
function _previewWrap(uint256 vaultShares, address user) internal view returns (uint256 shareOFTAmount);
```

### _previewUnwrap

Preview unwrap with denormalization: share token (■AKITA) → vaultShares


```solidity
function _previewUnwrap(uint256 shareOFTAmount, address user) internal view returns (uint256 vaultShares);
```

### pricePerShare

Get the current price per share (1e18 scale)


```solidity
function pricePerShare() external view returns (uint256);
```

### isReady

Check if wrapper is ready


```solidity
function isReady() external view returns (bool);
```

### isBalanced

Check if wrapper is balanced against required share backing

required backing = minted * 1000 + user-attributed dust


```solidity
function isBalanced() external view returns (bool);
```

### getReserves

Get wrapper reserves

Note: locked = minted * 1000 + dust when balanced


```solidity
function getReserves() external view returns (uint256 locked, uint256 minted);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`locked`|`uint256`|Vault shares locked (▢AKITA, NOT normalized)|
|`minted`|`uint256`|ShareOFT minted (■AKITA, normalized)|


### requiredLockedBacking

Get the total vault-share backing required by minted supply and user dust


```solidity
function requiredLockedBacking() external view returns (uint256);
```

### getFeeStats

Get fee statistics


```solidity
function getFeeStats() external view returns (uint256 wrapFeesCollected, uint256 unwrapFeesCollected);
```

### getVaultStats

Get vault statistics


```solidity
function getVaultStats() external view returns (uint256 totalAssets, uint256 totalSupply, uint256 _pricePerShare);
```

### getContracts

Get all contract addresses


```solidity
function getContracts() external view returns (address _creatorCoin, address _vault, address _shareOFT);
```

### vaultToken

Vault shares token address


```solidity
function vaultToken() external view returns (address);
```

### oftToken

ShareOFT token address


```solidity
function oftToken() external view returns (address);
```

### verify

Emergency verify - check balances match accounting

With normalization + dust: actualLocked == totalLocked == (totalMinted * 1000 + dust)


```solidity
function verify() external view returns (bool);
```

### emergencyWithdraw

Emergency withdraw stuck tokens


```solidity
function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner;
```

### refreshApproval

Refresh vault approval if needed


```solidity
function refreshApproval() external onlyOwner;
```

### _requiredLockedBacking


```solidity
function _requiredLockedBacking() internal view returns (uint256);
```

## Events
### Deposited

```solidity
event Deposited(address indexed user, uint256 creatorCoinIn, uint256 shareOFTOut);
```

### Withdrawn

```solidity
event Withdrawn(address indexed user, uint256 shareOFTIn, uint256 creatorCoinOut);
```

### Wrapped

```solidity
event Wrapped(address indexed user, uint256 vaultSharesIn, uint256 shareOFTOut, uint256 fee);
```

### Unwrapped

```solidity
event Unwrapped(address indexed user, uint256 shareOFTIn, uint256 vaultSharesOut, uint256 fee);
```

### ShareOFTSet

```solidity
event ShareOFTSet(address indexed shareOFT);
```

### WhitelistUpdated

```solidity
event WhitelistUpdated(address indexed user, bool status);
```

### FeesUpdated

```solidity
event FeesUpdated(uint256 wrapFee, uint256 unwrapFee);
```

### FeeRecipientUpdated

```solidity
event FeeRecipientUpdated(address indexed recipient);
```

## Errors
### ZeroAmount

```solidity
error ZeroAmount();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ShareOFTNotSet

```solidity
error ShareOFTNotSet();
```

### ShareOFTAlreadySet

```solidity
error ShareOFTAlreadySet();
```

### ShareOFTNotContract

```solidity
error ShareOFTNotContract(address shareOFT);
```

### ShareOFTInvalidERC20

```solidity
error ShareOFTInvalidERC20(address shareOFT);
```

### ShareOFTMintBalanceMismatch

```solidity
error ShareOFTMintBalanceMismatch(
    address user, uint256 beforeBalance, uint256 afterBalance, uint256 expectedIncrease
);
```

### ShareOFTBurnBalanceMismatch

```solidity
error ShareOFTBurnBalanceMismatch(
    address user, uint256 beforeBalance, uint256 afterBalance, uint256 expectedDecrease
);
```

### BurnExceedsTotalMinted

```solidity
error BurnExceedsTotalMinted(uint256 totalMinted, uint256 burnAmount);
```

### InsufficientLocked

```solidity
error InsufficientLocked();
```

### FeeExceedsLimit

```solidity
error FeeExceedsLimit();
```

### SlippageExceeded

```solidity
error SlippageExceeded();
```

### AmountTooSmallToNormalize

```solidity
error AmountTooSmallToNormalize();
```

