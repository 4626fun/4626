# Operator terminology map

Internal runbooks use shorthand that differs from creator-facing docs at [docs.4626.fun](https://docs.4626.fun). Use this map when editing ops docs or talking to creators.

**Prefer creator-facing terms in user-visible copy.** Use internal names only in code, runbooks, and PR titles when precision matters.

| Plain language (say this to creators) | Internal / code alias | Notes |
|---------------------------------------|----------------------|--------|
| **New vault launch** | Greenfield deploy | Brand-new vault on the **current** release — not upgrading AKITA or other legacy vaults |
| Launch bundle ($499 USDC) | `vault_full_deploy` | All-or-nothing; à-la-carte strategy keys return HTTP 410 |
| Fair-launch auction | CCA / `CCALaunchStrategy` | Starts next **Thursday 00:00 UTC** after finalize |
| **Solana bridge at finalize** (~30% of `■`) | Pipe A / `solana_ovault_mesh` | Automatic LayerZero bridge during Phase 2 finalize — **not** a separate app step or Phase 3 strategy |
| Optional Solana trading (Meteora) | Share mesh entitlement | Operator-provisioned pool on bridged `■`; included in launch bundle |
| Share allocation at finalize | **30 / 30 / 30 / 10** | Auction / vesting / Solana bridge / LP reserve |
| Phase 3 strategy split | **45% Charm / 45% Ajna / 10% idle** | Solana is Phase 2b, not a Phase 3 weight |
| First deposit | **50M–100M** creator coin | Onchain floor 50M (`MIN_FIRST_DEPOSIT`) |
| Current deploy batcher | v1.14.1 `0x660B251F…61c1` | Pre-v1.14.1 shells (e.g. `0xa99058…`) deprecated for new launches |

**Address source of truth:** [docs/reference/addresses.md](../reference/addresses.md) (published) and [current release](./operations/operations/deployment/releases/current.md) (internal).

**Historical docs:** Archive folders (`deployment-releases-legacy/`, `archive/`, dated audit workpapers) may cite retired batchers or splits — do not copy those into live runbooks without an explicit “historical” label.
