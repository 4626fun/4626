# 4626 Contracts

Solidity sources for 4626 vault infrastructure on Base (and cross-chain mesh peers).

## Domain map

| Domain | Path | Role |
|--------|------|------|
| **Registry** | `core/` | Canonical address index (`4626Registry` / `Registry4626`) for all vault kinds |
| **Vault hub** | `vault/` | ERC-4626 shells, modules, strategies |
| **Cross-chain** | `utilities/messaging/`, `utilities/bridge/` | ShareOFT, OVault composer, Solana bridge (→ `crosschain/` in layout Phase 3) |
| **Revenue** | `utilities/routers/`, `utilities/oracles/` | PayoutRouter, AgentRevenueRouter, oracles (→ `revenue/` in layout Phase 3) |
| **Lottery** | `utilities/lottery/` | Protocol-wide lottery + VRF (→ `lottery/` + `4626LotteryManager`) |
| **Governance** | `governance/` | Gauge controllers, ve4626, bribes |
| **Deploy** | `helpers/batchers/`, `factories/`, `helpers/infra/` | DeploymentBatcher, bytecode store, CREATE2 deployer |
| **Verification** | `verification/tamago/` | Formal verification artifacts (not production bytecode) |

## Vault lanes (product flavors)

4626 supports parallel **vault lanes** — not separate product “agents” (XMTP/Keepr identity is unrelated).

```
vault/
├── creator/          CreatorOVault lane (Zora creator coin, exact-transfer)
├── agent/            AgentOVault lane (AgentTokenV4, measured FOT)
├── modules/          Shared + lane-specific core modules
└── strategies/       Charm, Ajna, CCA, UniV4 (asset-agnostic)
```

| Lane | Deposit asset | Accounting | Share symbol |
|------|---------------|------------|--------------|
| **Creator** | Zora creator coin | Exact ERC-20 transfer | `■` / `▢` |
| **Agent** | AgentTokenV4 | Measured fee-on-transfer | `◆` / `◇` |

**AgentOVault ≠ XMTP agent / Keepr / ERC-8004 identity.** Agent here means the Virtuals-style **AgentTokenV4** token economy lane.

## Shared protocol singletons (`4626*`)

These serve **all** vault kinds (creator + agent):

- **`Registry4626`** — registry + `vaultKind` metadata
- **`LotteryManager4626`** — jackpot payout authority for any ShareOFT buy
- **`VRFConsumer4626`** — shared Chainlink VRF for lottery draws

Do not deploy per-agent lottery managers or registries.

## Per-asset deploy (CREATE2 per token)

Each token launch deploys its own stack:

| Creator lane | Agent lane |
|--------------|------------|
| `CreatorOVault` | `AgentOVault` |
| `CreatorOVaultWrapper` | `AgentOVaultWrapper` |
| `CreatorShareOFT` | `AgentShareOFT` |
| `CreatorGaugeController` | `AgentGaugeController` |
| `CreatorOracle` | `AgentOracle` |
| `PayoutRouter` | `AgentRevenueRouter` |

Reused bytecode instances: CCA launch strategy, linear vesting, burn stream, Charm/Ajna strategies.

## Layout migration (in progress)

Phased folder cleanup is documented in the AgentOVault integration plan. Prefer new agent-lane files under `vault/agent/` and shared singleton renames to `4626*` types.
