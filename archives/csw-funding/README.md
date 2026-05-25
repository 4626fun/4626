# Archived: `/csw-funding`

Retired **2026-05-25**. CSW balance diagnostics and EntryPoint / native ETH top-up UI removed from the live app with add-owner and remove-owner retirement.

## What lived here

- **`/csw-funding` page** — `CswFunding.tsx`: read CSW native balance, EntryPoint deposit, RelayDepository total; top up via `EntryPoint.depositTo(csw)` or native ETH transfer.

## Restoring

1. Move `frontend/src/pages/CswFunding.tsx` back into the tree.
2. Re-export `CswFundingPage` in `lazyRoutes.tsx` and register `/csw-funding` in `routeDefinitions.tsx`.
3. Re-add `src/pages/CswFunding.tsx` to the `ethSendTransactionAttribution.guard.test.ts` allowlist if raw `eth_sendTransaction` remains intentional there.
