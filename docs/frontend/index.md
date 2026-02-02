---
title: Frontend
sidebar_position: 3
---

# Frontend

Documentation for the 4626 frontend application.

**Who this is for:** Frontend developers and integrators.

---

## Overview

The frontend is a React application built with:
- Vite for bundling
- Wagmi for wallet connections
- Privy for authentication
- TanStack Query for data fetching

---

## Key features

| Feature | Description |
|---------|-------------|
| Vault dashboard | View and manage creator vaults |
| Deposit/withdraw | ERC-4626 compliant interactions |
| Account abstraction | 1-click operations via smart wallets |
| Cross-chain | LayerZero OFT transfers |

---

## Directory structure

```
frontend/src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── lib/            # Utility libraries
├── config/         # Configuration files
├── pages/          # Route pages
└── types/          # TypeScript types
```

---

## Configuration

Contract addresses are configured in `frontend/src/config/contracts.ts`.

See the [API Reference](/api/frontend) for auto-generated TypeScript documentation.

---

## Key components

| Component | Purpose |
|-----------|---------|
| `LaunchVaultAA` | 1-click vault activation |
| `CompleteAuction` | Auction graduation flow |
| `VaultDashboard` | Vault overview and stats |
| `DepositWithdraw` | ERC-4626 deposit/withdraw UI |

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useVault` | Vault data and operations |
| `useTokenMetadata` | Token information |
| `useSiweAuth` | Sign-in with Ethereum |
| `useVaultGaugeVoting` | Governance voting |

See [Frontend API](/api/frontend) for complete documentation.
