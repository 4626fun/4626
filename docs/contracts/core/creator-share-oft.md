---
title: CreatorShareOFT
sidebar_position: 3
---

# CreatorShareOFT

LayerZero OFT (Omnichain Fungible Token) for cross-chain share transfers with integrated buy fee and lottery.

**Source:** `contracts/services/messaging/CreatorShareOFT.sol`

---

## Overview

CreatorShareOFT is the user-facing tradeable token (■TOKEN). It wraps vault shares for cross-chain transfers via LayerZero and implements a 6.9% buy fee that funds the lottery jackpot.

---

## Key features

- **Cross-chain** - Transfer to any supported chain via LayerZero
- **Buy fee** - 6.9% on DEX purchases routes to GaugeController
- **Lottery integration** - Buyers automatically enter jackpot draw
- **Address classification** - Smart fee detection for buys vs sells

---

## Buy fee mechanism

### Detection

The contract classifies addresses to detect buys:

```solidity
enum OperationType {
    Unknown,   // Normal transfer - no fees
    SwapOnly,  // DEX pool/router - buys = fee
    NoFees     // Vault, controller - exempt
}
```

### Fee flow

```
Buy detected (SwapOnly → User)
        │
        ▼
Calculate fee: amount × 6.9%
        │
        ├─► 93.1% → Buyer
        └─► 6.9% → GaugeController
                        │
                        ├─► 69% Lottery
                        ├─► 21.39% Burn
                        └─► 9.61% Voters
```

### No fee cases

- Sells (User → SwapOnly)
- Normal transfers (User → User)
- Exempt addresses (vault, controller)

---

## Functions

### Minting/Burning

Only vault and authorized minters can mint/burn:

```solidity
// Mint shares (vault/minter only)
function mint(address to, uint256 amount) external;

// Burn shares (vault/minter only)
function burn(address from, uint256 amount) external;
```

### Transfers

Standard ERC-20 with fee detection:

```solidity
// Transfer with fee detection
function transfer(address to, uint256 amount) public returns (bool);

// Transfer from with fee detection
function transferFrom(address from, address to, uint256 amount) 
    public returns (bool);
```

### Cross-chain

LayerZero OFT standard:

```solidity
// Send to another chain
function send(
    SendParam calldata _sendParam,
    MessagingFee calldata _fee,
    address _refundAddress
) external payable returns (MessagingReceipt memory, OFTReceipt memory);

// Quote messaging fee
function quoteSend(
    SendParam calldata _sendParam,
    bool _payInLzToken
) external view returns (MessagingFee memory);
```

### Admin

```solidity
// Set address classification (owner)
function setAddressType(address addr, OperationType opType) external;

// Batch set classifications (owner)
function setAddressTypes(address[] calldata addrs, OperationType opType) external;

// Set gauge controller (owner)
function setGaugeController(address controller) external;

// Set buy fee (owner, max 10%)
function setBuyFee(uint16 feeBps) external;

// Enable/disable fees (owner)
function setFeesEnabled(bool enabled) external;

// Enable/disable lottery (owner)
function setLotteryEnabled(bool enabled) external;
```

### View functions

```solidity
// Preview fee for transfer
function previewFee(address from, address to, uint256 amount) 
    external view returns (bool isBuy, uint256 fee);

// Check if address is trading venue
function isTradingVenue(address addr) external view returns (bool);

// Convert shares to underlying value
function convertToAssets(uint256 shares) public view returns (uint256);
```

---

## State

```solidity
// Core
ICreatorRegistry public registry;
address public vault;
address public gaugeController;

// Fees
uint16 public buyFeeBps = 690;  // 6.9%
bool public feesEnabled = true;
bool public lotteryEnabled = true;

// Address classification
mapping(address => OperationType) public addressType;

// Minting
mapping(address => bool) public isMinter;
```

---

## Events

```solidity
event SharesMinted(address indexed to, uint256 amount);
event SharesBurned(address indexed from, uint256 amount);
event BuyFee(address indexed from, address indexed to, uint256 amount, uint256 fee);
event FeeCollected(address indexed gaugeController, uint256 amount);
event LotteryTriggered(address indexed buyer, uint256 amount, uint256 requestId);
event AddressTypeSet(address indexed addr, OperationType opType);
```

---

## Cross-chain setup

### Peer configuration

Each chain's ShareOFT must know its peers:

```solidity
// On Base
shareOFT.setPeer(arbitrumEid, bytes32(arbitrumShareOFT));

// On Arbitrum  
shareOFT.setPeer(baseEid, bytes32(baseShareOFT));
```

### Bridging tokens

```solidity
// Bridge 100 ■AKITA to Arbitrum
SendParam memory params = SendParam({
    dstEid: arbitrumEid,
    to: bytes32(uint256(uint160(recipient))),
    amountLD: 100e18,
    minAmountLD: 99e18,  // 1% slippage
    extraOptions: "",
    composeMsg: "",
    oftCmd: ""
});

MessagingFee memory fee = shareOFT.quoteSend(params, false);
shareOFT.send{value: fee.nativeFee}(params, fee, msg.sender);
```

---

## Integration

### DEX setup

Register DEX pools as SwapOnly:

```solidity
// Single address
shareOFT.setAddressType(uniswapPool, OperationType.SwapOnly);

// Batch
address[] memory pools = [pool1, pool2, router];
shareOFT.setAddressTypes(pools, OperationType.SwapOnly);
```

### Fee exemptions

```solidity
// Exempt an address from fees
shareOFT.setAddressType(trustedContract, OperationType.NoFees);
```

### Fee preview

```solidity
// Check if transfer incurs fee
(bool isBuy, uint256 fee) = shareOFT.previewFee(from, to, amount);

if (isBuy) {
    // User will pay fee, receiving amount - fee
}
```

---

## Related

- [Token Model](/overview/token-model) - ■TOKEN explained
- [Fee Flow](/overview/fee-flow) - Fee distribution
- [Cross-chain](/integrations/oft) - LayerZero integration
