---
title: Integrations
sidebar_position: 5
---

# Integrations

Cross-chain and external system integrations for 4626.

---

## Cross-chain

| Integration | Description |
|-------------|-------------|
| [LayerZero OFT](./oft) | Cross-chain share transfers |
| [Solana bridge](./solana-integration) | Solana ecosystem bridge |

---

## LayerZero OFT

■TOKEN uses LayerZero's OFT standard for cross-chain transfers:

```
Base ■AKITA ──► LayerZero ──► Arbitrum ■AKITA
     (burn)                        (mint)
```

### Supported chains

| Chain | EID | Status |
|-------|-----|--------|
| Base | 30184 | Production |
| Arbitrum | 30110 | Planned |
| Optimism | 30111 | Planned |

### Usage

```solidity
// Send ■TOKEN cross-chain
shareOFT.send(
    dstEid,           // Destination chain
    recipient,        // Receiver
    amount,           // Token amount
    options,          // LZ options
    fee,              // Messaging fee
    refundAddress     // Refund address
);
```

---

## Related

- [Token model](/overview/token-model) - ■TOKEN explained
- [CreatorShareOFT](/contracts/core/creator-share-oft) - Contract details
