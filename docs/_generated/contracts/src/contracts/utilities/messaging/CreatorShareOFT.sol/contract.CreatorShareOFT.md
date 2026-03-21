# CreatorShareOFT
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/messaging/CreatorShareOFT.sol)

**Inherits:**
OFT, ReentrancyGuard

**Title:**
CreatorShareOFT

**Author:**
0xakita.eth

OFT receipt token for CreatorOVault with buy fee, lottery, and hub-centric architecture

ARCHITECTURE:
This contract operates in two modes controlled by `isHub`:
HUB MODE (Base):
- Fees sent to local GaugeController via receiveFees()
- Lottery entries processed by local CreatorLotteryManager
- Full vault/wrapper/gauge stack available
REMOTE MODE (Arbitrum, etc.):
- Fees accumulated internally, bridged back to Base via flushFees()
- Lottery entries sent as LayerZero messages to Base hub
- Winner callbacks received from hub, emitted as local events
- No vault, wrapper, gauge, or lottery manager deployed

FEE MECHANISM:
- Register DEX pools/routers as SwapOnly
- Buys (from SwapOnly → user) = 6.9% fee
- Hub: fee → GaugeController → unwrap → distribute (21.39% burn, 69% lottery, 9.61% voter rewards)
- Remote: fee → pendingFees → flushFees() bridges OFT back to Base gauge
- Sells: taxed by SimpleSellTaxHook on Base only (V4 hook, not in this contract)

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


### MSG_TYPE_LOTTERY_ENTRY
Custom LayerZero message types (extends OFT SEND=1, SEND_AND_CALL=2)


```solidity
uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3
```


### MSG_TYPE_WINNER_CALLBACK

```solidity
uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4
```


### DEFAULT_LOTTERY_GAS_LIMIT
Default gas limit for cross-chain lottery entry messages


```solidity
uint128 public constant DEFAULT_LOTTERY_GAS_LIMIT = 300_000
```


### DEFAULT_FLUSH_GAS_LIMIT
Default gas limit for fee flush (OFT send)


```solidity
uint128 public constant DEFAULT_FLUSH_GAS_LIMIT = 200_000
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


### isHub
Whether this is the hub chain (Base). Controls fee routing and lottery behavior.


```solidity
bool public isHub
```


### vault
Associated vault (hub-only, address(0) on remote chains)


```solidity
address public vault
```


### gaugeController
All fees go here on hub chain (address(0) on remote chains)


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
Tax config delegate (hub-only, for future custom hooks)


```solidity
address public taxConfigDelegate
```


### _contractURI
ERC-7572 contract-level metadata URI

Returns a URL to JSON metadata including token image, description, etc.


```solidity
string private _contractURI
```


### pendingFees
Accumulated OFT fees on remote chains, waiting to be flushed to Base


```solidity
uint256 public pendingFees
```


### flushThreshold
Minimum fees before auto-flush triggers (configurable)


```solidity
uint256 public flushThreshold = 100e18
```


### hubGaugeReceiver
Address on Base that receives bridged fees (the hub GaugeController)


```solidity
address public hubGaugeReceiver
```


### hubEid
LayerZero EID for the hub chain (Base)


```solidity
uint32 public hubEid
```


### totalFeesFlushed
Total fees flushed to hub (lifetime, remote only)


```solidity
uint256 public totalFeesFlushed
```


### hubLotteryPeer
LayerZero peer for the hub LotteryManager (bytes32-encoded address)


```solidity
bytes32 public hubLotteryPeer
```


### lotteryEntryGasLimit
Gas limit for lottery entry messages to hub


```solidity
uint128 public lotteryEntryGasLimit = DEFAULT_LOTTERY_GAS_LIMIT
```


### nextPendingLotteryEntryId
Next id for pending remote lottery entries


```solidity
uint256 public nextPendingLotteryEntryId = 1
```


### pendingLotteryEntries
Pending remote lottery entries keyed by entry id


```solidity
mapping(uint256 => PendingLotteryEntry) public pendingLotteryEntries
```


### pendingLotteryEntryCount
Number of pending remote entries per buyer


```solidity
mapping(address => uint256) public pendingLotteryEntryCount
```


### totalLotteryEntriesSent
Total lottery entries sent to hub (lifetime, remote only)


```solidity
uint256 public totalLotteryEntriesSent
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
After deployment, call setHubConfig() to set hub vs remote mode.


```solidity
constructor(string memory _name, string memory _symbol, address _registry, address _owner)
    OFT(_name, _symbol, ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid), _owner)
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

Set the vault that can mint/burn shares (hub-only)


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

FEE FLOW:
1. Fee is collected in OFT tokens (■AKITA)
2. Hub: sent to GaugeController via receiveFees()
Remote: accumulated in pendingFees, bridged via flushFees()
3. GaugeController on Base distributes:
- 21.39% burned → increases PPS for all vault holders (ve(3,3) accrual)
- 69% lottery → jackpot reserve for buyers
- 9.61% voter rewards → ve4626 voters

Process buy with fees. Follows CEI pattern.


```solidity
function _processBuy(address from, address to, uint256 amount) internal nonReentrant returns (bool);
```

### _routeFees

Route collected fees based on chain mode
Hub: send directly to local GaugeController
Remote: accumulate internally for batch bridging


```solidity
function _routeFees(uint256 amount) internal;
```

### _sendFeesToGauge

Send fees to local gauge controller (hub-only path)


```solidity
function _sendFeesToGauge(uint256 amount) internal;
```

### flushFees

Bridge accumulated fees back to the hub chain GaugeController

Permissionless — anyone can trigger this (keeper, user, protocol)
Uses OFT send() to burn tokens on this chain and mint on Base,
delivered to the hubGaugeReceiver address.
Caller must pass the SendParam and MessagingFee externally.
Use quoteFlushFees() to build the correct SendParam and get the fee quote.


```solidity
function flushFees(SendParam calldata _sendParam, MessagingFee calldata _fee) external payable nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_sendParam`|`SendParam`|The OFT SendParam (use buildFlushSendParam() to construct)|
|`_fee`|`MessagingFee`|The LayerZero messaging fee (use quoteFlushFees() to quote)|


### buildFlushSendParam

Build the SendParam for flushing fees (helper for off-chain callers)


```solidity
function buildFlushSendParam() external view returns (SendParam memory sendParam);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`sendParam`|`SendParam`|The SendParam to pass to flushFees()|


### quoteFlushFees

Quote the LayerZero fee for flushing pending fees to hub

Call buildFlushSendParam() first, then pass it to quoteSend()
Or use this convenience function which does both.


```solidity
function quoteFlushFees() external view returns (uint256 nativeFee);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`nativeFee`|`uint256`|The native gas fee required for the flush|


### _triggerLottery

Hub mode: calls local CreatorLotteryManager.processSwapLottery()
Remote mode: queues a pending entry that the buyer submits with native gas

Uses the actual transfer recipient address to support:
- EOA wallets (traditional)
- Smart contract wallets (Coinbase Smart Wallet, Safe, etc.)
- ERC-4337 account abstraction (where tx.origin is the bundler)
- DEX aggregators (via ILotteryBeneficiary callback)

Trigger lottery entry for buyer


```solidity
function _triggerLottery(address recipient, uint256 amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recipient`|`address`|The actual recipient of the swap (buyer's wallet)|
|`amount`|`uint256`|Amount of tokens bought|


### _triggerLotteryLocal

Hub-only: call local lottery manager


```solidity
function _triggerLotteryLocal(address buyer, uint256 amount) internal;
```

### _queuePendingLotteryEntry

Queue a pending remote lottery entry for explicit buyer-paid submission.


```solidity
function _queuePendingLotteryEntry(address buyer, uint256 amount) internal;
```

### submitPendingLotteryEntry

Submit a previously queued remote lottery entry and pay LayerZero native fee.

Remote-only path. Keeps transfer flow ERC20-compatible by moving fee payment to an explicit call.


```solidity
function submitPendingLotteryEntry(uint256 entryId) external payable nonReentrant;
```

### quoteLotteryEntry

Quote the LayerZero fee for a lottery entry message


```solidity
function quoteLotteryEntry(uint256 amount) external view returns (MessagingFee memory fee);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|The trade amount|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`fee`|`MessagingFee`|The native gas fee required|


### quotePendingLotteryEntry

Quote the LayerZero fee for a queued remote lottery entry.


```solidity
function quotePendingLotteryEntry(uint256 entryId) external view returns (MessagingFee memory fee);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`entryId`|`uint256`|Pending entry id|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`fee`|`MessagingFee`|LayerZero native/lzToken fee quote (zeroed if entry/config missing)|


### _prepareLotteryEntryMessage


```solidity
function _prepareLotteryEntryMessage(address buyer, uint256 amount)
    internal
    view
    returns (bytes memory payload, bytes memory options, MessagingFee memory fee);
```

### _resolveLotteryBeneficiary

Resolution order:
1. If recipient is EOA → use recipient
2. If recipient implements ILotteryBeneficiary → use returned address
3. Otherwise → use recipient (smart wallet case)

Resolve the actual lottery beneficiary from a recipient address


```solidity
function _resolveLotteryBeneficiary(address recipient) internal view returns (address buyer);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recipient`|`address`|The transfer recipient|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`buyer`|`address`|The address that should receive lottery entries|


### _lzReceive

Override _lzReceive to handle both OFT token transfers and custom messages

OFT messages use the standard OFTMsgCodec format.
Custom messages (winner callbacks) are prefixed with MSG_TYPE_WINNER_CALLBACK.
Winner callbacks are ABI-encoded, while OFT token-transfer messages are packed.
We must never try to ABI-decode a "msgType" out of the first word of a packed OFT payload.


```solidity
function _lzReceive(
    Origin calldata _origin,
    bytes32 _guid,
    bytes calldata _message,
    address _executor,
    bytes calldata _extraData
) internal virtual override;
```

### _isWinnerCallbackMessage


```solidity
function _isWinnerCallbackMessage(Origin calldata _origin, bytes calldata _message) internal view returns (bool);
```

### _handleWinnerCallback

Handle winner callback from hub LotteryManager
Emits LotteryWinnerNotification on the user's chain


```solidity
function _handleWinnerCallback(Origin calldata _origin, bytes calldata _message) internal;
```

### setHubConfig

Configure hub vs remote mode


```solidity
function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_isHub`|`bool`|True for hub chain (Base), false for remote chains|
|`_hubEid`|`uint32`|LayerZero EID for the hub chain (set on remote chains)|
|`_hubGaugeReceiver`|`address`|Address of GaugeController on hub (for fee bridging)|


### setHubLotteryPeer

Set the hub lottery peer (LotteryManager address on Base)


```solidity
function setHubLotteryPeer(uint32 _hubEid, bytes32 _hubLotteryPeer) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_hubEid`|`uint32`|LayerZero EID for the hub chain|
|`_hubLotteryPeer`|`bytes32`|bytes32-encoded address of the hub LotteryManager|


### setFlushThreshold

Set the flush threshold for auto-bridging fees


```solidity
function setFlushThreshold(uint256 _threshold) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_threshold`|`uint256`|Minimum accumulated fees before flush|


### setLotteryEntryGasLimit

Set the gas limit for lottery entry messages


```solidity
function setLotteryEntryGasLimit(uint128 _gasLimit) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_gasLimit`|`uint128`|Gas limit for the lzReceive on the hub|


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

Set gauge controller — fee recipient (hub-only)


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

Set the tax config delegate (hub-only, for future custom hooks)

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

Get tax hook configuration data for the owner to call directly (hub-only)

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

On remote chains (vault == address(0)), returns shares 1:1


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

### canFlush

Check if fees can be flushed (remote chains only)


```solidity
function canFlush() external view returns (bool);
```

### getRemoteStatus

Get remote chain status


```solidity
function getRemoteStatus()
    external
    view
    returns (
        uint256 _pendingFees,
        uint256 _totalFeesFlushed,
        uint256 _totalLotteryEntriesSent,
        bool _isHub,
        uint32 _hubEid,
        address _hubGaugeReceiver
    );
```

### contractURI

ERC-7572 contract-level metadata URI

ERC-7572 is contract-level metadata for fungible tokens (not ERC-721 tokenURI).
If `_contractURI` is explicitly set, return it as-is for backward compatibility.
Otherwise, return the canonical HTTPS metadata endpoint for this token so that
Uniswap, DEX aggregators, and wallets can fetch the JSON over HTTP and display
the token image. A `data:application/json;base64,...` default was the previous
behaviour but many indexers treat contractURI as a URL to fetch and silently skip
`data:` schemes, leaving the token with no image in their UIs.


```solidity
function contractURI() external view returns (string memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|URI string for contract metadata.|


### setContractURI

Set custom contract metadata URI


```solidity
function setContractURI(string calldata uri) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`uri`|`string`|New metadata URI (empty string to use default)|


### _buildOnchainContractURI

Returns the canonical HTTPS metadata endpoint for this token.
The endpoint responds with ERC-7572-compliant JSON containing the
`image` field pointing at the AI-generated vault icon (or the
auto-composited fallback), allowing any client that can make an
HTTP GET request to display the correct token image.


```solidity
function _buildOnchainContractURI() internal view returns (string memory);
```

### _buildContractMetadataJson


```solidity
function _buildContractMetadataJson() internal view returns (string memory);
```

### _jsonAddressOrNull


```solidity
function _jsonAddressOrNull(address addr) internal pure returns (string memory);
```

### _buildRendererImageUrl


```solidity
function _buildRendererImageUrl(string memory format) internal view returns (string memory);
```

### payoutRecipient

Returns the address that should receive trade fees

Called by external tax hooks (like the 6.9% V4 sell hook on Base) to determine
where to send collected fees. Returns the GaugeController which handles
distribution (21.39% burn, 69% lottery, 9.61% voter rewards).


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


### receive

Accept native token transfers/refunds.

Remote lottery entries are buyer-funded via submitPendingLotteryEntry(),
but this contract can still receive native token via direct transfer.


```solidity
receive() external payable;
```

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

### ContractURIUpdated
ERC-7572: Emitted when contract URI is updated


```solidity
event ContractURIUpdated();
```

### FeesAccumulated
Emitted when fees are accumulated on a remote chain


```solidity
event FeesAccumulated(uint256 amount, uint256 totalPending);
```

### FeesFlushed
Emitted when accumulated fees are flushed (bridged) back to the hub


```solidity
event FeesFlushed(uint256 amount, address indexed hubReceiver, uint32 indexed hubEid);
```

### LotteryEntrySent
Emitted when a lottery entry is sent to the hub from a remote chain


```solidity
event LotteryEntrySent(address indexed buyer, uint256 amount, uint32 indexed hubEid);
```

### PendingLotteryEntryQueued
Emitted when a remote buy creates a pending lottery entry


```solidity
event PendingLotteryEntryQueued(
    uint256 indexed entryId, address indexed buyer, uint256 amount, uint32 indexed hubEid
);
```

### PendingLotteryEntrySubmitted
Emitted when a pending remote lottery entry is submitted


```solidity
event PendingLotteryEntrySubmitted(
    uint256 indexed entryId, address indexed buyer, uint256 amount, uint256 nativeFeePaid, uint32 indexed hubEid
);
```

### LotteryWinnerNotification
Emitted on remote chain when the hub notifies of a lottery win


```solidity
event LotteryWinnerNotification(
    address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid, uint32 indexed sourceHubEid
);
```

### HubConfigUpdated
Hub config updated


```solidity
event HubConfigUpdated(bool isHub, uint32 hubEid, address hubGaugeReceiver);
```

### HubLotteryPeerSet

```solidity
event HubLotteryPeerSet(uint32 indexed hubEid, bytes32 hubLotteryPeer);
```

### FlushThresholdUpdated

```solidity
event FlushThresholdUpdated(uint256 newThreshold);
```

### LotteryEntryGasLimitUpdated

```solidity
event LotteryEntryGasLimitUpdated(uint128 newGasLimit);
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

### NothingToFlush

```solidity
error NothingToFlush();
```

### HubNotConfigured

```solidity
error HubNotConfigured();
```

### NotHub

```solidity
error NotHub();
```

### InvalidCallback

```solidity
error InvalidCallback();
```

### PendingLotteryEntryNotFound

```solidity
error PendingLotteryEntryNotFound();
```

### NotPendingLotteryEntryOwner

```solidity
error NotPendingLotteryEntryOwner();
```

### InvalidLotteryEntryFee

```solidity
error InvalidLotteryEntryFee(uint256 provided, uint256 required);
```

## Structs
### PendingLotteryEntry

```solidity
struct PendingLotteryEntry {
    address buyer;
    uint256 amount;
}
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

