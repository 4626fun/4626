---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed addresses for 4626 on Base mainnet. Shared infrastructure and new per-creator launches use the **v1.19.3** epoch (v1.19.1 greenfield stack; module and bytecode cutover 2026-07-19).

v1.19.3 is live on the v1.19.1 greenfield stack: current-source v5 vault modules, hardened Phase 2, a fully seeded bytecode store, and active Chainlink VRF on manager `0xB45E68a5…`. v1.19.2 remains a historical bytecode seal. Creator + Agent paid canaries remain outstanding. Prior epochs (v1.19.0 partial, 2026-07-08 cutover, abandoned v1.17.0) are superseded — see Deprecated infrastructure below.

For launch procedures, see [Getting started](/getting-started). This page lists **shared infrastructure** (batcher, factories, registry). Per-creator vault, wrapper, and ShareOFT addresses are emitted at deploy.

**Terms:** **New vault launch** = fresh deploy on the current release (_greenfield_). **Solana bridge at finalize** = ~30% of `■` bridged during activation (_Pipe A_). See [Glossary](/reference/glossary#quick-definitions).

**Canonical source.** When documentation or tooling disagrees with this file, **this file wins**. Addresses link to [BaseScan](https://basescan.org) on Base mainnet.

## Base

### Current infrastructure

| Contract                          | Address                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| Registry4626                      | `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`                                |
| RegistryBootstrap4626             | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB`                                |
| OVaultFactory4626                 | `0xCAb65a066A4D52DD29ffB418B319819176b89610`                                |
| VaultActivationBatcher            | `0x6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA`                                |
| LotteryManager4626                | `0xB45E68a5867935a5734E4185977F81c528006650`                                |
| VRFConsumer4626                   | `0x98fb5e0af3120B32E2E03400B6E51d0bde433670`                                |
| UniversalBytecodeStoreV2          | `0xF9622613682a12E46b914c7498716F42E44c4d36`                                |
| UniversalCreate2DeployerFromStore | `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2`                                |
| CreatorOVaultCoreModule           | `0x5A9F287910050c89cc3447f6Ac54990C2514466a`                                |
| AgentOVaultCoreModule             | `0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE`                                |
| CreatorOVaultStrategiesModule     | `0x6481675Fe2aed61b2D0392Ddd2E67EFCE04c3849`                                |
| CreatorOVaultAdminModule          | `0xD5c887cd16DBb3A9095eB9635ECf57b77D1d9B37`                                |
| DeploymentBatcher                 | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145`                                |
| DeploymentBatcherPhase1Module     | `0xb64bA38aBAe1f64Ff0ca4541bFFF5333d2C0Fd61`                                |
| DeploymentBatcherPhase2Module     | `0x1217bA070DBf64303117939301788925030295d1`                                |
| DeploymentBatcherPhase3Helper     | `0xC54Fb8d8232a8a654E512b3bDf761c8Eb2783B74`                                |
| DeploymentBatcherShareMeshHelper  | `0x73b6efB7196CdFa6c095Dc196559c88818Cd3211`                                |
| DeploymentBatcherUtilsHelper      | `0x8833225A423f4B1BB071702CB68d71fA4af434f2`                                |
| VaultAuxiliaryDeployBatcher       | `0xaA9229c1649a7eC6DA85a76097E0910B24F9408e` (hardened v1.19.1; authorized) |

Notes:

- **v1.19.3** is the current shared/global + per-creator bytecode/CREATE2
  namespace. Infra addresses match the v1.19.1 greenfield deploy.
- Live `DeploymentBatcherPhase1Module` is `0xb64bA38a…` with v5 creator,
  agent, strategies, and admin modules. Safe swap:
  [`0xda9a2bef…`](https://basescan.org/tx/0xda9a2bef6bb2f8959325fa6da5ccbc9b779d5c159fe3de66fa4e5d6264608a9b).
- Live `DeploymentBatcherPhase2Module` is `0x1217bA07…` (current hardened source).
  Safe swap: [`0x95cc671f…`](https://basescan.org/tx/0x95cc671fc6854cc47425c501f63e8e59471e3340913a60a99ad64ab01dd77fbf).
  Shell `deployPhase2Core` selectors unchanged (`0xf9344d88` / `0x6004df9c`).
  Prior module `0xC3Af8F49…` superseded; earlier modules retired.
- Chainlink VRF is active on `VRFConsumer4626`: the consumer is registered on
  subscription `478638396…980789`, configured with the Base key hash, 500,000
  callback gas, and 3 confirmations. Activation transactions:
  [`0x0725bbb1…`](https://basescan.org/tx/0x0725bbb14a89fe614143b26c0bc4924b126eed2ebe39dcf935c590d73a40e481),
  [`0x7b676249…`](https://basescan.org/tx/0x7b676249ec3fe6fb939a384e40d4c6faf126ad3b71e7610d65955ac532307d0f).
- Hardened aux helper `0xaA9229c1…408e` is live and CREATE2-authorized on the
  new store/deployer/batcher stack.
- Prior v1.18.0 stack (registry `0xDb8570…`, batcher `0x02D7…`, aux `0xde93…`)
  is deprecated for **new vault launches**; see Deprecated infrastructure below.
- `RegistryBootstrap4626` is an authorized factory on Registry4626 for ad hoc /
  single-tx token registration + first-time field binds (vault, wrapper, shareOFT,
  oracle, gauge, optional Solana mesh). Owner: `0xB05Cf0…FdD`. Deploy tx:
  [`0xe93ca34b…`](https://basescan.org/tx/0xe93ca34bfe68b5a9b21d19520bb260f8a219de51cf81dfc5cca89f67d9be3553);
  authorize tx:
  [`0xd1d838dc…`](https://basescan.org/tx/0xd1d838dcb95b48b6eb19dce8147c3e4faa3145cf36512b8aab3eb463cb42d153)
  (2026-07-12). Bribes factory left unset until ve■4626 canary.
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use active module immutables. The shell
  `lotteryManager()` getter is historical/non-authoritative after the Phase2
  hot-swap.
- Pre-v1.18.0 batchers (including `0xA9024e…` v1.16.1) are deprecated for **new vault launches**.

### Deprecated infrastructure

| Epoch / label                    | Representative addresses                                                                     | Notes                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
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
| `LotteryAmoeRouter` (v3, PLONK + 9 public inputs) | `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e` | **Live v1.19.1 router** wired to manager `0xB45E68a5…`.                                                                                                                       |
| `LotteryAmoeRouter` (v3, v1.18.0)                 | `0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7` | Deprecated — do not point Vercel here after v1.19.1 greenfield cutover.                                                                                                       |
| `LotteryAmoeRouter` (v3, legacy v1.16.1)          | `0x066e11d795656A2A980585a414BC0fD6BB12e057` | Deprecated — do not point Vercel here after v1.18.0 cutover.                                                                                                                  |
| `LotteryManager4626` (v1.19.1 greenfield)         | `0xB45E68a5867935a5734E4185977F81c528006650` | Canonical manager on Registry4626 `0x1365e9…`.                                                                                                                                |
| `LotteryManager4626` (v1.18.0 remediation)        | `0xB68F359e01626Ec5d15C624037311C70DacAba43` | Superseded 2026-07-15; `isActive=false` on deprecated registry.                                                                                                               |
| `LotteryManager4626` (v1.18.0 prior)              | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` | Superseded 2026-07-11; `isActive=false`.                                                                                                                                      |
| `LotteryManager4626` (v1.16.1)                    | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` | Deprecated manager on prior registry stack.                                                                                                                                   |
| Legacy `LotteryAmoeRouter`                        | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a` | **Deprecated.** Was wired to v1.11 manager `0x04CADE…`; do not point Vercel here.                                                                                             |
| Legacy manager (v1.11)                            | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` | Pre–v1.16.1. Kill-switch relayer after cutover.                                                                                                                               |
| Allowlist + ledger publisher                      | `0x793ca28123cba3ca3c20b9c6c67f37510c89c145` | Protocol CSW (`PROTOCOL_CSW_ADDRESS`) — must match on-chain `allowlistPublisher` / `pointsLedgerPublisher`. Operator personal CSW `0xAb6d5…` is no longer the AMOE publisher. |
| Protocol AMOE creator coin (AKITA)                | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Default target for protocol-entry AMOE flows.                                                                                                                                 |

**Post-cutover verification (production):**

1. Verify `LOTTERY_AMOE_ROUTER` resolves to
   `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e` in production and that the
   deployed app reports the same router.
2. Verify the router points to manager `0xB45E68a5867935a5734E4185977F81c528006650`,
   that the manager authorizes the router, and that publishers resolve to
   protocol CSW (`0x793c…`).
3. Verify allowlist and points-ledger Merkle roots are present for the active
   epoch. Roots are **one-shot per epoch** on each router address.
4. Confirm signed AMOE messages embed
   `Lottery Manager: 0xB45E68a5867935a5734E4185977F81c528006650`
   (nonce API reads live `LOTTERY_MANAGER` env).

## Environment for v1.19.3 launches

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env                                                   | Client (Vite) env                      | Current value                                |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------- |
| `REGISTRY_4626`                                              | `VITE_REGISTRY`                        | `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` |
| `REGISTRY_BOOTSTRAP_4626`                                    | —                                      | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| `OVAULT_FACTORY`                                             | `VITE_FACTORY`                         | `0xCAb65a066A4D52DD29ffB418B319819176b89610` |
| `VAULT_ACTIVATION_BATCHER`                                   | `VITE_VAULT_ACTIVATION_BATCHER`        | `0x6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA` |
| `LOTTERY_MANAGER`                                            | `VITE_LOTTERY_MANAGER`                 | `0xB45E68a5867935a5734E4185977F81c528006650` |
| `VRF_CONSUMER`                                               | `VITE_VRF_CONSUMER`                    | `0x98fb5e0af3120B32E2E03400B6E51d0bde433670` |
| `UNIVERSAL_BYTECODE_STORE`                                   | `VITE_UNIVERSAL_BYTECODE_STORE`        | `0xF9622613682a12E46b914c7498716F42E44c4d36` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER`      | `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2` |
| `DEPLOYMENT_BATCHER`                                         | `VITE_DEPLOYMENT_BATCHER`              | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| `DEPLOYMENT_BATCHER_AUTO_HANDOFF`                            | `VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| `VAULT_AUXILIARY_DEPLOY_BATCHER`                             | `VITE_VAULT_AUXILIARY_DEPLOY_BATCHER`  | `0xaA9229c1649a7eC6DA85a76097E0910B24F9408e` |
| `LOTTERY_AMOE_ROUTER`                                        | —                                      | `0x630c3769Cf1D80c6cb8cCB7c011f5A76904C4C1e` |
| —                                                            | `VITE_DEPLOYMENT_VERSION`              | `v1.19.3`                                    |

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

Redeploy the Vercel app after env changes; run `bash test/current-release-target-guard.sh` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.19.1-bytecode-manifest.json` before traffic cutover.

### Per-Creator Deployments

Vault, wrapper, share OFT, gauge, and oracle addresses are creator-specific and are emitted during each launch flow. Use the deploy release packet and onchain events for creator-level address lookups.

## LayerZero Endpoints

| Chain     | Endpoint ID | Endpoint Address                             |
| --------- | ----------- | -------------------------------------------- |
| Base      | 30184       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Ethereum  | 30101       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Arbitrum  | 30110       | `0x1a44076050125825900e736c501f859c50fE728c` |
| BSC       | 30102       | `0x1a44076050125825900e736c501f859c50fE728c` |
| Avalanche | 30106       | `0x1a44076050125825900e736c501f859c50fE728c` |

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
