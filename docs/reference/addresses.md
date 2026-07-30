---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed addresses for 4626 on Base mainnet. Shared infrastructure and new per-creator launches use the **v1.20.0** greenfield stack (hard cutover; no dual-epoch launch lane).

v1.20.0 greenfield infra is live with a fully seeded bytecode store (includes Ajna dust-refund + Phase 3 automation-keeper seal). Prior v1.19.x addresses remain onchain for already-deployed vaults but are **not** supported launch or ops targets. Creator + Agent paid canaries on the new stack remain outstanding. AMOE still uses live router `0xf07D4811…` until the multi-entry timelock execute (**2026-07-31 17:32:53 UTC** → `0x44d070…`).

For launch procedures, see [Getting started](/getting-started). This page lists **shared infrastructure** (batcher, factories, registry). Per-creator vault, wrapper, and ShareOFT addresses are emitted at deploy.

**Terms:** **New vault launch** = fresh deploy on the current release (_greenfield_). **Solana bridge at finalize** = ~30% of `■` bridged during activation (_Pipe A_). See [Glossary](/reference/glossary#quick-definitions).

**Canonical source.** When documentation or tooling disagrees with this file, **this file wins**. Addresses link to [BaseScan](https://basescan.org) on Base mainnet.

## Base

### Current infrastructure

| Contract                          | Address                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| Registry4626                      | `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e`                                |
| OVaultFactory4626                 | `0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5`                                |
| VaultActivationBatcher            | `0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3`                                |
| LotteryManager4626                | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b`                                |
| VRFConsumer4626                   | `0x56E2453Bf8Cf2C3FC33E7D18Edc2310297f2a251`                                |
| UniversalBytecodeStoreV2          | `0x8599CA87b28320158941C59CB3cd9a3f12083530`                                |
| UniversalCreate2DeployerFromStore | `0xdffB25505F5050E15B3602296330Ef352127d1Ef`                                |
| CreatorOVaultCoreModule           | `0xD6B862783Fd362ccF0d39d86E6384D8770e78833`                                |
| AgentOVaultCoreModule             | `0xD6B862783Fd362ccF0d39d86E6384D8770e78833`                                |
| CreatorOVaultStrategiesModule     | `0x968b8233053B64A93a4Cde044fFf4f43ea6D3c60`                                |
| CreatorOVaultAdminModule          | `0x5bC4d71dB82081fCCF3647F1C094BEB202C0DB50`                                |
| DeploymentBatcher                 | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032`                                |
| DeploymentBatcherPhase1Module     | `0x416FA15e40caA51C20d1795db946c6806C946aC5`                                |
| DeploymentBatcherPhase2Module     | `0xf1334BE96B3530BBF17506DED98E50D917A45B41`                                |
| DeploymentBatcherPhase3Helper     | `0x3Ed642288cd03846e9dA956cF95812d3125dD274`                                |
| DeploymentBatcherShareMeshHelper  | `0x1BCd4768180671Aa435C845239e05Afc81a496cA`                                |
| DeploymentBatcherUtilsHelper      | `0x99712E96f11670113f66b9356890a2209359C37d`                                |
| VaultAuxiliaryDeployBatcher       | `0x15eE1D03a5556C28E5079E68763F8231ad68dAdD` (hardened; CREATE2-authorized) |

Notes:

- **v1.20.0** is the current shared/global + per-creator bytecode/CREATE2
  namespace. Handoff: `tmp/base-v1.20.0-handoff.env`. Manifest:
  `deployments/base/v1.20.0-bytecode-manifest.json`.
- Phase1 immutables bind creator + agent core to the same module address
  `0xD6B86278…` on this epoch.
- Batcher helpers + Phase1 are wired; CREATE2 authorizes the batcher and aux
  helper. Bytecode store is seeded and verified against the v1.20.0 manifest.
- Hardened aux helper `0x15eE1D03…` is pinned to the v1.20.0 store/create2/batcher.
- Prior v1.19.x / v1.18.0 stacks are deprecated for **new vault launches**; see
  Deprecated infrastructure below.
- `DeploymentBatcher` deploys as a slim shell; helpers and
  `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe
  (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use active module immutables. Live AKITA vaults on the
  prior stack are **not** upgraded by this cutover.

### Deprecated infrastructure

| Epoch / label                    | Representative addresses                                                                     | Notes                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| v1.19.1 / v1.19.3 greenfield     | Registry `0x1365e9…`, batcher `0xa18169…`, store `0xF96226…`, CREATE2 `0xe2a8aA…`, aux `0xaA9229…` | Superseded by v1.20.0; existing vaults (incl. AKITA) may still reference       |
| v1.18.0 greenfield               | Registry `0xDb8570…`, batcher `0x02D7…`, store `0xfa3e…`, CREATE2 `0x54660E…`, aux `0xde93…` | Superseded by v1.19.1 greenfield; existing vaults may still reference            |
| v1.16.1-share-mesh               | Registry `0x1eb9A3…`, batcher `0xA9024e…`, store `0x7D1029…`                                 | Superseded by v1.18.0; existing vaults may still reference                       |
| v1.17.0 orphan                   | Registry `0x5646B5…`, batcher `0xa4090F…`                                                    | Partial broadcast — never wired for production                                   |
| v1.16.0 shell                    | Batcher `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33`                                         | Lacks `shareMeshHelper()`                                                        |
| v1.14.1 shell                    | Batcher `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1`                                         | Pre–share-mesh                                                                   |
| v1.14.0 shell                    | Batcher `0xa99058f424FB3ACC639F59355C65C40149030651`                                         | Pre–v1.14.1 refresh                                                              |
| Legacy AMOE router               | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a`                                                 | v1.11 manager fan-out                                                            |
| Legacy lottery manager           | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8`                                                 | Pre–v1.16.1 registry stack                                                       |
| Retired Twin SolanaBridgeAdapter | `0x9A61814082A26192DD9Cb201b44058506685Be60`                                                 | Historical on-chain deployment only; removed from source and active env/defaults |

### Protocol Safes

| Role                                                            | Address                                      |
| --------------------------------------------------------------- | -------------------------------------------- |
| Protocol treasury Safe (cold custody, strategy ownership)       | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| Protocol automation Safe (hot lane — Charm manager, Ajna admin) | `0x08f0875E40781578F902998b2b831cc48d838eBE` |

Do **not** set `PROTOCOL_AUTOMATION_SAFE` to the treasury address. Phase 3 deploys wire Charm `manager` and Ajna `admin` to the automation Safe; treasury keeps adapter ownership only.

### AMOE (ZK lottery entry)

| Contract / role                                   | Address                                      | Notes                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LotteryAmoeRouter` (v3, multi-entry)             | `0x44d070C95Da7228BDf316E3DCB81e89FD1D6e338` | **Queued cutover** (no `usedWalletCommit`). Deployed 2026-07-29. Manager `queueAmoeRelayerChange` pending until **2026-07-31 17:32:53 UTC**, then run `amoe/tools/ops/execute-amoe-relayer-cutover.sh`. Do **not** flip `LOTTERY_AMOE_ROUTER` until execute lands. |
| `AmoePlonkVerifier` (paired with multi-entry)     | `0xcEA9e27cC9baF88Cb50777B5cD23fbE8BF53c229` | Deployed with multi-entry router.                                                                                                                                             |
| `LotteryAmoeRouter` (v3, PLONK + 9 public inputs) | `0xf07D4811C55DAB360D4aF802FA9756EBca241DAC` | **Still live** until timelock execute. Has once-per-epoch `usedWalletCommit`.                                                                                                  |
| `LotteryAmoeRouter` (v3, v1.19.1)                 | `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e` | Deprecated — do not point Vercel here after v1.20.0 greenfield cutover.                                                                                                       |
| `LotteryAmoeRouter` (v3, v1.18.0)                 | `0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7` | Deprecated — do not point Vercel here after v1.19.1 greenfield cutover.                                                                                                       |
| `LotteryAmoeRouter` (v3, legacy v1.16.1)          | `0x066e11d795656A2A980585a414BC0fD6BB12e057` | Deprecated — do not point Vercel here after v1.18.0 cutover.                                                                                                                  |
| `LotteryManager4626` (v1.20.0 greenfield)         | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b` | Canonical manager on Registry4626 `0xF60a1490…`.                                                                                                                              |
| `LotteryManager4626` (v1.19.1 greenfield)         | `0xB45E68a5867935a5734E4185977F81c528006650` | Superseded by v1.20.0; existing vaults may still reference.                                                                                                                   |
| `LotteryManager4626` (v1.18.0 remediation)        | `0xB68F359e01626Ec5d15C624037311C70DacAba43` | Superseded 2026-07-15; `isActive=false` on deprecated registry.                                                                                                               |
| `LotteryManager4626` (v1.18.0 prior)              | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` | Superseded 2026-07-11; `isActive=false`.                                                                                                                                      |
| `LotteryManager4626` (v1.16.1)                    | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` | Deprecated manager on prior registry stack.                                                                                                                                   |
| Legacy `LotteryAmoeRouter`                        | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a` | **Deprecated.** Was wired to v1.11 manager `0x04CADE…`; do not point Vercel here.                                                                                             |
| Legacy manager (v1.11)                            | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` | Pre–v1.16.1. Kill-switch relayer after cutover.                                                                                                                               |
| Allowlist + ledger publisher                      | `0x793ca28123cba3ca3c20b9c6c67f37510c89c145` | Protocol CSW (`PROTOCOL_CSW_ADDRESS`) — must match on-chain `allowlistPublisher` / `pointsLedgerPublisher`. Operator personal CSW `0xAb6d5…` is no longer the AMOE publisher. |
| Protocol AMOE creator coin (AKITA)                | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Default target for protocol-entry AMOE flows.                                                                                                                                 |

**Multi-entry cutover (queued 2026-07-29):**

1. Wait until `pendingAmoeRelayerEffectiveAt` (≥ **2026-07-31 17:32:53 UTC**).
2. Run `amoe/tools/ops/execute-amoe-relayer-cutover.sh` (owner key).
3. Flip `LOTTERY_AMOE_ROUTER` / `VITE_LOTTERY_AMOE_ROUTER` to
   `0x44d070C95Da7228BDf316E3DCB81e89FD1D6e338` in local + Vercel.
4. Confirm publisher cron writes allowlist + ledger roots to the **new** router
   (publisher EOA unchanged: `0x793c…`).
5. Smoke: burn-credits → wait snapshot → submit-zk; multi-entry with two burns
   in the same epoch should both settle.

**Post-cutover verification (production):**

1. Verify `LOTTERY_AMOE_ROUTER` resolves to the **live** router in production
   (`0x44d070…` after multi-entry execute; `0xf07D48…` until then).
2. Verify the router points to manager `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b`,
   that the manager authorizes the router, and that publishers resolve to
   protocol CSW (`0x793c…`).
3. Verify allowlist and points-ledger Merkle roots are present for the active
   epoch. Roots are **one-shot per epoch** on each router address.
4. Confirm signed AMOE messages embed
   `Lottery Manager: 0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b`
   (nonce API reads live `LOTTERY_MANAGER` env).

## Environment for v1.20.0 launches

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env                                                   | Client (Vite) env                      | Current value                                |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------- |
| `REGISTRY_4626`                                              | `VITE_REGISTRY`                        | `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` |
| `OVAULT_FACTORY`                                             | `VITE_FACTORY`                         | `0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5` |
| `VAULT_ACTIVATION_BATCHER`                                   | `VITE_VAULT_ACTIVATION_BATCHER`        | `0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3` |
| `LOTTERY_MANAGER`                                            | `VITE_LOTTERY_MANAGER`                 | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b` |
| `VRF_CONSUMER`                                               | `VITE_VRF_CONSUMER`                    | `0x56E2453Bf8Cf2C3FC33E7D18Edc2310297f2a251` |
| `UNIVERSAL_BYTECODE_STORE`                                   | `VITE_UNIVERSAL_BYTECODE_STORE`        | `0x8599CA87b28320158941C59CB3cd9a3f12083530` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER`      | `0xdffB25505F5050E15B3602296330Ef352127d1Ef` |
| `DEPLOYMENT_BATCHER`                                         | `VITE_DEPLOYMENT_BATCHER`              | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |
| `DEPLOYMENT_BATCHER_AUTO_HANDOFF`                            | `VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |
| `VAULT_AUXILIARY_DEPLOY_BATCHER`                             | `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER`  | `0x15eE1D03a5556C28E5079E68763F8231ad68dAdD` |
| `LOTTERY_AMOE_ROUTER`                                        | `VITE_LOTTERY_AMOE_ROUTER`             | `0xf07D4811C55DAB360D4aF802FA9756EBca241DAC` (keep until timelock execute; then `0x44d070C95Da7228BDf316E3DCB81e89FD1D6e338`) |
| —                                                            | `VITE_DEPLOYMENT_VERSION`              | `v1.20.0`                                    |

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

> **Solana lottery OApp peer (LZ entry sender):** unset. Solana→Base lottery
> transport is fail-closed until a reviewed peer is authorized on LM
> `authorizedRemoteOFTs(30168, peer)`. Do not use the retired Twin adapter. Sender mode (`SOLANA_LOTTERY_OAPP_SENDER_MODE`) stays unset until the peer is authorized and an http/mock sender is explicitly configured.

### Solana ShareOFT identity

Solana has no EVM contract address for the Base `CreatorShareOFT`. Each creator
has a distinct Solana SPL mint pubkey and OFT Store pubkey. LayerZero peer
wiring connects that creator's Base ShareOFT to the Solana OFT Store as one
omnichain supply.

| Env key               | Current value                                                        |
| --------------------- | -------------------------------------------------------------------- |
| `SOLANA_DESTINATION`  | `0x5f38e34ec3b546c53e682f2cf84d35d2edcbd15b498367651835942416f8d4d1` |
| `OVAULT_HUB_COMPOSER` | `0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1`                         |
| `OVAULT_SOLANA_EID`   | `30168`                                                              |

Before every creator finalize, seed the non-zero OFT Store peer explicitly:

```solidity
Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)
```

The removed Twin adapter, its env keys, and any batcher-global peer are not
active address/config surfaces.

### Rewards ecosystem (ve■4626) — canary pending

ve■4626 / gauge voting / bribes / streams / surface registry are **not** on the shared-infra table until the first Base broadcast of `DeployRewardsEcosystem`.

| Client env                              | Status            |
| --------------------------------------- | ----------------- |
| `VITE_VE4626`                           | null until canary |
| `VITE_VE4626_GAUGE_VOTING`              | null until canary |
| `VITE_VE4626_BOOST_MANAGER`             | null until canary |
| `VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR` | null until canary |
| `VITE_BRIBES_FACTORY_4626`              | null until canary |
| `VITE_REWARD_STREAM_FACTORY_4626`       | null until canary |
| `VITE_GAUGE_SURFACE_REGISTRY_4626`      | null until canary |

**Runbook:** [rewards-ecosystem-canary-2026-07.md](../operations/rewards-ecosystem-canary-2026-07.md).  
**Lottery posture:** leave LM `boostManager` / `vaultGaugeVoting` at `0x0` until lottery Phase 3 ([lottery-canary-checklist](../operations/lottery-canary-checklist-2026-07.md)).

Redeploy the Vercel app after env changes; run `bash test/current-release-target-guard.sh` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.20.0-bytecode-manifest.json` before traffic cutover.

### Per-Creator Deployments

Vault, wrapper, share OFT, gauge, and oracle addresses are creator-specific and are emitted during each launch flow. Use the deploy release packet and onchain events for creator-level address lookups.

## LayerZero Endpoints

| Chain     | Endpoint ID | Endpoint Address                             |
| --------- | ----------- | -------------------------------------------- |
| Base      | 30184       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Ethereum  | 30101       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Arbitrum  | 30110       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Unichain  | 30320       | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` (non-canonical EndpointV2) |
| Robinhood | 30416       | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` (same CREATE2; different eid) |
| BSC       | 30102       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Avalanche | 30106       | `0x1a44076050125825900e736c501f859c50fE728c` |

## ■AKITA CCA multi-chain

Canonical launch parameters live in `frontend/src/config/ccaLaunchChains.ts`.
Do not invent ShareOFT / arm / oracle addresses — pin via `VITE_AKITA_*_<CHAIN>`
after each chain's deploy lands. Preflight: `pnpm -C frontend ops:verify-cca-multichain`.

Spokes = remote ShareOFT + thin CreatorOracle + CCA arm (vault/wrapper/gauge/Zora
token stay on Base). Pins after deploy: `VITE_AKITA_SHARE_OFT_<CHAIN>` +
`VITE_AKITA_CCA_STRATEGY_<CHAIN>` (oracle is onchain-wired; no env pin).
Chainlink ETH/USD + sequencer feeds: `frontend/src/config/ccaLaunchChains.ts`.

| Chain     | chainId | LZ EID | CCA factory (target) | PoolManager v4 | ■AKITA on this chain |
| --------- | ------- | ------ | -------------------- | -------------- | -------------------- |
| Base      | 8453    | 30184  | v1.1.0 live arm `0xCCcc…0bD5`; new arms → v2.1.0 `0x0000…63F8` | `0x4985…2b2b` | Full hub (AKITA_DEFAULTS) |
| Ethereum  | 1       | 30101  | v2.1.0 `0x000000001F26a0044BaA66024e7b6599c61963F8` | `0x0000…8A90` | ShareOFT + oracle + CCA TBD |
| Arbitrum  | 42161   | 30110  | v2.1.0 `0x000000001F26a0044BaA66024e7b6599c61963F8` | `0x360E…FB32` | **live** (pins below) |
| Unichain  | 130     | 30320  | v2.1.0 `0x000000001F26a0044BaA66024e7b6599c61963F8` | `0x1F98…0004` | ShareOFT + oracle + CCA TBD |
| Robinhood | 4663    | 30416  | v2.1.0 — **deploy ourselves** with `protocolFeeController = address(0)` | `0x8366…0951` | ShareOFT + oracle + CCA TBD |

### Arbitrum spoke (live 2026-07-29)

| Role | Address |
| ---- | ------- |
| Registry4626 (spoke; not Base vanity) | `0xd83bBE25D7d2B45E48a218B541Ca2Aeb2a46627c` |
| Bytecode store / CREATE2 deployer | `0x75FA60e7…117E` / `0x7E3898Eb…a2D6` (epoch `cca-spoke-v1`) |
| ShareOFT (v1.20.0 codeId `0x9ea810ff…`) | `0x6423F4034519ae0bE6A004832EcB14eF6a6c5740` |
| CreatorOracle | `0x248A05BBFE106a976417b5f3258992187B749E11` |
| CCALaunchArm | `0xf1403ab635a9882e4957924bb301c13455e14469` |
| SimpleSellTaxHook | `0xb7971A3038CA0508D086C7e1917544EDf1Ee4088` |

Env pins: `VITE_AKITA_SHARE_OFT_ARBITRUM`, `VITE_AKITA_CCA_STRATEGY_ARBITRUM`.
Hub ShareOFT + hub oracle peers for EID 30110 are wired (treasury Safe).
**Still open:** LayerZero EVM DVN/`setConfig` for Base↔Arb `[15,15]` 3-of-5;
hub→spoke oracle price broadcast; remaining spokes (ETH / Uni / RH).

**Ops:** `EnsureSpokeBytecodeInfra` seeds *current* forge `CreatorShareOFT` creation
code, which can exceed EIP-170 (CREATE reverts with `DeployFailed`). For spokes,
re-seed ShareOFT + CreatorOracle creation bytecode from Base store using v1.20.0
manifest codeIds (`0x9ea810ff…`, `0x00d8de27…`) before `DeployRemoteShareOft` /
`DeployRemoteCreatorOracle`. Constructor owner on spokes = deployer EOA when hub
batcher key is unavailable (`ENFORCE_ADDRESS_PARITY=0`). `DeploySpokeCcaLaunchArm`
forge sim can fail on Arb (ArbSys `0xfe` stub); deploy arm via `cast send --create`
then configure with the script's post-deploy calls.

Hard constraint: factory protocol fee must be zero on every chain
(`CCALaunchArm.migrate()` requires swept currency == `currencyRaised()`).

Chainlink ETH/USD (spoke oracle `setChainlinkFeed`; verified codesize on 2026-07-29):

| Chain     | ETH/USD feed                                   | Sequencer uptime                          |
| --------- | ---------------------------------------------- | ----------------------------------------- |
| Ethereum  | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`   | n/a                                       |
| Base      | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`   | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` |
| Arbitrum  | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612`   | `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` |
| Unichain  | `0xBcE70e194940a157f3A80566505a7E96f5238CCa`   | n/a (decimals=18)                         |
| Robinhood | `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`   | n/a                                       |

Uniswap v4 PositionManager (spoke `setMigrationConfig`; Uniswap deployments docs):

| Chain     | PositionManager                                |
| --------- | ---------------------------------------------- |
| Ethereum  | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e`   |
| Base      | `0x7C5f5A4bBd8fD63184577525326123B519429bDc`   |
| Unichain  | `0x4529A01c7A0410167c5740C487a8de60232617bf`   |
| Arbitrum  | `0xd88F38F930b7952f2Db2432Cb002E7abbf3DD869`   |
| Robinhood | `0x58Daec3116AAe6d93017bAaEA7749052e8A04Fa7`   |

**Ops note:** Base hub registry must be re-seeded so chainId 130 maps to Unichain
LZ `0x6F47…DD5B` / EID 30320 (live registry still had canonical `0x1a44…` + eid 0).

## External Contracts

| Contract                  | Chain | Address                                      |
| ------------------------- | ----- | -------------------------------------------- |
| Chainlink VRF Coordinator | Base  | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| WETH                      | Base  | `0x4200000000000000000000000000000000000006` |
| Sudoswap v2 pair factory  | Base  | `0x605145D263482684590f630E9e581B21E4938eb8` |
| Sudoswap v2 XYK curve     | Base  | `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B` |
| Sudoswap v2 fast router   | Base  | `0xa07eBD56b361Fe79AF706A2bF6d8097091225548` |

### AlfaClub room 1659 LP history

| Role                            | Address / status                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| FriendKey ERC-1155              | `0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F`                                       |
| FriendKey token ID              | `1659`                                                                             |
| Verified Creator Coin (AKITA)   | `0x5b674196812451B7cEC024FE9d22D2c0b172fa75`                                       |
| Retired factory owner           | Protocol treasury Safe `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`                |
| Supported Sudoswap v2 factory   | `0x605145D263482684590f630E9e581B21E4938eb8` (official Base deployment)           |
| Supported Sudoswap v2 XYK curve | `0xd0A2f4ae5E816ec09374c67F6532063B60dE037B` (official Base deployment)           |
| AlfaClub Sudoswap adapter        | `0x961b113FF5E3547e8198758900b8f4Fa552A3Fe5`                                      |
| AlfaClub Universal Router        | `0x14c0e8840A3B7caE49EbdA899C7101A827598e9f`                                      |
| Room 1659 Sudoswap pair          | `0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766`                                      |
| Adapter deployment tx            | `0xd6fc25bdbbc68eb5fdf8d279666b6bfa54758b7857a07d04299d31ce6ccfbef6`               |
| Router deployment tx             | `0x85437706b75f5678f2ad2a163daec1053c43c8044499a640c0969ecad5724397`               |
| Pair creation UserOperation tx   | `0x754c26903d801679161b6d501ac282099d65ee70ddf6959c9104c5e283dbc59b`               |
| Pair ownership-transfer tx       | `0x9ea8c32c977770ac806d9c040ea1767d2f316b669f8e02e2fd8077e0f666855d`               |
| Safe market-configuration tx     | `0xdedaa61bd2892344439dd8e74df03b1b126725c36e50f1aed1b66265b80ac8e6`               |
| Pilot seeder / canonical sender | `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5`                                       |
| Retired AlfaCreatorKeyLPFactory | `0x08156CF52BBD983Daf99a26508462d3593c5f6bf` (historical; do not route new writes) |
| Factory deployment tx           | `0xcc642be6d2b6ca7322a1574dd7628096bd0b3a767ce727c87a7a261a2d5e733e`               |
| Seeder/pair allowlist tx        | `0x3953ee689ea8b527bc3e78e76f56e17f21894e6ef2adf27665bfe5b8a56cfa86`               |

The room creator (`0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9`)
is an AlfaClub identity, not the Creator Coin contract. The retired factory is
source verified on Basescan; its pool registry was empty immediately after
deployment. The supported replacement reuses Sudoswap's official Base v2 factory
and XYK curve. The AlfaClub adapter and Universal Router are pinned above after
successful simulation, broadcast, receipt checks, and live immutable checks. The
Room 1659 pair above is the production pair created from the approved reserve
plan; both routed swap directions were verified against it.
