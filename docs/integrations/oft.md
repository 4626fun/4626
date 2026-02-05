---
title: OFT Integration
sidebar_position: 1
---

# LayerZero OFT Integration

Guide to integrating with CreatorShareOFT for cross-chain transfers.

## Overview

CreatorShareOFT is a LayerZero V2 Omnichain Fungible Token that enables:
- Cross-chain transfers
- Unified liquidity across chains
- Same token address derivation

## Sending Cross-Chain

```solidity
SendParam memory sendParams = SendParam({
    dstEid: 30110, // Arbitrum
    to: addressToBytes32(recipient),
    amountLD: amount,
    minAmountLD: amount * 99 / 100, // 1% slippage
    extraOptions: "",
    composeMsg: "",
    oftCmd: ""
});

// Quote the fee
MessagingFee memory fee = shareOFT.quoteSend(sendParams, false);

// Execute send
shareOFT.send{value: fee.nativeFee}(sendParams, fee, msg.sender);
```

## Supported Chains

| Chain | Endpoint ID |
|-------|-------------|
| Base | 30184 |
| Ethereum | 30101 |
| Arbitrum | 30110 |
| BSC | 30102 |
| Avalanche | 30106 |

## Fee Behavior

- **Cross-chain transfers**: No 6.9% fee (only LayerZero gas)
- **DEX trades**: 6.9% fee applies
- **Wrap/unwrap**: No fee

## Tracking Transfers

Monitor transfers on [LayerZero Scan](https://layerzeroscan.com).
