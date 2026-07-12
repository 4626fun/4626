---
title: Hermes V2 → 4626 mapping
sidebar_position: 6
---

# Hermes V2 → 4626 mapping

4626 does **not** vendor [Maia-DAO hermes-v2](https://github.com/Maia-DAO/hermes-v2). It implements a **simplified ve(3,3)-inspired** stack with different economics: **probability budget + fee split + burn**, not inflationary emissions + UniV3 LP gauges + full Flywheel.

## Component map

| Hermes V2 | 4626 | Notes |
|-----------|------|--------|
| `ERC20Boost` | `ve4626BoostManager` + `veLottery` | Lottery personal mult, not ERC20-embedded boost |
| `ERC20Gauges` | `ve4626GaugeVoting` | Votes direct **probability**, not emissions |
| Gauge lifecycle / allowlist | **`GaugeSurfaceRegistry4626`** | Explicit `votes` / `bribes` / `streams` flags; optional wire |
| `ERC20MultiVotes` | OZ `ERC20Votes` on `ve4626` | Single-delegate only |
| `ERC4626` / deposit-only | `CreatorOVault` / `AgentOVault` | Full product vaults; permanent b-mode still design-only |
| `BaseV2Gauge` | `CreatorGaugeController` / `AgentGaugeController` | Fee collector + split, not LP emissions gauge |
| `BaseV2GaugeFactory` / Manager | `OVaultFactory4626` + lanes + batchers + registry | Lane router, not Hermes factory tree |
| `BribesFactory4626` | `BribesFactory4626` + `BribeDepot4626` | Epoch multi-token bribes; surface-gated create/fund |
| `UniswapV3Gauge` / factory | — | Intentionally absent |
| `HERMES` | Protocol **■4626** (`wrappedShareOFT`) | Lock asset on `ve4626` |
| `BurntHermes` | `ve4626` | Dual-decay vote-escrow |
| `UtilityManager` + bHermes\* | `ve4626Utility` + `ve33` / `veLottery` | Rights split |
| `BaseV2Minter` | — | **No emissions minter** |
| Full Flywheel stack | **Thin** `RewardStream4626` | Multi-token partner streams only (Design A epoch bag) |
| Flywheel bribes / gauge rewards | `BribeDepot4626` + `ve4626VoterRewardsDistributor` | Fee + bribe lanes already cover core cases |
| `UniswapV3Staker` + boost | — | Intentionally absent (Charm/strategies for LP yield) |

## Folder layout

**Do not** reorganize `contracts/` to match Hermes (`erc-20/`, `hermes/`, `rewards/flywheel/`, …).

Canonical 4626 homes:

- Governance: `contracts/shared/governance/`
- Gauge surfaces: `contracts/shared/governance/surfaces/` ([gauge-surface-registry](./gauge-surface-registry.md))
- Partner streams: `contracts/shared/governance/rewards/`
- Creator fee gauge: `contracts/creator/revenue/`
- Agent fee gauge: `contracts/agent/revenue/`

See also: [contracts folder proposal](../../architecture/contracts-folder-optimization-proposal.md).

## What to build next (product, not Hermes parity)

1. ~~Bribe marketplace frontend~~ — MVP on `/vote` (`BribeDepot4626Panel` + `useBribes4626`)  
2. ~~Reward stream frontend~~ — MVP on `/vote` (`RewardStream4626Panel` + `useRewardStream4626`)  
3. ~~OVaultFactory Phase B~~ — `startPhase2` / `finalizePhase2` / `startPhase3` façade ([lane docs](../deploy/ovault-factory-lanes.md))  
4. ~~Canary runbook~~ — [rewards-ecosystem-canary-2026-07.md](../../operations/rewards-ecosystem-canary-2026-07.md) + `DeployRewardsEcosystem.s.sol` (execute when ops ready)  
5. Permanent deposit-only vault mode (design)

Do **not** port Hermes Flywheel, UniV3 staker, or BaseV2Minter unless product reopens emissions/LP incentive design.
