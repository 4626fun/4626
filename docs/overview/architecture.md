---
title: Architecture
sidebar_position: 3
---

# System architecture

Contract hierarchy and relationships in the 4626 protocol.

<div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', opacity: 0.8}}>
  <img src="/brands/base/base-logomark.svg" width="20" height="20" alt="Base" />
  <span>Deployed on Base (Chain ID: 8453)</span>
</div>

---

## Asset and strategy flow

This is the canonical diagram for understanding how assets move through the system.

```mermaid
flowchart LR
    U[Users]
    V[CreatorOVault<br/>▢ creatorCoin]
    C[creatorCoin]

    subgraph Strategies["Yield Strategies"]
        A[Ajna]
        CH[Charm V3]
        O[Other]
    end

    U -->|deposit creatorCoin| V
    V -->|mint/burn ▢shares| U

    V -->|allocate creatorCoin| C
    C -->|supply creatorCoin| A
    C -->|supply creatorCoin| CH
    C -->|supply creatorCoin| O
```

### Legend

| Symbol | Meaning |
|--------|---------|
| **creatorCoin** | Underlying ERC-20 asset (the only thing strategies receive) |
| **▢[creatorCoin]** | ERC-4626 vault shares (accounting only, never enters strategies) |
| **■[creatorCoin]** | Wrapped OFT representation (bridging and UX, never enters strategies) |

> **Invariant:** Yield strategies operate exclusively on the underlying creatorCoin.
> Vault shares (▢[creatorCoin]) and wrapped OFT shares (■[creatorCoin]) are accounting and representation layers only and are never deposited into strategies.

---

## Layer separation

The protocol has three orthogonal layers:

### Asset layer

The underlying creatorCoin (ERC-20) is the only asset that moves between contracts. When users deposit, the vault receives creatorCoin. When strategies deploy capital, they receive creatorCoin. All yield is generated on creatorCoin.

### Accounting layer

- **CreatorOVault** issues ▢[creatorCoin] as receipt tokens for deposits
- **CreatorShareOFT** wraps ▢[creatorCoin] into ■[creatorCoin] for trading and bridging

These tokens track ownership but never leave the accounting layer. Strategies are unaware of their existence.

### Yield execution layer

Strategies (Ajna, Charm, etc.) receive creatorCoin from the vault, deploy it to external protocols, and return creatorCoin (plus yield) when harvested.

---

## Core contracts

| Contract | Purpose | Documentation |
|----------|---------|---------------|
| CreatorOVault | ERC-4626 vault, issues ▢TOKEN | [Details](/contracts/core/creator-ovault) |
| CreatorOVaultWrapper | Converts ▢TOKEN ↔ ■TOKEN | [Details](/contracts/core/creator-ovault-wrapper) |
| CreatorShareOFT | LayerZero OFT, collects fees | [Details](/contracts/core/creator-share-oft) |
| CreatorRegistry | Global registry | [API](/api/contracts) |

---

## Supporting systems

| System | Canonical documentation |
|--------|------------------------|
| Fee distribution | [Fee Flow](/overview/fee-flow) |
| Strategies | [Strategies](/contracts/strategies) |
| Governance | [Governance](/governance) |
| Cross-chain | [LayerZero OFT](/integrations/oft) |
| Security | [Vault Concepts](/concepts/vault) |

---

## Access control

```mermaid
flowchart TD
    subgraph Roles
        Owner[Owner<br/>creator multisig]
        Mgmt[Management<br/>operator]
        Keeper[Keeper<br/>automation]
        Emergency[Emergency Admin]
    end
    
    Owner --> |full control| Vault[Vault]
    Owner --> |strategy mgmt| Strategies
    Owner --> |shutdown| Emergency
    
    Mgmt --> |parameters| Strategies
    Mgmt --> |assign| Keeper
    
    Keeper --> |deploy| Strategies
    Keeper --> |report| Vault
    
    Emergency --> |pause| Vault
    Emergency --> |withdraw| Strategies
```

---

## Deployment addresses

See [Reference: Addresses](/reference/addresses).
