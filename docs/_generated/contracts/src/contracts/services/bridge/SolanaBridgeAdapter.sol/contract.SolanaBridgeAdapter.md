# SolanaBridgeAdapter
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/services/bridge/SolanaBridgeAdapter.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
SolanaBridgeAdapter

**Author:**
0xakita.eth

Bridge adapter for CreatorVault assets between Base and Solana.

Used to register ■TOKEN and route bridge + lottery actions.


## State Variables
### BRIDGE
Base-Solana Bridge on Base Mainnet


```solidity
address public constant BRIDGE = address(bytes20(hex"3eff766c76a1be2ce1acf2b69c78bcae257d5188"))
```


### TOKEN_FACTORY
CrossChainERC20Factory for wrapped tokens


```solidity
address public constant TOKEN_FACTORY = address(bytes20(hex"dd56781d0509650f8c2981231b6c917f2d5d7df2"))
```


### SOL_ON_BASE
Wrapped SOL on Base


```solidity
address public constant SOL_ON_BASE = address(bytes20(hex"311935cd80b76769bf2ecc9d8ab7635b2139cf82"))
```


### NATIVE_SOL_PUBKEY
Sentinel Solana pubkey used by the Base bridge to denote native SOL on Solana.

Source: Base bridge `TokenLib.NATIVE_SOL_PUBKEY`.


```solidity
bytes32 public constant NATIVE_SOL_PUBKEY =
    bytes32(hex"069be72ab836d4eacc02525b7350a78a395da2f1253a40ebafd6630000000000")
```


### registry
Registry for looking up vault addresses


```solidity
address public registry
```


### tokenToSolanaMint
Mapping of ■TOKEN (Base) → SPL mint (Solana, as bytes32)


```solidity
mapping(address => bytes32) public tokenToSolanaMint
```


### solanaMintToToken
Mapping of SPL mint (Solana) → ■TOKEN (Base)


```solidity
mapping(bytes32 => address) public solanaMintToToken
```


### tokenToBaseDecimals
Registered token decimals (Base token decimals and Solana mint decimals).

The Base↔Solana bridge expresses amounts in *remote* units (`uint64`), so we track decimals to avoid ambiguity.


```solidity
mapping(address => uint8) public tokenToBaseDecimals
```


### tokenToSolanaDecimals

```solidity
mapping(address => uint8) public tokenToSolanaDecimals
```


### solanaTwinMapping
Mapping of Solana address → Twin contract address on Base


```solidity
mapping(bytes32 => address) public solanaTwinMapping
```


### isRegistered
Whether a token is registered for Solana bridging


```solidity
mapping(address => bool) public isRegistered
```


### allowedCcaAuctions
Allowed CCA auction contracts for Solana-originated bids/claims/exits.

Must be configured by the adapter owner.


```solidity
mapping(address => bool) public allowedCcaAuctions
```


## Functions
### constructor


```solidity
constructor(address _registry, address _owner) Ownable(_owner);
```

### onlyTwin

Solana-originated calls MUST be executed by the deterministic Twin contract
for the provided Solana pubkey.


```solidity
modifier onlyTwin(bytes32 solanaPubkey) ;
```

### registerToken

Register a wsToken for Solana bridging

Creates a wrapped SPL token on Solana via the bridge


```solidity
function registerToken(address baseToken, bytes32 solanaMint, uint8 solanaDecimals) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`baseToken`|`address`|The wsToken address on Base|
|`solanaMint`|`bytes32`|The SPL token mint address on Solana (as bytes32)|
|`solanaDecimals`|`uint8`|The SPL token decimals on Solana|


### deployWrappedToken

Deploy a wrapped token on Base for a Solana SPL token


```solidity
function deployWrappedToken(bytes32 solanaMint, string calldata name, string calldata symbol, uint8 decimals)
    external
    onlyOwner
    returns (address wrappedToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaMint`|`bytes32`|SPL token mint address|
|`name`|`string`|Token name|
|`symbol`|`string`|Token symbol|
|`decimals`|`uint8`|Token decimals|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`wrappedToken`|`address`|The deployed wrapped token address|


### bridgeToSolana

Bridge wsTokens from Base to Solana


```solidity
function bridgeToSolana(address token, uint256 amount, bytes32 solanaDestination) external payable nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The wsToken to bridge|
|`amount`|`uint256`|Amount to bridge|
|`solanaDestination`|`bytes32`|Destination address on Solana (as bytes32)|


### bridgeSOLToSolana

Bridge SOL from Base to Solana


```solidity
function bridgeSOLToSolana(uint256 amount, bytes32 solanaDestination) external payable nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of SOL to bridge|
|`solanaDestination`|`bytes32`|Destination on Solana|


### depositFromSolana

Called by Twin contracts to deposit into vault

Solana users can call this via the bridge with attached call


```solidity
function depositFromSolana(bytes32 solanaPubkey, address creatorToken, uint256 amount, address recipient)
    external
    nonReentrant
    onlyTwin(solanaPubkey)
    returns (uint256 shares);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`creatorToken`|`address`|The Creator Coin (vault asset) to deposit|
|`amount`|`uint256`|Amount to deposit|
|`recipient`|`address`|Who receives the vault shares|


### submitCCABidFromSolana

Submit a CCA bid on behalf of a Solana user

Called by Twin contract via bridge with attached call

FLOW FOR SOLANA USERS:
1. User bridges SOL from Solana to Base with attached call
2. Bridge mints SOL on Base to Twin contract
3. Twin contract calls this function
4. This contract submits bid to CCA on user's behalf
5. Bid ownership is assigned to Twin contract (user controls)


```solidity
function submitCCABidFromSolana(
    bytes32 solanaPubkey,
    address ccaAuction,
    uint256 maxPrice,
    uint128 amount,
    uint256 prevTickPrice
) external payable nonReentrant onlyTwin(solanaPubkey) returns (uint256 bidId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`ccaAuction`|`address`|The CCA auction contract address|
|`maxPrice`|`uint256`|Maximum price willing to pay (Q96 format)|
|`amount`|`uint128`|Amount of tokens to bid for|
|`prevTickPrice`|`uint256`|Previous tick price for placement|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`bidId`|`uint256`|The ID of the submitted bid|


### claimCCATokensFromSolana

Claim tokens from a graduated CCA auction

Called by Twin contract after auction graduates


```solidity
function claimCCATokensFromSolana(bytes32 solanaPubkey, address ccaAuction, uint256 bidId)
    external
    nonReentrant
    onlyTwin(solanaPubkey);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`ccaAuction`|`address`|The CCA auction contract|
|`bidId`|`uint256`|The bid ID to claim|


### exitCCABidFromSolana

Exit a CCA bid and reclaim ETH


```solidity
function exitCCABidFromSolana(bytes32 solanaPubkey, address ccaAuction, uint256 bidId)
    external
    nonReentrant
    onlyTwin(solanaPubkey);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`ccaAuction`|`address`|The CCA auction contract|
|`bidId`|`uint256`|The bid ID to exit|


### buyAndEnterLottery

Buy wsToken on Uniswap V4 to enter the lottery

This triggers a lottery entry for the Solana user!

LOTTERY ENTRY FLOW:
1. Solana user bridges SOL with attached call to this function
2. This contract swaps SOL for wsToken on Uniswap V4
3. The wsToken transfer triggers the 6.9% fee hook
4. Hook registers a lottery entry for the buyer
5. Solana user is now in the jackpot draw!


```solidity
function buyAndEnterLottery(
    bytes32 solanaPubkey,
    address creatorToken,
    address tokenIn,
    uint256 amountIn,
    uint256 amountOutMin,
    address recipient
) external nonReentrant onlyTwin(solanaPubkey) returns (uint256 amountOut);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`creatorToken`|`address`|The Creator Coin whose ShareOFT should be purchased (resolved via registry)|
|`tokenIn`|`address`||
|`amountIn`|`uint256`|Amount of SOL (or other token) to spend|
|`amountOutMin`|`uint256`|Minimum wsToken to receive|
|`recipient`|`address`|Who receives the wsToken (usually Twin contract)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amountOut`|`uint256`|Amount of wsToken received|


### buyAndEnterLotteryWithETH

Buy wsToken with native ETH to enter lottery

For users who bridged ETH or have ETH in their Twin


```solidity
function buyAndEnterLotteryWithETH(
    bytes32 solanaPubkey,
    address creatorToken,
    uint256 amountOutMin,
    address recipient
) external payable nonReentrant onlyTwin(solanaPubkey) returns (uint256 amountOut);
```

### encodeCCABidCall

Generate calldata for bridge + CCA bid in one Solana tx

Use this to build the call attached to bridge transaction


```solidity
function encodeCCABidCall(
    bytes32 solanaPubkey,
    address ccaAuction,
    uint256 maxPrice,
    uint128 amount,
    uint256 prevTickPrice,
    uint256 /* ethValue */
) external pure returns (bytes memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaPubkey`|`bytes32`||
|`ccaAuction`|`address`|CCA auction address|
|`maxPrice`|`uint256`|Max price for bid|
|`amount`|`uint128`|Token amount to bid for|
|`prevTickPrice`|`uint256`|Previous tick|
|`<none>`|`uint256`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes`|calldata The encoded function call|


### encodeErc20ApproveCall

Generate calldata for a one-time ERC20 approve from the Twin.

Use this to approve the adapter before calling functions that use `transferFrom`.
Target for the EVM call should be the ERC20 token contract.


```solidity
function encodeErc20ApproveCall(address spender, uint256 amount) external pure returns (bytes memory);
```

### encodeDepositFromSolanaCall


```solidity
function encodeDepositFromSolanaCall(bytes32 solanaPubkey, address creatorToken, uint256 amount, address recipient)
    external
    pure
    returns (bytes memory);
```

### encodeLotteryEntryCall

Generate calldata for bridge + lottery entry in one Solana tx

Use this to build the call attached to bridge transaction


```solidity
function encodeLotteryEntryCall(
    bytes32 solanaPubkey,
    address creatorToken,
    address tokenIn,
    uint256 amountIn,
    uint256 amountOutMin,
    address recipient
) external pure returns (bytes memory);
```

### encodeLotteryEntryWithETHCall


```solidity
function encodeLotteryEntryWithETHCall(
    bytes32 solanaPubkey,
    address creatorToken,
    uint256 amountOutMin,
    address recipient
) external pure returns (bytes memory);
```

### getTwinAddress

Get the deterministic Twin contract address for a Solana wallet

Uses Base bridge's canonical prediction function.


```solidity
function getTwinAddress(bytes32 solanaAddress) external view returns (address twin);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaAddress`|`bytes32`|The Solana wallet pubkey (bytes32)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`twin`|`address`|The Twin contract address on Base|


### mapTwin

Store Twin mapping for reference


```solidity
function mapTwin(bytes32 solanaAddress, address twinAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`solanaAddress`|`bytes32`|Solana address|
|`twinAddress`|`address`|Twin contract on Base|


### _toRemoteAmountExact

Convert a Base token amount (local units) to a Solana remote amount (remote units) exactly.
Rounding rules:
- If conversion would require rounding DOWN (baseDecimals > solanaDecimals and dust exists), revert.
- If conversion would overflow uint256 or uint64, revert.
This keeps bridged amounts unambiguous and prevents silent value loss.


```solidity
function _toRemoteAmountExact(uint256 baseAmount, uint8 baseDecimals, uint8 solanaDecimals)
    internal
    pure
    returns (uint64);
```

### _toUint64


```solidity
function _toUint64(uint256 v) internal pure returns (uint64);
```

### getSolanaMint

Get the Solana mint for a Base token


```solidity
function getSolanaMint(address baseToken) external view returns (bytes32);
```

### getBaseToken

Get the Base token for a Solana mint


```solidity
function getBaseToken(bytes32 solanaMint) external view returns (address);
```

### canBridgeToSolana

Check if a token can be bridged to Solana


```solidity
function canBridgeToSolana(address token) external view returns (bool);
```

### setRegistry


```solidity
function setRegistry(address _registry) external onlyOwner;
```

### setCcaAuctionAllowed


```solidity
function setCcaAuctionAllowed(address auction, bool allowed) external onlyOwner;
```

### emergencyWithdraw

Emergency withdraw stuck tokens


```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner;
```

## Events
### TokenRegistered

```solidity
event TokenRegistered(address indexed baseToken, bytes32 indexed solanaMint);
```

### BridgeToSolana

```solidity
event BridgeToSolana(address indexed from, bytes32 indexed to, address token, uint256 amount);
```

### BridgeFromSolana

```solidity
event BridgeFromSolana(bytes32 indexed from, address indexed to, address token, uint256 amount);
```

### TwinMapped

```solidity
event TwinMapped(bytes32 indexed solanaAddress, address indexed twinAddress);
```

### CcaAuctionAllowed

```solidity
event CcaAuctionAllowed(address indexed auction, bool allowed);
```

### CCABidFromSolana

```solidity
event CCABidFromSolana(
    address indexed twin, address indexed auction, uint256 bidId, uint128 amount, uint256 ethValue
);
```

### CCAClaimed

```solidity
event CCAClaimed(address indexed twin, address indexed auction, uint256 bidId);
```

### CCAExited

```solidity
event CCAExited(address indexed twin, address indexed auction, uint256 bidId);
```

### LotteryEntryFromSolana

```solidity
event LotteryEntryFromSolana(address indexed twin, address indexed recipient, address wsToken, uint256 amount);
```

## Errors
### TokenNotRegistered

```solidity
error TokenNotRegistered();
```

### CreatorCoinNotRegistered

```solidity
error CreatorCoinNotRegistered(address creatorToken);
```

### VaultNotConfigured

```solidity
error VaultNotConfigured(address creatorToken);
```

### VaultAssetMismatch

```solidity
error VaultAssetMismatch(address vault, address expectedAsset, address actualAsset);
```

### DexRouterNotConfigured

```solidity
error DexRouterNotConfigured(uint16 chainId);
```

### CcaAuctionNotAllowed

```solidity
error CcaAuctionNotAllowed(address auction);
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### InvalidAddress

```solidity
error InvalidAddress();
```

### UnauthorizedTwin

```solidity
error UnauthorizedTwin(address caller, address expectedTwin);
```

### BridgeFailed

```solidity
error BridgeFailed();
```

