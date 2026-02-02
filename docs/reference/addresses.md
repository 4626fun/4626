---
title: Contract addresses
sidebar_position: 1
---

# Contract addresses

Deployed contract addresses by network.

---

## Base Mainnet (8453)

### Infrastructure

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x...` |
| Create2Deployer | `0x...` |
| VaultActivationBatcher | `0x...` |

### Governance

| Contract | Address |
|----------|---------|
| ve4626 | `0x...` |
| VaultGaugeVoting | `0x...` |
| VoterRewardsDistributor | `0x...` |
| BribesFactory | `0x...` |

### External contracts

| Contract | Address |
|----------|---------|
| Uniswap V3 Router | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Uniswap CCA Factory | `0xcca1101C61cF5cb44C968947985300DF945C3565` |
| WETH | `0x4200000000000000000000000000000000000006` |
| LayerZero Endpoint | `0x...` |

---

## Per-vault contracts

Each creator vault has its own set of contracts:

| Contract | Description |
|----------|-------------|
| CreatorOVault | ERC-4626 vault (also ▢TOKEN) |
| CreatorOVaultWrapper | ▢TOKEN ↔ ■TOKEN converter |
| CreatorShareOFT | ■TOKEN (LayerZero OFT) |
| CreatorGaugeController | Fee distribution |
| Strategies | CCA, Charm, Ajna, etc. |

### Example: AKITA vault

| Contract | Address |
|----------|---------|
| AKITA (TOKEN) | `0x...` |
| CreatorOVault (▢AKITA) | `0x...` |
| CreatorOVaultWrapper | `0x...` |
| CreatorShareOFT (■AKITA) | `0x...` |
| CreatorGaugeController | `0x...` |

---

## Base Sepolia (84532)

Testnet deployments for development:

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x...` |
| Create2Deployer | `0x...` |
| Test Token | `0x...` |
| Test Vault | `0x...` |

---

## Cross-chain deployments

■TOKEN contracts are deployed to the same address on all chains via CREATE2:

| Chain | EID | Address |
|-------|-----|---------|
| Base | 30184 | `0x...` |
| Arbitrum | 30110 | `0x...` |
| Optimism | 30111 | `0x...` |

---

## Verification

All contracts are verified on:
- [Basescan](https://basescan.org/)
- [Sourcify](https://sourcify.dev/)

---

## Finding addresses

### From registry

```solidity
ICreatorRegistry registry = ICreatorRegistry(REGISTRY_ADDRESS);

// Get vault for a creator coin
address vault = registry.getVault(creatorCoin);

// Get wrapper
address wrapper = registry.getWrapper(creatorCoin);

// Get ShareOFT
address shareOFT = registry.getShareOFT(creatorCoin);
```

### From frontend config

See `frontend/src/config/contracts.ts` for current addresses.

---

## Address updates

Contract addresses are updated in:
1. This documentation
2. Frontend config
3. CreatorRegistry (on-chain)

For the latest addresses, query the CreatorRegistry contract.
