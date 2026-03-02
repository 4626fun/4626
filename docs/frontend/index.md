---
title: Frontend
sidebar_position: 10
---

# Frontend Documentation

Documentation for the 4626 frontend application.

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

### UI System

- Shared design system package: `frontend/packages/brand-kit`
- Tailwind preset source: `@4626/brand-kit/tailwind-preset` (consumed by `frontend/tailwind.config.js`)
- Shared CSS contract: `@4626/brand-kit/styles` (imported in `frontend/src/main.tsx`)
- Primitive ownership: `Button` and `Card` live in `@4626/brand-kit/components`; app `src/components/ui/*` files act as compatibility re-exports

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
