---
title: LayerZero OFT
sidebar_position: 1
---

# LayerZero OFT integration

CreatorShareOFT enables cross-chain transfers of vault shares via LayerZero.

**Who this is for:** Developers implementing cross-chain functionality.

---

## Overview

When users wrap their vault shares (▢TOKEN), they receive ■TOKEN which is an OFT (Omnichain Fungible Token) that can be transferred across chains.

```
▢TOKEN (vault shares)
    |
    v [wrap via CreatorOVaultWrapper]
■TOKEN (CreatorShareOFT)
    |
    v [LayerZero bridge]
■TOKEN on destination chain
```

---

## Token notation

| Token | Symbol | Transferable |
|-------|--------|--------------|
| Vault shares | ▢TOKEN | Same chain only |
| Wrapped shares | ■TOKEN | Cross-chain via LayerZero |

---

## Contracts

### CreatorShareOFT

`contracts/services/messaging/CreatorShareOFT.sol`

Implements LayerZero OFT V2 standard with additional features:
- Buy/sell fee mechanism (6.9% fee on buys)
- Lottery trigger on purchases
- Registry integration for vault lookups

### CreatorOVaultWrapper

`contracts/vault/CreatorOVaultWrapper.sol`

Handles wrapping/unwrapping between vault shares and OFT:
- `wrap(amount)` - Convert ▢TOKEN to ■TOKEN
- `unwrap(amount)` - Convert ■TOKEN to ▢TOKEN

---

## Cross-chain flow

### Sending tokens

```solidity
// 1. Approve OFT contract
shareOFT.approve(address(shareOFT), amount);

// 2. Estimate fees
(uint256 nativeFee, ) = shareOFT.estimateSendFee(
    dstChainId,
    toAddressBytes,
    amount,
    false,
    adapterParams
);

// 3. Send tokens
shareOFT.sendFrom{value: nativeFee}(
    msg.sender,
    dstChainId,
    toAddressBytes,
    amount,
    payable(msg.sender),
    address(0),
    adapterParams
);
```

### Receiving tokens

Tokens arrive automatically via LayerZero's relayer network. The destination chain's OFT contract mints tokens to the recipient.

---

## Fee structure

### Buy fee (6.9%)

When ■TOKEN is purchased on a DEX:
- 6.9% of the purchase is collected as fees
- Fees are distributed via CreatorGaugeController
- Lottery entry is triggered for buyer

### No sell fee

Selling ■TOKEN does not incur additional fees beyond DEX swap fees.

---

## Registry integration

CreatorShareOFT integrates with CreatorRegistry for:
- Vault lookups via `getVaultForShareOFT()`
- Token lookups via `getTokenForShareOFT()`
- Lottery manager resolution via `getLotteryManager()`

---

## Supported chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Base | 8453 | Primary |
| Additional chains | TBD | Planned |

---

## References

- [LayerZero OFT documentation](https://layerzero.gitbook.io/docs/evm-guides/layerzero-omnichain-contracts/oft)
- [Fee flow](/overview/fee-flow)
