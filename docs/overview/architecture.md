---
title: Architecture
sidebar_position: 3
---

# System architecture

Contract hierarchy and relationships in the 4626 protocol.

---

## Contract hierarchy

```
                         ┌─────────────────────┐
                         │   CreatorRegistry   │
                         │  (global registry)  │
                         └─────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────┐        ┌─────────────────┐
│  CreatorOVault  │      │ CreatorShareOFT │        │  Governance     │
│   (ERC-4626)    │      │  (LayerZero)    │        │  Contracts      │
└─────────────────┘      └─────────────────┘        └─────────────────┘
       │                         │                         │
       ├─► Strategies            ├─► GaugeController       ├─► VaultGaugeVoting
       ├─► Wrapper               └─► LotteryManager        ├─► ve4626
       └─► Accounting                                      └─► VoterRewards
```

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

```
Owner (creator multisig)
├─► Full vault control
├─► Strategy management
└─► Emergency shutdown

Management (operator)
├─► Strategy parameters
└─► Keeper management

Keeper (automation)
├─► Deploy to strategies
└─► Report profit/loss

Emergency Admin
├─► Pause operations
└─► Emergency withdrawal
```

---

## Deployment addresses

See [Reference: Addresses](/reference/addresses).
