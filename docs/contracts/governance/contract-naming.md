---
title: Contract naming
sidebar_position: 1
---

# Contract naming (canonical)

## Layers

| Layer | Rule | Examples |
|-------|------|----------|
| **Shared protocol service** | `*4626` **suffix** | `Registry4626`, `LotteryManager4626`, `VRFConsumer4626`, `BribeDepot4626`, `BribesFactory4626`, `RewardStream4626`, `RewardStreamFactory4626` |
| **Shared lane integration interface** | `I*4626` **suffix** | `IRevenueRouter4626`, `ITradeFeeCollector4626`, `IShareOFT4626`, `IOracle4626`, `IRevenuePolicyController4626` |
| **ve stack** | `ve4626*` **prefix** | `ve4626`, `ve4626GaugeVoting`, `ve4626VoterRewardsDistributor`, `ve4626BoostManager` |
| **Creator / Agent lane** | `Creator*` / `Agent*` **prefix** (per-instance) | `CreatorGaugeController`, `CreatorOVault`, `AgentShareOFT` |
| **Additional ecosystem lane** | Real ecosystem **prefix** (per-instance) | `FarcasterGaugeController`, `ZoraRevenueRouter`; never `FutureEcosystem*` |
| **Ops batchers / arms** | Keep established names unless product renames | `DeploymentBatcher`, `CCALaunchArm` |

## Forbidden legacy aliases

| Forbidden | Use instead |
|-----------|-------------|
| `CreatorLotteryManager` | `LotteryManager4626` |
| `CreatorVRFConsumer` / `CreatorVRFConsumerV2_5` | `VRFConsumer4626` |
| `CreatorRegistry` / `4626Registry` | `Registry4626` |
| bare `BribeDepot` | `BribeDepot4626` |
| bare `BribesFactory` | `BribesFactory4626` |
| bare `RewardStreamFactory` | `RewardStreamFactory4626` |

Enforced on active paths by:

```bash
pnpm -C frontend guard:registry4626-naming
```

Historical docs under `docs/_internal/**` (old audits, release notes) may still contain legacy names; do not reintroduce them in **code**, public docs, or new write-ups.

## Shared type vs concrete deployment

Use neutral `I*4626` names for the ABI that shared consumers depend on. Keep a
real ecosystem prefix on concrete per-asset deployments:

- `ITradeFeeCollector4626` is the shared type; `CreatorGaugeController` and
  `AgentGaugeController` are concrete implementations.
- `IRevenueRouter4626` is the shared type; `CreatorPayoutRouter` and
  `AgentRevenueRouter` are concrete implementations.
- `IShareOFT4626` and `IOracle4626` follow the same pattern.
- `IRevenuePolicyController4626` contains only common ownership authority.
  Ecosystem extensions retain exact external-protocol selectors, such as
  `enforcePayoutRouter()` or `enforceProjectTaxRecipient()`.

Do not rename deployed Creator/Agent contracts to generic concrete names.
Those names are tied to ABIs, CREATE2 salts, bytecode manifests, and operational
runbooks. Do not add a generic arbitrary-call policy controller to simulate
compatibility between unrelated ecosystem admin APIs.

## Product vs type

- **Type / file:** match the contract (`LotteryManager4626.sol`, `ve4626GaugeVoting.sol`).
- **UI copy:** may say “vault gauge voting” or “lottery manager” in prose.
- **Hooks/components** track contract identity with **React-valid casing**:
  - Hook: `useVe4626GaugeVoting` (file `useVe4626GaugeVoting.ts`)
  - Panel: `Ve4626GaugeVotingPanel` / `Ve4626GaugeVotingMini` (file `Ve4626GaugeVotingPanel.tsx`)
  - On-chain / Solidity remains lowercase `ve4626GaugeVoting` — that rule does **not** apply to React identifiers (ESLint `react-hooks/rules-of-hooks`).

## Frontend / env (second pass)

| Prefer | Legacy fallback (still accepted) |
|--------|----------------------------------|
| `CONTRACTS.ve4626GaugeVoting` | — (was `vaultGaugeVoting`) |
| `CONTRACTS.ve4626VoterRewardsDistributor` | — |
| `CONTRACTS.bribesFactory4626` | — |
| `CONTRACTS.ve4626BoostManager` | — |
| `VITE_VE4626_GAUGE_VOTING` | `VITE_VAULT_GAUGE_VOTING` |
| `VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR` | `VITE_VOTER_REWARDS_DISTRIBUTOR` |
| `VITE_BRIBES_FACTORY_4626` | `VITE_BRIBES_FACTORY` |
| `VITE_VE4626_BOOST_MANAGER` | `VITE_VE_BOOST_MANAGER` |
| `useVe4626GaugeVoting` / `Ve4626GaugeVotingPanel` | — (do **not** use `useve4626*` / `ve4626*Panel`; ESLint rejects them) |

**On-chain exception:** `LotteryManager4626.vaultGaugeVoting()` is a **Solidity storage getter** name. Do not rename without a contract upgrade; TS/config should map it to the `ve4626GaugeVoting` product type.

## Related

- [ve■4626 naming](./ve-naming.md)
- [Hermes V2 → 4626 mapping](./hermes-v2-mapping.md)
- [RewardStream4626](./reward-stream.md)
- [ABI ↔ source naming parity](./abi-source-naming-parity.md) — deployment JSON lag vs current Solidity
