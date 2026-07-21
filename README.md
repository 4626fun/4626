# 4626

[4626.fun](https://4626.fun) is a Base-native protocol for launching creator-centered vault economies. It combines ERC-4626 vaults, cross-chain OFT share tokens, and fee-driven incentive mechanics.

| | |
| --- | --- |
| App | [app.4626.fun](https://app.4626.fun) |
| Docs | [docs.4626.fun](https://docs.4626.fun) |
| Site | [4626.fun](https://4626.fun) |

## Repository layout

This monorepo is the public face of the 4626 product. Package directories:

| Path | Role |
| --- | --- |
| `frontend/` | Vite/React app and API |
| `contracts/` | Solidity — vaults, gauges, lottery, OFT |
| `programs/` | Solana programs (creator share hook and related) |
| `kpr/` | Keeper / automation workflows |
| `indexer/` | Chain indexing tooling |
| `supabase/` | Database migrations and config |
| `apps/docs-site/` | Documentation site |
| `docs/` | Public documentation source |

Source migration into this repository is staged. Production hosting (Vercel, Railway, Supabase) remains on the existing private working tree until cutover.

## Sponsors

<!-- Tribe.run sponsor badge will appear here after token launch -->

## License

[MIT](LICENSE) — Copyright (c) AKITA, LLC

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities to **keepr@4626.fun**.
