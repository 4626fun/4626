---
title: Architecture
sidebar_position: 3
---

# System architecture

Contract hierarchy and relationships in the 4626 protocol.

---

## Contract hierarchy

```mermaid
flowchart TD
    subgraph Registry["Global Registry"]
        R[CreatorRegistry]
    end
    
    subgraph Core["Core Contracts"]
        Vault[CreatorOVault<br/>▢TOKEN]
        Wrapper[Wrapper]
        ShareOFT[CreatorShareOFT<br/>■TOKEN]
    end
    
    subgraph Strategies["Yield Strategies"]
        CCA[CCA Launch]
        Charm[Charm V3]
        Ajna[Ajna]
    end
    
    subgraph Governance["Governance"]
        Gauge[GaugeController]
        Voting[VaultGaugeVoting]
        VE[ve4626]
        Rewards[VoterRewards]
    end
    
    R --> Vault
    R --> ShareOFT
    Vault --> Wrapper
    Wrapper --> ShareOFT
    Vault --> CCA
    Vault --> Charm
    Vault --> Ajna
    ShareOFT --> Gauge
    Gauge --> Voting
    Voting --> VE
    Gauge --> Rewards
```

**Legend:** ▢ = vault shares, ■ = wrapped OFT shares

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
