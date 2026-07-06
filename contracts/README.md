# 4626 Contracts

Solidity sources for 4626 vault infrastructure on Base (and cross-chain mesh peers).

## High-level organization

Contracts are split by **product lanes** + shared infrastructure:

- `shared/` — Infrastructure and singletons used by all lanes (deploy tools, registry, lottery, strategies, bridges, core interfaces, libraries, platform governance).
- `agent/` — AgentTokenV4 lane (AgentOVault + supporting contracts).
- `creator/` — Creator coin lane (CreatorOVault + supporting contracts).
- `other/` — Future ecosystems and special-purpose code (e.g. alfaclub).

```
contracts/
├── shared/
│   ├── core/          4626Registry
│   ├── deploy/        DeploymentBatcher, factories, infra, hooks
│   ├── bridge/
│   ├── governance/    Platform-level (bribes, factories, ve4626 roots)
│   ├── interfaces/
│   ├── libraries/
│   ├── lottery/       4626LotteryManager + VRF + randomness (shared singleton)
│   └── strategies/    Reusable yield strategies (Ajna, CCA, Univ3/4, etc.)
├── agent/
│   ├── vault/         (AgentOVault, AgentOVaultWrapper, AgentShareOFT, modules)
│   ├── governance/    AgentGaugeController
│   ├── revenue/
│   └── oracles/
├── creator/
│   ├── vault/         (CreatorOVault + modules + CreatorShareOFT + OVaultHubComposer)
│   ├── governance/
│   ├── revenue/
│   ├── oracles/
│   ├── recovery/
│   └── vesting/
└── other/
    └── alfaclub/
```

## Vault lanes (product flavors)

4626 supports two parallel **vault lanes**:

| Lane    | Deposit asset     | Accounting              | Share symbols |
|---------|-------------------|-------------------------|---------------|
| **creator** | Zora creator coin | Exact ERC-20 transfer  | `■` / `▢`    |
| **agent**   | AgentTokenV4      | Measured fee-on-transfer | `◆` / `◇`  |

**Important:** "Agent" here refers to the Virtuals-style AgentTokenV4 token economy lane. It is unrelated to XMTP agents, Keepr, or ERC-8004 identity.

All lane-specific code lives under `agent/` or `creator/`. Shared singletons and deploy infrastructure live under `shared/`.

## Shared protocol singletons (`4626*`)

These serve **all** vault kinds (creator + agent) and live under `shared/`:

- `shared/core/4626Registry.sol` — registry + `vaultKind` metadata
- `shared/lottery/manager/4626LotteryManager.sol` — jackpot payout authority for any ShareOFT buy
- VRF + randomness infrastructure under `shared/lottery/`

Do not deploy per-lane lottery managers or registries.

## Per-asset deploy (CREATE2 per token)

Each token launch deploys its own stack:

| Creator lane                  | Agent lane                    |
|-------------------------------|-------------------------------|
| `creator/vault/CreatorOVault` | `agent/vault/AgentOVault`     |
| `creator/vault/CreatorOVaultWrapper` | `agent/vault/AgentOVaultWrapper` |
| `creator/vault/CreatorShareOFT` | `agent/vault/AgentShareOFT` |
| `creator/governance/CreatorGaugeController` | `agent/governance/AgentGaugeController` |
| `creator/oracles/CreatorOracle` | `agent/oracles/AgentOracle` |
| `creator/revenue/PayoutRouter` | `agent/revenue/AgentRevenueRouter` |

Reused bytecode (under `shared/`): CCA launch strategy, linear vesting, burn stream, Charm/Ajna/Concentrated strategies, etc.

Deployment orchestration lives in `shared/deploy/batchers/`.
