---
title: Frontend
sidebar_position: 10
---

# Frontend Documentation

Documentation for the CreatorVault frontend application.

## Tech Stack

- **Vite** - Build tool
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **wagmi/viem** - Ethereum interactions

## Structure

```
frontend/
  src/
    components/    # UI components
    pages/         # Route pages
    hooks/         # Custom React hooks
    lib/           # Utilities and APIs
    config/        # Configuration
  public/          # Static assets
  api/             # Vercel API routes
```

## Development

```bash
cd frontend
pnpm install
pnpm dev
```

## API Reference

See [Frontend API](/api/frontend) for auto-generated TypeDoc documentation.

## Key Components

| Component | Purpose |
|-----------|---------|
| `DeployPage` | Vault deployment wizard |
| `VaultDashboard` | Vault management UI |
| `LotteryStatus` | Lottery information display |
| `TradeWidget` | DEX trading interface |

## Hooks

| Hook | Purpose |
|------|---------|
| `useVault` | Vault interactions |
| `useLottery` | Lottery data |
| `useCreatorCoin` | Token information |
| `useMiniAppContext` | Farcaster frame context |
