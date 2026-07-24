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

## Virtuals ACP (public adapter slice)

Payment-gated Virtuals ACP jobs for counter-trade signals, research, and backtests live under:

- [`frontend/server/agents/eliza/plugins/virtuals/`](frontend/server/agents/eliza/plugins/virtuals/) — payment gate, tool quotas, observe-only defaults, readiness, colocated tests
- [`frontend/scripts/agent/virtuals-acp-doctor.ts`](frontend/scripts/agent/virtuals-acp-doctor.ts) — redacted readiness doctor

**Offering focus:** paid counter-trade signals on Virtuals ACP (inverse bias), observe-only until funded. Live AlfaClub/Hermit execution is a separate ops lane and is not required to review this slice.

From a full frontend workspace (after dependencies are installed):

```bash
pnpm -C frontend exec vitest run server/agents/eliza/plugins/virtuals
```

Env var **names** only for the doctor (never commit values): `VIRTUALS_ACP_ENABLED`, `VIRTUALS_ACP_WALLET_ADDRESS`, `VIRTUALS_ACP_WALLET_ID`, `VIRTUALS_ACP_SIGNER_PRIVATE_KEY`, `VIRTUALS_API_KEY`. Default posture is observe-only (`VIRTUALS_ACP_AUTO_LLM=0`).

## Sponsors

Solana sponsor market for this open repo ([Tribe.run](https://www.tribe.run)) — not the Base protocol token (`$4626`) and not vault shares.

When live: name **4626fun**, symbol **4626FUN**. Holding at least 10,000 tokens counts as a sponsor.

<!-- Tribe.run sponsor badge will appear here after token launch -->

## License

[MIT](LICENSE) — Copyright (c) AKITA, LLC

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities to **hello@4626.fun**.

<!-- hypertribe:sponsors:start -->
## Sponsors

[![4626 Sponsors](https://api.tribe.run/tokens/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8/sponsors.svg)](https://tribe.run/token/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8)

Become a sponsor on [Tribe.run](https://tribe.run/token/9U22WPWvtnrAge4EKphWcJF1vCNBi83MsXN6n1jc53P8).
<!-- hypertribe:sponsors:end -->
