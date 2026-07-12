---
title: ABI ↔ source naming parity
sidebar_position: 7
---

# ABI ↔ source naming parity (V1 greenfield)

**Posture:** first-time Base deploy. ABIs in `deployments/base/contracts/**` match current source; addresses are null until broadcast.

## Commands

```bash
forge build --skip test
node scripts/export-v1-deployment-abis.mjs
node scripts/check-abi-source-naming-parity.mjs --fail
```

Expect **0** interesting mismatches after export.

## Canonical V1 names (source = ABI)

| Surface | Name |
|---------|------|
| Registry | `Registry4626` |
| Lottery | `LotteryManager4626` — `setve4626GaugeVoting`, `ve4626GaugeVoting`, `getTokenLotteryStats`, `tokenStats` |
| Gauge voting | `ve4626GaugeVoting` — `getVaultProbabilityBoostPPM`, `getEligibleVaults` |
| Eligibility registry | `GaugeSurfaceRegistry4626` |
| Voter rewards | `ve4626VoterRewardsDistributor` |
| Gauge controllers | `ve4626VoterRewardsDistributor` getter / `setve4626VoterRewardsDistributor` |
| Bribes | `BribeDepot4626`, `BribesFactory4626` |
| Partner streams | `RewardStream4626`, `RewardStreamFactory4626` |
| Factory | `OVaultFactory4626` (legacy file path `CreatorOVaultFactory.json` is an alias only) |
| Creator lane stack | `deployments/base/contracts/creator/*` — OVault, wrapper, ShareOFT, core module, oracle, gauge, payout router, coin policy |
| Agent lane stack | `deployments/base/contracts/agent/*` — OVault, wrapper, ShareOFT, core module, oracle, gauge, revenue router/policy, tax adapter |

Lane ABIs are **interface templates** (`address: null` until each vault is broadcast). Agent = AgentTokenV4 product lane, not XMTP/Keepr.

## Env (V1 only)

| Client | Server |
|--------|--------|
| `VITE_VE4626` | `VE4626` |
| `VITE_VE4626_GAUGE_VOTING` | `VE4626_GAUGE_VOTING` |
| `VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR` | `VE4626_VOTER_REWARDS_DISTRIBUTOR` |
| `VITE_VE4626_BOOST_MANAGER` | `VE4626_BOOST_MANAGER` |
| `VITE_BRIBES_FACTORY_4626` | `BRIBES_FACTORY_4626` |

No legacy `VITE_VAULT_GAUGE_*` / `VOTER_REWARDS_*` fallbacks.

## Related

- [contract-naming.md](./contract-naming.md)
- [ve-naming.md](./ve-naming.md)
- `scripts/export-v1-deployment-abis.mjs`
