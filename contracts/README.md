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
│   ├── core/          Registry4626
│   ├── deploy/        DeploymentBatcher, factories, infra, hooks
│   ├── bridge/
│   ├── governance/    Platform-level (bribes, factories, ve4626 roots)
│   ├── interfaces/    Lane-neutral + external interfaces only (bridge, core,
│   │                  deploy, external, lottery, strategies, uniswap, vault)
│   ├── libraries/     uniswap/ + vault/ (OVaultLiquidityLib)
│   ├── lottery/       4626LotteryManager + VRF + randomness (shared singleton)
│   ├── recovery/      Impairment claims + recovery escrow (vault-agnostic, both lanes)
│   ├── revenue/       VaultShareBurnStream (both lanes point burnStream here)
│   ├── strategies/    Reusable yield strategies (Ajna, CCA, Univ3/4, etc.)
│   ├── vault/         OVaultHubComposer + lane-shared vault modules/
│   └── vesting/       LinearVesting4626
├── agent/
│   ├── interfaces/    IAgentOVault, IAgentGaugeController, IAgentTokenV4, IAgentTaxAccountingAdapter
│   ├── vault/         (AgentOVault, AgentOVaultWrapper, AgentShareOFT, core module)
│   ├── revenue/       AgentGaugeController + revenue routing/policy
│   └── oracles/
├── creator/
│   ├── interfaces/    ICreatorOVault, ICreatorGaugeController, ICreatorOVaultComposer
│   ├── vault/         (CreatorOVault + core module + CreatorShareOFT)
│   ├── revenue/
│   ├── strategies/    CreatorLPManager (V4 LP manager for creator-lane ShareOFT)
│   └── oracles/
└── other/
    └── alfaclub/
```

**Interface placement rule:** `shared/interfaces/` holds only lane-neutral and external-protocol interfaces. Interfaces that describe a lane contract (`ICreatorOVault`, `IAgentGaugeController`, …) live in that lane's `interfaces/` folder — shared infra (batcher, hub composer, strategies) imports them from there.

**Oracle interface:** both lane oracles (`CreatorOracle`, `AgentOracle`) implement the lane-neutral `shared/interfaces/oracles/IOracle4626.sol` — `getAssetPrice()`, `getAssetEthTWAP()`, `updateAssetPrice*()`, `assetSymbol()`, etc., where "asset" is the vault's underlying token for that lane (creator coin or agent token). Shared consumers (strategies, `LotteryManager4626`, `VRFConsumer4626`, both gauge controllers) type against `IOracle4626` only. The former `ICreatorOracle` interface, the inline gauge/VRF oracle interfaces, and the creator-named alias functions on `AgentOracle` (`getCreatorPrice`, `creatorPoolKey`, `creatorIsToken0`) were removed in the July 2026 selector rename — this changed oracle/gauge/strategy bytecode, folded into the same v1.16.0 re-seed noted below.

**Naming note:** the lane-shared contracts under `shared/` were renamed from their historical `Creator*` names in July 2026: `CreatorOVaultAdminModule` → `OVaultAdminModule`, `CreatorOVaultStrategiesModule` → `OVaultStrategiesModule`, `CreatorOVaultModuleBase`/`Storage` → `OVaultModuleBase`/`Storage`, `ICreatorOVaultModuleIdentity` → `IOVaultModuleIdentity`, `CreatorOVaultLiquidityLib` → `OVaultLiquidityLib`, `CreatorVaultShareBurnStream` → `VaultShareBurnStream`, `CreatorOImpairmentClaims` → `OVaultImpairmentClaims`, `CreatorORecoveryEscrow` → `OVaultRecoveryEscrow`. Because there were no live vaults at the time, the on-chain identity strings were renamed too: module kinds are now `keccak256("CreatorOVaultModule.core")` (creator lane), `keccak256("AgentOVaultModule.core")` (agent lane), and lane-shared `keccak256("OVaultModule.strategies")` / `keccak256("OVaultModule.admin")`; the storage fingerprint is `keccak256("OVaultModuleStorage.v3")`; the burn-stream CREATE2 salt domain is `"4626:VaultShareBurnStream"` (mirrored in `frontend/shared/deploy/create2Salts.ts`). This changes `CreatorOVault`, module, and `VaultAuxiliaryDeployBatcher` bytecode, so the next deploy epoch must re-seed the `UniversalBytecodeStore` and regenerate bytecode manifests before production deploys.

Only **historical records keep the old names**: versioned deploy manifests and `referenceSaltTag` entries under `deployments/` (plus the legacy `CreatorOVaultModuleStorage.v2`/`.current` fingerprints in `frontend/src/lib/deploy/ovaultModuleIdentity.ts` used for drift detection against previously deployed modules). Do not rewrite those.

Future infra epochs deploy under new-name salt tags (e.g. `base-release:OVaultAdminModule:<epoch>`), which yields new CREATE2 addresses — expected and accepted.

## Vault lanes (product flavors)

4626 supports two parallel **vault lanes**:

| Lane    | Deposit asset     | Accounting              | Share symbols |
|---------|-------------------|-------------------------|---------------|
| **creator** | Zora creator coin | Exact ERC-20 transfer  | `■` / `▢`    |
| **agent**   | AgentTokenV4      | Measured fee-on-transfer | `◆` / `◇`  |

**Important:** "Agent" here refers to the Virtuals-style AgentTokenV4 token economy lane. It is unrelated to XMTP agents, Keepr, or ERC-8004 identity.

All lane-specific code lives under `agent/` or `creator/`. Shared singletons and deploy infrastructure live under `shared/`.

## Lane parity policy (agent/ vs creator/)

The two lane folders are **intentionally not identical**. The creator lane is the base implementation; the agent lane relates to it in three ways:

1. **Thin overlays (inheritance, no duplication).** `AgentOVault` extends `CreatorOVault` and only overrides the expected core-module kind. `AgentOVaultCoreModule` extends `CreatorOVaultCoreModule`, swapping exact-transfer accounting for measured fee-on-transfer accounting. Both lanes directly reuse the lane-shared vault machinery under `shared/vault/` (admin/strategies modules, module base/storage, `OVaultLiquidityLib`, `OVaultHubComposer`), `shared/revenue/VaultShareBurnStream`, and `shared/recovery/` — those contracts have no per-lane copies on purpose (see the naming note above).

2. **Copy-renamed forks (guarded).** Four contracts are per-lane forks whose logic must stay identical; only ABI-visible identifier naming differs (e.g. `agentTreasury` vs `creatorTreasury`, `setAgentToken` vs `setCreatorCoin`, `◆/◇` vs `■/▢`). The per-lane names are deliberate — they are baked into deployed ABIs, indexers, and deploy bytecode manifests — so the files stay separate, and CI enforces logic parity:

   | Agent | Creator |
   |---|---|
   | `agent/vault/AgentShareOFT.sol` | `creator/vault/CreatorShareOFT.sol` |
   | `agent/vault/AgentOVaultWrapper.sol` | `creator/vault/CreatorOVaultWrapper.sol` |
   | `agent/revenue/AgentGaugeController.sol` | `creator/revenue/CreatorGaugeController.sol` |
   | `agent/revenue/AgentRevenueRouter.sol` | `creator/revenue/CreatorPayoutRouter.sol` |

   **When you change any of these files, mirror the change to the lane counterpart in the same PR.** `pnpm guard:lane-contract-parity` (CI-blocking in `test.yml`) diffs each pair with comments stripped and the approved rename map applied; any residual difference fails the build. Naming-only differences go in the rename map inside `scripts/check-lane-contract-parity.mjs`; a genuinely lane-specific behavior change means moving the pair to the intentionally-divergent list below with justification.

3. **Intentionally divergent (not guarded).** `AgentOracle` vs `CreatorOracle`: the agent oracle adds a Uniswap V2 pair TWAP path (`setV2Pair`, `recordV2Observation`) because AgentTokenV4 tokens trade on V2-style pools, plus creator-interface alias getters. Lane-exclusive contracts: `agent/revenue/AgentRevenuePolicyController` and `AgentOVaultTaxAdapter` (AgentTokenV4 tax cooperation); `creator/revenue/CreatorCoinPolicyController` (creator-coin specific).

## Shared protocol singletons (`4626*`)

These serve **all** vault kinds (creator + agent) and live under `shared/`:

- `shared/core/Registry4626.sol` — registry + `vaultKind` metadata
- `shared/lottery/manager/LotteryManager4626.sol` — jackpot payout authority for any ShareOFT buy
- VRF + randomness infrastructure under `shared/lottery/`

Do not deploy per-lane lottery managers or registries.

## Per-asset deploy (CREATE2 per token)

Each token launch deploys its own stack:

| Creator lane                  | Agent lane                    |
|-------------------------------|-------------------------------|
| `creator/vault/CreatorOVault` | `agent/vault/AgentOVault`     |
| `creator/vault/CreatorOVaultWrapper` | `agent/vault/AgentOVaultWrapper` |
| `creator/vault/CreatorShareOFT` | `agent/vault/AgentShareOFT` |
| `creator/revenue/CreatorGaugeController` | `agent/revenue/AgentGaugeController` |
| `creator/oracles/CreatorOracle` | `agent/oracles/AgentOracle` |
| `creator/revenue/PayoutRouter` | `agent/revenue/AgentRevenueRouter` |

Reused bytecode (under `shared/`): CCA launch strategy, linear vesting, burn stream, Charm/Ajna/Concentrated strategies, etc.

Deployment orchestration lives in `shared/deploy/batchers/`.
