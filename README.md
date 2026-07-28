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
| `apps/docs-site/` | Documentation site |
| `contracts/` | Solidity — vaults, gauges, lottery, OFT |
| `docs/` | Public documentation source |
| `frontend/` | Vite/React app and API |
| `indexer/` | Chain indexing tooling |
| `kpr/` | Keeper / automation workflows |
| `programs/` | Solana programs (creator share hook and related) |
| `supabase/` | Database migrations and config |

Source migration into this repository is staged. Production hosting (Vercel, Railway, Supabase) remains on the existing private working tree until cutover.

## Public contracts pin (ODA / research)

Auditor-facing Solidity lives under [`contracts/`](contracts/) on **`main`**.

Private `wenakita/4626` remains the build/deploy source of truth. Publishing here ≠ Base redeploy.

## Sponsors

Solana sponsor market for this open repo ([Tribe.run](https://www.tribe.run)) — not the Base protocol token (`$4626`) and not vault shares.

Name **4626fun**, symbol **4626FUN**. Holding at least 10,000 tokens counts as a sponsor.

<!-- hypertribe:sponsors:start -->
[![4626 Sponsors](https://api.tribe.run/tokens/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8/sponsors.svg)](https://tribe.run/token/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8)

Become a sponsor on [Tribe.run](https://tribe.run/token/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8).
<!-- hypertribe:sponsors:end -->

## License

[MIT](LICENSE) — Copyright (c) AKITA, LLC

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities to **hello@4626.fun**.
