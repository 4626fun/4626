# Operator terminology map

Internal runbooks use shorthand that differs from creator-facing docs at [docs.4626.fun](https://docs.4626.fun). Use this map when editing ops docs or talking to creators.

| Creator-facing (public docs) | Internal / code alias | Notes |
|------------------------------|----------------------|--------|
| New vault launch | Greenfield deploy | Not a separate product — same 1-click flow |
| Launch bundle ($499 USDC) | `vault_full_deploy` | All-or-nothing; à-la-carte strategy keys return HTTP 410 |
| Fair-launch auction | CCA / `CCALaunchStrategy` | Starts next **Thursday 00:00 UTC** after finalize |
| Optional Solana trading | Share mesh / `solana_ovault_mesh` | Tradable `■<TICKER>` mint on Solana |
| Post-auction Solana bridge (30%) | Pipe A | Payable `finalizePhase2`; not Phase 3 TVL |
| Share allocation at finalize | **30 / 30 / 30 / 10** | Auction / vesting / Solana bridge / LP reserve |
| Phase 3 strategy split | **45% Charm / 45% Ajna / 10% idle** | Solana is Phase 2b, not a Phase 3 weight |
| First deposit | **50M–100M** creator coin | Onchain floor 50M (`MIN_FIRST_DEPOSIT`) |
| Current deploy batcher | v1.14.1 `0x660B251F…61c1` | Pre-v1.14.1 shells (e.g. `0xa99058…`) deprecated for new launches |

**Address source of truth:** [docs/reference/addresses.md](../reference/addresses.md) (published) and [current release](./operations/operations/deployment/releases/current.md) (internal).

**Historical docs:** Archive folders (`deployment-releases-legacy/`, `archive/`, dated audit workpapers) may cite retired batchers or splits — do not copy those into live runbooks without an explicit “historical” label.
