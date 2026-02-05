---
title: Architecture
sidebar_position: 2
---

# System Architecture

CreatorVault's architecture is built for **provenance, identity, and execution**.

## System Components

Onchain, CreatorVault consists of:

- **Shared infrastructure** (deployed once per chain, referenced via `CreatorRegistry`)
- **Per-creator vault stack** (deployed per creator coin)
- **Optional incentives layer** (ve(3,3) voting, voter rewards, bribes)

## Contract Relationships

```mermaid
graph TD
    A[Creator Coin] -->|deposit| B[CreatorOVault]
    B -->|mint shares| C[▢TOKEN Vault Shares]
    C -->|wrap| D[CreatorOVaultWrapper]
    D -->|mint OFT| E[■TOKEN ShareOFT]
    E -->|bridge| F[LayerZero V2]
    E -->|trade fee| G[CreatorGaugeController]
    G -->|69%| H[Lottery Prize Pool]
    G -->|21.39%| I[Burn - PPS Increase]
    G -->|9.61%| J[Voter Rewards]
    H --> K[CreatorLotteryManager]
    K -->|VRF| L[Chainlink VRF]
```

## Deployment Flow

```
User clicks "Deploy" → wallet/bundler executes a phased sequence

Phase 1 — Deterministic deploy (CreatorVaultDeployer):
- Deploy per-creator contracts
- Register in CreatorRegistry

Phase 2 — Configuration:
- Wire roles + addresses
- Set required approvals

Phase 3 — Activation + launch:
- Deposit → wrap → start CCA
- Execute via VaultActivationBatcher
```

## Hub Chain Model

**Base is the hub chain** - all deployments start on Base, then OFT can be bridged to other chains.

### Cross-Chain Flow

1. Deploy vault, wrapper, OFT on Base
2. Configure lottery and gauge controller
3. Start CCA auction
4. Users bridge ■TOKEN via LayerZero V2
5. Trading on any chain triggers lottery entries
6. Winners notified cross-chain via LayerZero
