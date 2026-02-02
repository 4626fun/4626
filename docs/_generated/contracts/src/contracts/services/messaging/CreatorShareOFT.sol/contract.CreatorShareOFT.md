# CreatorShareOFT
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/services/messaging/CreatorShareOFT.sol)

**Inherits:**
OFT, ReentrancyGuard

**Title:**
CreatorShareOFT

**Author:**
0xakita.eth

OFT receipt token for CreatorOVault with buy fee and lottery integration

FEATURES:
- LayerZero OFT for cross-chain share transfers
- Buy fee on DEX purchases (configurable, default 6.9%)
- Lottery integration for buyers
- SwapOnly address classification for DEX detection

FEE MECHANISM:
- Register DEX pools/routers as SwapOnly
- Buys (from SwapOnly → user) = fee to GaugeController
- Sells and normal transfers = no fee

BUILDS ON TOP OF ZORAS CREATOR COINS
Each creator deploys their own ShareOFT (e.g., ■AKITA for AKITA vault)


## State Variables
### BASIS_POINTS

```solidity
uint256 public constant BASIS_POINTS = 10000
```


### MAX_FEE_BPS

```solidity
uint16 public constant MAX_FEE_BPS = 1000
```


### registry
CreatorRegistry for ecosystem contracts


```solidity
ICreatorRegistry public registry
```


### chainEid
Chain EID for this deployment


```solidity
uint32 public immutable chainEid
```


### vault
Associated vault


```solidity
address public vault
```


### gaugeController
All fees go here


```solidity
address public gaugeController
```


### buyFeeBps
Buy fee in basis points (690 = 6.9%)


```solidity
uint16 public buyFeeBps = 690
```


### feesEnabled
Feature toggles


```solidity
bool public feesEnabled = true
```


### lotteryEnabled

```solidity
bool public lotteryEnabled = true
```


### addressType
Address classification mapping


```solidity
mapping(address => OperationType) public addressType
```


### isMinter
Minter permissions (for wrapper integration)


```solidity
mapping(address => bool) public isMinter
```


### taxConfigDelegate
Tax config delegate (can call setTaxConfig on hooks on behalf of this token)


```solidity
address public taxConfigDelegate
```


## Functions
### onlyVaultOrMinter


```solidity
modifier onlyVaultOrMinter() ;
```

### constructor

Deploy chain-specific share token

DETERMINISTIC DEPLOYMENT:
Registry address is same on all chains via CREATE2.
LayerZero endpoint is looked up from registry at construction.
This allows same constructor args → same CREATE2 address on all chains.


```solidity
constructor(string memory _name, string memory _symbol, address _registry, address _owner)
    OFT(_name, _symbol, ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_name`|`string`|Token name (e.g., "AKITA Shares")|
|`_symbol`|`string`|Token symbol (e.g., "■AKITA")|
|`_registry`|`address`|CreatorRegistry address (same on all chains for deterministic addresses)|
|`_owner`|`address`|Owner address|


### setVault

Set the vault that can mint/burn shares


```solidity
function setVault(address _vault) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vault`|`address`|CreatorOVault address|


### setRegistry

Set the registry for ecosystem lookups


```solidity
function setRegistry(address _registry) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|CreatorRegistry address|


### setMinter

Set minter permission (for wrapper integration)


```solidity
function setMinter(address minter, bool status) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`minter`|`address`|Address to grant/revoke minting|
|`status`|`bool`|True to grant, false to revoke|


### mint

Mint shares (vault/minter only)


```solidity
function mint(address _to, uint256 _amount) external onlyVaultOrMinter;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_to`|`address`|Recipient|
|`_amount`|`uint256`|Amount to mint|


### burn

Burn shares (vault/minter only)


```solidity
function burn(address _from, uint256 _amount) external onlyVaultOrMinter;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_from`|`address`|Address to burn from|
|`_amount`|`uint256`|Amount to burn|


### transfer

Transfer shares with fee detection


```solidity
function transfer(address to, uint256 amount) public override returns (bool);
```

### transferFrom

Transfer shares from another account with fee detection


```solidity
function transferFrom(address from, address to, uint256 amount) public override returns (bool);
```

### _transferWithFees

Internal transfer with fee logic


```solidity
function _transferWithFees(address from, address to, uint256 amount) internal returns (bool);
```

### _processBuy

FEE FLOW - THE SOCIAL-FI ENGINE:
1. Fee is collected in OFT tokens (■AKITA)
2. Sent to GaugeController via receiveFees()
3. GaugeController distributes:
- 50% burned → increases PPS for all vault holders
- 31% lottery → jackpot for buyers
- 19% creator → treasury
This makes users "win with the creator" - their vault
shares become more valuable from trading activity!

Process buy with fees. Follows CEI pattern.


```solidity
function _processBuy(address from, address to, uint256 amount) internal nonReentrant returns (bool);
```

### _sendFeesToGauge

Send accumulated fees to gauge controller


```solidity
function _sendFeesToGauge(address _gaugeController, uint256 amount) internal;
```

### _triggerLottery

Uses tx.origin to get actual buyer since msg.sender is the DEX router.
Only EOAs can win - prevents gaming via contracts.
Users should only interact with trusted DEX frontends.

Trigger lottery entry for buyer


```solidity
function _triggerLottery(address, uint256 amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`||
|`amount`|`uint256`|Amount of tokens bought|


### setAddressType

Set operation type for an address


```solidity
function setAddressType(address addr, OperationType opType) external onlyOwner;
```

### setAddressTypes

Batch set operation types


```solidity
function setAddressTypes(address[] calldata addrs, OperationType opType) external onlyOwner;
```

### setGaugeController

Set gauge controller (fee recipient)


```solidity
function setGaugeController(address _controller) external onlyOwner;
```

### setBuyFee

Set buy fee (max 10%)


```solidity
function setBuyFee(uint16 _feeBps) external onlyOwner;
```

### setFeesEnabled

Enable/disable fees


```solidity
function setFeesEnabled(bool _enabled) external onlyOwner;
```

### setLotteryEnabled

Enable/disable lottery


```solidity
function setLotteryEnabled(bool _enabled) external onlyOwner;
```

### setTaxConfigDelegate

Set the tax config delegate (for future custom hooks)

NOTE: The existing SimpleSellTaxHook at 0xca975B9dAF772C71161f3648437c3616E5Be0088
checks msg.sender == token.owner(), so ONLY the ■TOKEN owner can configure it.
This delegate feature is for future hooks that accept delegated configuration.


```solidity
function setTaxConfigDelegate(address _delegate) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_delegate`|`address`|Address that can call configureTaxHook on behalf of this token|


### getTaxHookParams

Get tax hook configuration data for the owner to call directly

Since the SimpleSellTaxHook requires msg.sender == token.owner(),
this helper returns the exact parameters for the owner to call.


```solidity
function getTaxHookParams(address counterAsset)
    external
    view
    returns (address token, address recipient, bool counterIsEth);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`counterAsset`|`address`|Counter asset (address(0) for ETH)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The token address (this contract)|
|`recipient`|`address`|The GaugeController address|
|`counterIsEth`|`bool`|Whether counter asset is ETH|


### convertToAssets

Convert shares to underlying Creator Coin amount


```solidity
function convertToAssets(uint256 shares) public view returns (uint256);
```

### previewFee

Preview fee for a transfer


```solidity
function previewFee(address from, address to, uint256 amount) external view returns (bool isBuy, uint256 fee);
```

### isTradingVenue

Check if address is a trading venue


```solidity
function isTradingVenue(address addr) external view returns (bool);
```

### canTransfer

Confirm transfers are always allowed


```solidity
function canTransfer(address, address, uint256) external pure returns (bool);
```

### checkMinter

Check if address is a minter


```solidity
function checkMinter(address account) external view returns (bool);
```

### version

Get contract version


```solidity
function version() external pure returns (string memory);
```

### category

Get token category


```solidity
function category() external pure returns (string memory);
```

### description

Get token description


```solidity
function description() external pure returns (string memory);
```

### payoutRecipient

Returns the address that should receive trade fees

Called by external tax hooks (like the 6.9% V4 hook) to determine
where to send collected fees. Returns the GaugeController which
handles distribution (90% jackpot, 5% burn, 5% protocol).


```solidity
function payoutRecipient() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The gauge controller address, or owner if not set|


### isOwner

Check if caller is the payout recipient (for Zora compatibility)


```solidity
function isOwner(address account) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`account`|`address`|Address to check|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|True if account is the payout recipient|


## Events
### VaultSet

```solidity
event VaultSet(address indexed vault);
```

### RegistrySet

```solidity
event RegistrySet(address indexed registry);
```

### SharesMinted

```solidity
event SharesMinted(address indexed to, uint256 amount);
```

### SharesBurned

```solidity
event SharesBurned(address indexed from, uint256 amount);
```

### BuyFee

```solidity
event BuyFee(address indexed from, address indexed to, uint256 amount, uint256 fee);
```

### FeeCollected

```solidity
event FeeCollected(address indexed gaugeController, uint256 amount);
```

### LotteryTriggered

```solidity
event LotteryTriggered(address indexed buyer, uint256 amount, uint256 requestId);
```

### AddressTypeSet

```solidity
event AddressTypeSet(address indexed addr, OperationType opType);
```

### GaugeControllerSet

```solidity
event GaugeControllerSet(address indexed controller);
```

### BuyFeeUpdated

```solidity
event BuyFeeUpdated(uint16 oldFee, uint16 newFee);
```

### MinterUpdated

```solidity
event MinterUpdated(address indexed minter, bool status);
```

### TaxConfigDelegateSet

```solidity
event TaxConfigDelegateSet(address indexed delegate);
```

### TaxHookConfigured

```solidity
event TaxHookConfigured(address indexed hook, address recipient, uint256 taxRate);
```

## Errors
### OnlyVaultOrMinter

```solidity
error OnlyVaultOrMinter();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### FeeTooHigh

```solidity
error FeeTooHigh();
```

### NotMinter

```solidity
error NotMinter();
```

## Enums
### OperationType
Address classification for fee detection


```solidity
enum OperationType {
    Unknown, // Normal transfer - no fees
    SwapOnly, // Trading venue - buys = fee
    NoFees // Exempt from all fees
}
```

