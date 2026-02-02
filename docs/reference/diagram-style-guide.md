---
title: Diagram style guide
sidebar_position: 10
---

# Diagram style guide

Standards for Mermaid diagrams in 4626 documentation.

---

## Naming conventions

### Token notation

| Symbol | Meaning | Contract |
|--------|---------|----------|
| TOKEN | Creator coin (underlying) | Zora Creator Coin |
| ▢TOKEN | Vault shares | `CreatorOVault` |
| ■TOKEN | Wrapped shares (OFT) | `CreatorShareOFT` |

In diagrams, use the symbol prefix: `■AKITA`, `▢AKITA`, `AKITA`.

### Contract names

Use short, consistent names:

| Full name | Diagram name |
|-----------|--------------|
| CreatorOVault | Vault |
| CreatorOVaultWrapper | Wrapper |
| CreatorShareOFT | ShareOFT |
| CreatorGaugeController | GaugeController |
| CreatorRegistry | Registry |
| VaultGaugeVoting | GaugeVoting |

---

## Diagram types

### A) System architecture (flowchart TD)

Top-down hierarchy for contract relationships.

```mermaid
flowchart TD
    subgraph Core
        Registry[Registry]
        Vault[Vault ▢]
        Wrapper[Wrapper]
        ShareOFT[ShareOFT ■]
    end
    
    subgraph Governance
        Gauge[GaugeController]
        Voting[GaugeVoting]
        VE[ve4626]
    end
    
    Registry --> Vault
    Registry --> ShareOFT
    Vault --> Wrapper
    Wrapper --> ShareOFT
    ShareOFT --> Gauge
    Gauge --> Voting
    Voting --> VE
```

### B) Token flow (flowchart LR)

Left-to-right for processes and transformations.

```mermaid
flowchart LR
    TOKEN[TOKEN] -->|deposit| Vault[Vault]
    Vault -->|mint| VaultShares[▢TOKEN]
    VaultShares -->|wrap| Wrapper[Wrapper]
    Wrapper -->|mint| WrappedShares[■TOKEN]
    
    WrappedShares --> DEX[DEX Trading]
    WrappedShares --> Bridge[Cross-chain]
    WrappedShares --> CCA[CCA Auction]
```

### C) Fee distribution (flowchart TD)

```mermaid
flowchart TD
    Fees[■TOKEN Fees<br/>6.9% of buys] --> Gauge[GaugeController]
    
    Gauge -->|69%| Lottery[Lottery Jackpot]
    Gauge -->|21.39%| Burn[Burn ▢TOKEN]
    Gauge -->|9.61%| Voters[Voter Rewards]
    
    Burn --> PPS[Price Per Share +]
```

### D) Vault lifecycle (stateDiagram-v2)

```mermaid
stateDiagram-v2
    [*] --> Idle: deposit
    Idle --> Deployed: deployToStrategies
    Deployed --> Idle: withdraw
    Deployed --> Harvested: harvest
    Harvested --> Deployed: rebalance
    Deployed --> [*]: emergencyWithdraw
```

### E) Strategy relationships (flowchart LR)

Shows how the underlying creatorCoin flows to strategies. Note: strategies never receive vault shares.

```mermaid
flowchart LR
    subgraph Asset
        C[creatorCoin]
    end
    
    subgraph Vault
        V[CreatorOVault]
    end
    
    subgraph Strategies
        Charm[CharmStrategy]
        Ajna[AjnaStrategy]
    end
    
    subgraph External
        AjnaPool[Ajna Pools]
        CharmVault[Charm Vaults]
    end
    
    V -->|allocates| C
    C -->|supplies| Charm
    C -->|supplies| Ajna
    
    Charm --> CharmVault
    Ajna --> AjnaPool
```

### F) Governance flow (sequenceDiagram)

```mermaid
sequenceDiagram
    participant User
    participant ve4626
    participant GaugeVoting
    participant GaugeController
    
    User->>ve4626: lock(■TOKEN, duration)
    ve4626-->>User: NFT position
    
    User->>GaugeVoting: vote(vaults, weights)
    GaugeVoting-->>GaugeController: update probability
    
    Note over GaugeController: Epoch ends
    
    User->>GaugeController: claim(epoch)
    GaugeController-->>User: rewards
```

---

## Style rules

### Subgraph grouping

Group related nodes by domain:

```mermaid
flowchart TD
    subgraph Core["Core Contracts"]
        A[Vault]
        B[Wrapper]
    end
    
    subgraph Gov["Governance"]
        C[GaugeController]
        D[ve4626]
    end
    
    A --> C
```

### Node shapes

| Shape | Use for |
|-------|---------|
| `[text]` | Contracts, standard nodes |
| `([text])` | External protocols |
| `{text}` | Decision points |
| `[[text]]` | Subprocesses |

### Edge labels

Keep labels short (1-3 words). Move details to prose.

```mermaid
flowchart LR
    A -->|deposit| B
    B -->|mint| C
```

Not:

```mermaid
flowchart LR
    A -->|user deposits TOKEN into vault| B
```

### Colors (optional)

Use sparingly for emphasis:

```mermaid
flowchart LR
    A[Input]:::input --> B[Process] --> C[Output]:::output
    
    classDef input fill:#e1f5fe
    classDef output fill:#e8f5e9
```

---

## When to use each type

| Diagram type | Use when |
|--------------|----------|
| flowchart TD | Showing hierarchy or ownership |
| flowchart LR | Showing data/token flow |
| stateDiagram-v2 | Showing lifecycle states |
| sequenceDiagram | Showing time-ordered interactions |

---

## Anti-patterns

Avoid these:

1. **Too many nodes** - Split into multiple diagrams
2. **Crossing edges** - Reorder nodes to eliminate
3. **Long labels** - Move to prose
4. **Redundant diagrams** - One diagram per concept
5. **Decorative elements** - Every element must inform

---

## Asset flow rule

> **If a diagram shows ▢[creatorCoin] or ■[creatorCoin] entering a strategy, the diagram is incorrect.**
> **Strategies only ever receive the underlying creatorCoin.**

The canonical asset flow diagram lives in [Architecture](/overview/architecture). All other pages should link to it, not redraw variants.

---

## Diagram categories

Diagrams must belong to exactly one category. Never mix these:

| Category | Shows | Does NOT show |
|----------|-------|---------------|
| **Asset flow** | creatorCoin movement | ▢/■ tokens, governance |
| **Accounting & representation** | ▢/■ token relationships | creatorCoin, strategies |
| **Governance & deployment** | Roles, permissions, lifecycle | Asset flows |

Most confusion comes from mixing categories. If you need to show multiple concerns, use separate diagrams.

---

## Templates

Copy-paste ready templates for common diagrams.

### Minimal token flow

```mermaid
flowchart LR
    TOKEN -->|deposit| Vault
    Vault -->|shares| User
```

### Minimal fee flow

```mermaid
flowchart TD
    Fees --> Controller
    Controller --> A[Lottery]
    Controller --> B[Burn]
    Controller --> C[Voters]
```

### Minimal architecture

```mermaid
flowchart LR
    C[creatorCoin] -->|deposit| V[Vault]
    V -->|allocates| C
    C -->|supplies| S[Strategies]
    V -->|wrap| OFT[ShareOFT]
```

Note: The vault allocates creatorCoin to strategies, not vault shares.
