---
title: Contracts
sidebar_position: 3
---

# Smart contracts

This section documents the public-facing smart contracts in the 4626 protocol.

---

## Contract taxonomy

### Core

The foundational contracts that implement the vault system:

| Contract | Purpose |
|----------|---------|
| [CreatorOVault](./core/creator-ovault) | ERC-4626 vault for creator coins |
| [CreatorOVaultWrapper](./core/creator-ovault-wrapper) | Converts ▢TOKEN ↔ ■TOKEN |
| [CreatorShareOFT](./core/creator-share-oft) | LayerZero OFT for cross-chain |
| CreatorRegistry | Global registry of vaults and tokens |

### Strategies

Capital deployment strategies:

| Contract | Asset | Purpose |
|----------|-------|---------|
| [CCALaunchStrategy](./strategies/cca-launch) | ■TOKEN | Fair launch via CCA |
| CreatorCharmStrategy | TOKEN | V3 LP via Charm |
| AjnaStrategy | TOKEN | Lending pools |
| V4 Strategies | TOKEN | V4 liquidity |

### Governance

ve(3,3) governance system:

| Contract | Purpose |
|----------|---------|
| [CreatorGaugeController](./governance/gauge-controller) | Fee distribution |
| [VaultGaugeVoting](./governance/vault-gauge-voting) | Epoch voting |
| [ve4626](./governance/ve4626) | Vote-escrowed tokens |
| VoterRewardsDistributor | Voter rewards |
| BribeDepot | External bribes |

### Services

Supporting infrastructure:

| Contract | Purpose |
|----------|---------|
| CreatorLotteryManager | Jackpot system |
| CreatorOracle | Price feeds |
| SolanaBridgeAdapter | Solana bridge |

### Helpers

Deployment and automation:

| Contract | Purpose |
|----------|---------|
| VaultActivationBatcher | 1-click activation |
| CreatorVaultDeployer | Full deployment |
| Create2Deployer | Deterministic addresses |

---

## Architecture

```
                    ┌─────────────────────┐
                    │   CreatorRegistry   │
                    │   (global state)    │
                    └─────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  CreatorOVault  │  │ CreatorShareOFT │  │   Governance    │
│   (ERC-4626)    │  │  (LayerZero)    │  │   Contracts     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    │
┌─────────────────┐  ┌─────────────────┐          │
│   Strategies    │  │ GaugeController │◄─────────┘
└─────────────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ LotteryManager  │
                    └─────────────────┘
```

---

## Sections

| Section | Contents |
|---------|----------|
| [Core](./core) | Vault, Wrapper, ShareOFT |
| [Strategies](./strategies) | CCA, Charm, Ajna, V4 |
| [Governance](./governance) | GaugeController, Voting, ve4626 |

For lottery mechanics, see [Concepts: Lottery](/concepts/lottery).

---

## Deployment

For deployment guides, see:
- [Deploy Vault Guide](/guides/deploy-vault)
- [Launch Token Guide](/guides/launch-token)
- [Operations](/operations)

---

## API reference

For complete function signatures and NatSpec documentation, see:
- [Contract API](/api/contracts) - Auto-generated from NatSpec
- [Frontend API](/api/frontend) - TypeScript interfaces
