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
│   │                  deploy, external, lottery, shareoft-mesh, strategies, uniswap, vault)
│   ├── libraries/     uniswap/ + vault/ (OVaultLiquidityLib)
│   ├── distribution/  LinearVesting4626 + VaultShareBurnStream (lane-shared payouts)
│   ├── lottery/       LotteryManager4626 + VRFConsumer4626 + randomness (shared singleton)
│   ├── shareoft-mesh/ ShareOFT mesh arms (CCA launch + post-CCA Uniswap V4 LP)
│   │   ├── cca/       CCALaunchArm (+ config/encoding modules)
│   │   └── univ4/     OVaultLPManager, ApprovedV4HooksRegistry
│   ├── strategies/    Reusable yield strategies (Ajna, Charm, Univ3/4 legs, ERC4626 adapter)
│   ├── vault/         OVaultHubComposer + lane-shared vault modules/
│   │   └── recovery/  OVaultImpairmentClaims + OVaultRecoveryEscrow
├── agent/
│   ├── interfaces/    IAgentOVault, IAgentGaugeController, IAgentTokenV4, IAgentTaxAccountingAdapter
│   ├── vault/         (AgentOVault, AgentOVaultWrapper, AgentShareOFT, core module)
│   ├── revenue/       AgentGaugeController + revenue routing/policy
│   └── oracles/
├── creator/
│   ├── interfaces/    ICreatorOVault, ICreatorGaugeController (+ lane vault composer consumers import `shared/interfaces/vault/IOVaultComposer.sol`)
│   ├── vault/         (CreatorOVault + core module + CreatorShareOFT)
│   ├── revenue/
│   └── oracles/
└── other/
    └── alfaclub/
```

**Interface placement rule:** `shared/interfaces/` holds only lane-neutral and external-protocol interfaces. Interfaces that describe a lane contract (`ICreatorOVault`, `IAgentGaugeController`, …) live in that lane's `interfaces/` folder — shared infra (batcher, hub composer, strategies) imports them from there.

**Oracle interface:** both lane oracles (`CreatorOracle`, `AgentOracle`) implement the lane-neutral `shared/interfaces/oracles/IOracle4626.sol` — `getAssetPrice()`, `getAssetEthTWAP()`, `updateAssetPrice*()`, `assetSymbol()`, etc., where "asset" is the vault's underlying token for that lane (creator coin or agent token). Shared consumers (strategies, `LotteryManager4626`, `VRFConsumer4626`, both gauge controllers) type against `IOracle4626` only. The former `ICreatorOracle` interface, the inline gauge/VRF oracle interfaces, and the creator-named alias functions on `AgentOracle` (`getCreatorPrice`, `creatorPoolKey`, `creatorIsToken0`) were removed in the July 2026 selector rename — this changed oracle/gauge/strategy bytecode, folded into the same v1.16.0 re-seed noted below.

**Lane-neutral integration interfaces:** future ecosystem integrations type against
shared `*4626` interfaces, while deployed per-lane implementations keep their
`Creator*` / `Agent*` names and bytecode identities:

| Integration role | Shared interface | Current implementations |
|---|---|---|
| Vault wiring | `IOVault4626` | `CreatorOVault`, `AgentOVault` |
| Vault wrapper | `IOVaultWrapper4626` | `CreatorOVaultWrapper`, `AgentOVaultWrapper` (cooldown hook excluded) |
| External-earnings routing | `IRevenueRouter4626` | `CreatorPayoutRouter`, `AgentRevenueRouter` |
| `tradeFeeCollector` | `ITradeFeeCollector4626` | `CreatorGaugeController`, `AgentGaugeController` |
| Omnichain share token | `IShareOFT4626` | `CreatorShareOFT`, `AgentShareOFT` |
| Asset oracle | `IOracle4626` | `CreatorOracle`, `AgentOracle` |
| Revenue-policy authority | `IRevenuePolicyController4626` | lane extensions for Creator Coin and AgentTokenV4 |

**Execution templates only:** `VaultKind` remains `{ Creator, Agent }`. A future named
ecosystem (for example Farcaster) is a concrete implementation of one of those two
templates, not a third `VaultKind`. Never introduce `FutureEcosystem*` placeholders.

These interfaces expose only selector-compatible intersections. Asset setters,
ongoing-treasury names, emergency semantics, wrapper cooldown hooks, and
external-token enforcement calls remain lane-specific. In particular,
`CreatorCoinPolicyController.enforcePayoutRouter()` and
`AgentRevenuePolicyController.enforceProjectTaxRecipient()` are intentionally
different extension selectors; do not hide them behind arbitrary
`execute(address,bytes)`.

Adding or changing an interface does not authorize editing a deployed lane
contract. Concrete implementation changes still require the normal bytecode
manifest, `UniversalBytecodeStore`, CREATE2, and release-epoch process.

**Shared ABI neutralization (July 2026):** lane-shared contracts no longer expose creator-prefixed selectors where the implementation is lane-neutral. Highlights:

| Area | Old | New |
|------|-----|-----|
| `Registry4626` / `IRegistry4626` | `CreatorCoinInfo`, `registerCreatorCoin`, `setCreatorOracle`, `getCreatorCoin`, … | `TokenInfo`, `registerToken`, `setOracleForToken`, `getTokenInfo`, … |
| `CharmStrategy4626` | `CREATOR`, `creatorOracle`, `setCreatorOracle` | `ASSET`, `assetOracle`, `setAssetOracle` |
| Univ4 LP strategies + `ILPStrategy` | `CREATOR_COIN`, `creatorIsCurrency0`, `creatorCoinAmount` | `ASSET`, `assetIsCurrency0`, `assetCoinAmount` |
| `LotteryManager4626` | `getCreatorLotteryStats`, `creatorStats` | `getTokenLotteryStats`, `tokenStats` |
| `VRFConsumer4626` | `localCreatorPriceUSD`, `getAggregatedCreatorPrice` | `localAssetPriceUSD`, `getAggregatedAssetPrice` |
| `OVaultHubComposer` | `configureCreatorMesh`, `creatorMesh`, `CreatorMesh*` errors/events | `configureTokenMesh`, `tokenMesh`, `TokenMesh*` |
| `DeploymentBatcher.StrategyCodeIds` | `creatorCharmStrategy` | `charmStrategy4626` |
| Vault modules | `_creatorCoin()`, `CannotRescueCreatorCoin` | `_vaultAsset()`, `CannotRescueVaultAsset` |
| Hub composer interface | `ICreatorOVaultComposer` (creator lane) | `shared/interfaces/vault/IOVaultComposer.sol` |

Lane-specific contracts (`CreatorOVaultWrapper.creatorCoin`, `CreatorShareOFT`, deploy batcher `creatorToken` params, etc.) keep creator naming where the asset is explicitly the creator coin. `ERC4626StrategyAdapter` now validates vault/asset alignment via `IERC4626(vault).asset()` instead of a creator-only getter.

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

1. **Thin overlays (inheritance, no duplication).** `AgentOVault` extends `CreatorOVault` and only overrides the expected core-module kind. `AgentOVaultCoreModule` extends `CreatorOVaultCoreModule`, swapping exact-transfer accounting for measured fee-on-transfer accounting. Both lanes directly reuse the lane-shared vault machinery under `shared/vault/` (admin/strategies modules, module base/storage, `OVaultLiquidityLib`, `OVaultHubComposer`, recovery escrow/claims), `shared/distribution/VaultShareBurnStream`, and `shared/distribution/LinearVesting4626` — those contracts have no per-lane copies on purpose (see the naming note above).

2. **Lane forks with intentional behavioral divergence (classified, not false-parity).** These pairs share `I*4626` capability surfaces but keep real lane differences. `pnpm guard:lane-contract-parity` verifies both files exist and that each pair has a written justification; it does **not** force logic identity:

   | Agent | Creator | Intentional divergence |
   |---|---|---|
   | `agent/vault/AgentShareOFT.sol` | `creator/vault/CreatorShareOFT.sol` | Cooldown hook arity, mint/owner auth, hub lottery peer callback rules |
   | `agent/vault/AgentOVaultWrapper.sol` | `creator/vault/CreatorOVaultWrapper.sol` | `propagateCooldownOnTransfer` amount parameter |
   | `agent/revenue/AgentGaugeController.sol` | `creator/revenue/CreatorGaugeController.sol` | Agent-only `setCoreWiring`/`_validateCoreWiring`, WETH write-down + keeper cooldown (intake accounting, emergency timelock, lottery-manager init merged to parity, ODA-508) |
   | `agent/revenue/AgentRevenueRouter.sol` | `creator/revenue/CreatorPayoutRouter.sol` | Creator-only keeper spend caps and delayed emergency withdraw |

   If a pair becomes rename-equivalent again, move it back to the parity `PAIRS` list in `scripts/check-lane-contract-parity.mjs`. Do not paper over intentional differences with rename-map hacks.

3. **Other intentional divergence.** `AgentOracle` vs `CreatorOracle`: the agent oracle adds a Uniswap V2 pair TWAP path (`setV2Pair`, `recordV2Observation`) because AgentTokenV4 tokens trade on V2-style pools. Lane-exclusive contracts: `agent/revenue/AgentRevenuePolicyController` and `AgentOVaultTaxAdapter` (AgentTokenV4 tax cooperation); `creator/revenue/CreatorCoinPolicyController` (creator-coin specific). Auxiliaries deploy through lane-aware `VaultAuxiliaryDeployBatcher` with concrete Creator/Agent salt tags and code IDs.

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

Deployment orchestration lives in `shared/deploy/batchers/`. `DeploymentBatcher` phase 1 branches on `VaultKind` (salts, core module, bytecode ids) and persists `vaultKind` in `phase1SplitStates` (included in `phase1ParamsHash`). Phase 2 reads that stored kind and wires gauge asset tokens via `setCreatorCoin` (creator) or `setAgentToken` (agent). Legacy on-chain split state written before `vaultKind` was added decodes as `Creator` (enum default `0`).

Bytecode epoch ops: `deployments/base/v1.16.0-bytecode-manifest.json` + `docs/_internal/deployment-releases-legacy/v1.16.0-bytecode-epoch.md` (store re-seed via `./script/seed-v1160-bytecode-store.sh`).

V4 tax hook pool configuration is applied through `CCALaunchArm.setOracleConfig` during phase 2 — there is no separate `TaxHookConfigurator` helper contract in-tree.

## Three axes (do not conflate)

See also [`docs/architecture/product-lanes.md`](../docs/architecture/product-lanes.md).

| Axis | Meaning |
|------|---------|
| Product vault lane | `VaultKind.Creator` / `VaultKind.Agent` under `creator/` / `agent/` |
| Value lanes | Jackpot 69% / voters 21.39% / burn 9.61% (gauge + payout routing) |
| Runtime agent | XMTP Keepr / canonical CSW automation — **not** `VaultKind.Agent` |

**`getVaultKind` wiring:** `DeploymentBatcher` phase-2 calls `Registry4626.setAgentIntegrationMeta` (authorized factory or owner) with the phase-1 `vaultKind`. `AgentIntegrationMeta` is a historical name for lane meta; rename only on a future registry epoch. Unset meta defaults to Creator.

## Adding a future ecosystem

Two canonical paths — pick per product:

### Mesh path (needs ShareOFT + gauge + lottery)

1. Name the concrete lane for the real ecosystem (`Farcaster*`, `Zora*`, etc.);
   never add placeholder `FutureEcosystem*` contracts.
2. Implement the relevant shared integration surfaces from genesis:
   `IRevenueRouter4626`, `ITradeFeeCollector4626`, `IShareOFT4626`, and
   `IOracle4626`. Extend `IRevenuePolicyController4626` with the ecosystem's
   exact external-admin selectors.
3. Add `contracts/<ecosystem>/` mirroring only the required `agent/` /
   `creator/` pieces (vault, wrapper, ShareOFT, gauge, revenue router, oracle,
   interfaces).
4. Add a distinct core-module kind string and vault overlay (or inheritance) as needed.
5. Extend `VaultKind` in `IRegistry4626` + `DeploymentBatcher` (new registry/batcher epoch).
6. Add bytecode manifest entries + `frontend/src/lib/deploy/deployLaneBytecode.ts` branch (or table).
7. Extend `pnpm guard:lane-contract-parity` (or move intentionally divergent pairs with justification).
8. Wire phase-2 lane metadata and the ecosystem-specific gauge asset setter.

### Non-mesh path (independent product)

Place under `contracts/other/<product>/` (AlfaClub precedent). Stay outside `Registry4626` / `DeploymentBatcher` / ShareOFT mesh until the product explicitly needs those.

### Known debt (do not rename in small PRs)

- Batcher / API still use `creatorToken` for any lane underlying asset.
- Solidity struct name `AgentIntegrationMeta` remains agent-flavored.
