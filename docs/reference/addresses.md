---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed contract addresses for 4626 on Base mainnet. Shared
infrastructure is the **v1.18.0** stack; new per-creator launches use the
**v1.19.0** bytecode/CREATE2 epoch.

> **v1.19.1 aux helper rotated (2026-07-15):** hardened
> `VaultAuxiliaryDeployBatcher` `0xde93Aeca…D99b` is live and CREATE2-authorized;
> `AgentRevenuePolicyController` is seeded. Do **not** flip
> `CURRENT_RELEASE` / `VITE_DEPLOYMENT_VERSION` until remaining v1.19.1 store
> seeds + Creator/Agent canaries complete. Safe codeId approvals skipped
> (live `DeploymentBatcher` has no allowlist). Runbook:
> [`deploy-capable-batcher-rotation.md`](../_internal/operations/deployment/deploy-capable-batcher-rotation.md).

> **v1.19 partial refresh:** release packet:
> [`v1.19.0-partial-refresh.md`](../_internal/deployment-releases-legacy/v1.19.0-partial-refresh.md).
> This reuses the v1.18 shared addresses and changes only bytecode/codeIds,
> Phase2 module wiring, lottery configuration, and the launch namespace.

> **Cutover complete (2026-07-08):** treasury Safe wiring, AMOE router `0x18D180…` on manager (updated **2026-07-11** to remediation LM `0xB68F359e…`), bytecode store seeded, Vercel production/development env synced, legacy v1.16.1 manager AMOE relayer kill-switched. Preview env vars remain dashboard-only (Vercel CLI skips preview targets).

> **Abandoned:** v1.17.0 partial broadcast (orphan infra only). Handoff: `tmp/base-v1.17.0-handoff.env`.

For launch procedures, see [Getting started](/getting-started). This page lists **shared infrastructure** (batcher, factories, registry). Per-creator vault, wrapper, and ShareOFT addresses are emitted at deploy and available in the application and onchain events.

> **Terms:** **New vault launch** = fresh deploy on the current release (internal: *greenfield*). **Solana bridge at finalize** = ~30% of `■` bridged during activation (internal: *Pipe A*). See [Glossary](/reference/glossary#quick-definitions).

> **Canonical source.** When documentation or tooling disagrees with this file, **this file wins**. Addresses link to [BaseScan](https://basescan.org) on Base mainnet.

## Base

### Current infrastructure

| Contract | Address |
|----------|---------|
| Registry4626 | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| RegistryBootstrap4626 | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| OVaultFactory4626 | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| VaultActivationBatcher | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| LotteryManager4626 | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| VRFConsumer4626 | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| UniversalBytecodeStoreV2 | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| UniversalCreate2DeployerFromStore | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| CreatorOVaultCoreModule | `0xE5C1de158Cb66ffCE15b26BE6F40f598c642EF43` |
| CreatorOVaultStrategiesModule | `0x8757065daf34D8B536FC35BdfE3001D43FAbAA7e` |
| CreatorOVaultAdminModule | `0x506400ce30228378Ee4682cfcBD55625154Bc063` |
| DeploymentBatcher | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| DeploymentBatcherPhase1Module | `0x808fC8e83629019e29df79E592237B4603F9D1b5` |
| DeploymentBatcherPhase2Module | `0x9845D8d412DA4686FE8b1886F314Ef8b288b8D71` |
| DeploymentBatcherPhase3Helper | `0xB8c10FE668d59E2DEb5771298133c2a3DBFc9bB3` |
| DeploymentBatcherShareMeshHelper | `0x9C965724f6B3387433D82bf67632Bf06470a8988` |
| DeploymentBatcherUtilsHelper | `0xCBf24949Fc99e7C9b5e16e15a423543930fd4A52` |
| VaultAuxiliaryDeployBatcher | `0xde93AecaAd5A61dFC179703d522fBE9a5747D99b` (hardened v1.19.1; authorized) |

Notes:
- **v1.18.0** remains the shared/global infrastructure epoch. **v1.19.0** is
  the per-creator bytecode and CREATE2 namespace for new launches.
- **v1.19.1** aux helper is rotated onchain; release target /
  `VITE_DEPLOYMENT_VERSION` stay on **v1.19.0** until remaining store seeds
  and canaries complete.
- Prior pre-hardening helper `0xa3986F2F…eb88` is superseded; leave it
  deauthorized on CREATE2.
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

| Epoch / label | Representative addresses | Notes |
|---------------|-------------------------|-------|
| v1.16.1-share-mesh | Registry `0x1eb9A3…`, batcher `0xA9024e…`, store `0x7D1029…` | Superseded by v1.18.0; existing vaults may still reference |
| v1.17.0 orphan | Registry `0x5646B5…`, batcher `0xa4090F…` | Partial broadcast — never wired for production |
| v1.16.0 shell | Batcher `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33` | Lacks `shareMeshHelper()` |
| v1.14.1 shell | Batcher `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` | Pre–share-mesh |
| v1.14.0 shell | Batcher `0xa99058f424FB3ACC639F59355C65C40149030651` | Pre–v1.14.1 refresh |
| Legacy AMOE router | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a` | v1.11 manager fan-out |
| Legacy lottery manager | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` | Pre–v1.16.1 registry stack |
| Retired Twin SolanaBridgeAdapter | `0x9A61814082A26192DD9Cb201b44058506685Be60` | Historical on-chain deployment only; removed from source and active env/defaults |

### Protocol Safes

| Role | Address |
|------|---------|
| Protocol treasury Safe (cold custody, strategy ownership) | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| Protocol automation Safe (hot lane — Charm manager, Ajna admin) | `0x08f0875E40781578F902998b2b831cc48d838eBE` |

Do **not** set `PROTOCOL_AUTOMATION_SAFE` to the treasury address. Phase 3 deploys wire Charm `manager` and Ajna `admin` to the automation Safe; treasury keeps adapter ownership only.

### AMOE (ZK lottery entry)

| Contract / role | Address | Notes |
|-----------------|---------|-------|
| `LotteryAmoeRouter` (v3, PLONK + 9 public inputs) | `0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7` | **Live v1.18.0 router** wired to manager `0xB68F359e…`. |
| `LotteryAmoeRouter` (v3, legacy v1.16.1) | `0x066e11d795656A2A980585a414BC0fD6BB12e057` | Deprecated — do not point Vercel here after v1.18.0 cutover. |
| `LotteryManager4626` (v1.18.0 remediation) | `0xB68F359e01626Ec5d15C624037311C70DacAba43` | Canonical manager on Registry4626 `0xDb8570…` (CREATE2 2026-07-11; PricingLib + single-vault + deferred VRF). |
| `LotteryManager4626` (v1.18.0 prior) | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` | Superseded 2026-07-11; `isActive=false`. |
| `LotteryManager4626` (v1.16.1) | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` | Deprecated manager on prior registry stack. |
| Legacy `LotteryAmoeRouter` | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a` | **Deprecated.** Was wired to v1.11 manager `0x04CADE…`; do not point Vercel here. |
| Legacy manager (v1.11) | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` | Pre–v1.16.1. Kill-switch relayer after cutover. |
| Allowlist + ledger publisher | `0x793ca28123cba3ca3c20b9c6c67f37510c89c145` | Protocol CSW (`PROTOCOL_CSW_ADDRESS`) — must match on-chain `allowlistPublisher` / `pointsLedgerPublisher`. Operator personal CSW `0xAb6d5…` is no longer the AMOE publisher. |
| Protocol AMOE creator coin (AKITA) | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Default target for protocol-entry AMOE flows. |

**Cutover checklist (production):**

1. Deploy fresh `LotteryAmoeRouter` via `script/DeployLotteryAmoeRouter.s.sol` (PLONK v3).
2. Verify the live router points to `0xB68F359e…`, that manager authorizes the router, and that publishers resolve to protocol CSW (`0x793c…`). The v1.16.1 wiring script is historical and must not be reused.
3. Set `LOTTERY_AMOE_ROUTER=<new router>` on Vercel (`production`, `preview`, `development`) and redeploy.
4. Republish allowlist + points-ledger Merkle roots on the new router (`/api/v1/lottery/amoe/publish-cron` or manual ops). Roots are **one-shot per epoch** on each router address.
5. Confirm signed AMOE messages embed `Lottery Manager: 0xB68F359e01626Ec5d15C624037311C70DacAba43` (nonce API reads live `LOTTERY_MANAGER` env).

## Environment for v1.19.0 launches

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env | Client (Vite) env | Current value |
|------------|-------------------|---------------------------|
| `REGISTRY_4626` | `VITE_REGISTRY` | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| `REGISTRY_BOOTSTRAP_4626` | — | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| `OVAULT_FACTORY` | `VITE_FACTORY` | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| `VAULT_ACTIVATION_BATCHER` | `VITE_VAULT_ACTIVATION_BATCHER` | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| `LOTTERY_MANAGER` | `VITE_LOTTERY_MANAGER` | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| `VRF_CONSUMER` | `VITE_VRF_CONSUMER` | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| `UNIVERSAL_BYTECODE_STORE` | `VITE_UNIVERSAL_BYTECODE_STORE` | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| `DEPLOYMENT_BATCHER` | `VITE_DEPLOYMENT_BATCHER` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `LOTTERY_AMOE_ROUTER` | — | `0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7` |
| — | `VITE_DEPLOYMENT_VERSION` | `v1.19.0` |

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

### Solana ShareOFT identity

Solana has no EVM contract address for the Base `CreatorShareOFT`. Each creator
has a distinct Solana SPL mint pubkey and OFT Store pubkey. LayerZero peer
wiring connects that creator's Base ShareOFT to the Solana OFT Store as one
omnichain supply.

Before every creator finalize, seed the non-zero OFT Store peer explicitly:

```solidity
Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)
```

The removed Twin adapter, its env keys, and any batcher-global peer are not
active address/config surfaces.

### Rewards ecosystem (ve■4626) — canary pending

ve■4626 / gauge voting / bribes / streams / surface registry are **not** on the shared-infra table until the first Base broadcast of `DeployRewardsEcosystem`.

| Client env | Status |
|------------|--------|
| `VITE_VE4626` | null until canary |
| `VITE_VE4626_GAUGE_VOTING` | null until canary |
| `VITE_VE4626_BOOST_MANAGER` | null until canary |
| `VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR` | null until canary |
| `VITE_BRIBES_FACTORY_4626` | null until canary |
| `VITE_REWARD_STREAM_FACTORY_4626` | null until canary |
| `VITE_GAUGE_SURFACE_REGISTRY_4626` | null until canary |

**Runbook:** [rewards-ecosystem-canary-2026-07.md](../operations/rewards-ecosystem-canary-2026-07.md).  
**Lottery posture:** leave LM `boostManager` / `vaultGaugeVoting` at `0x0` until lottery Phase 3 ([lottery-canary-checklist](../operations/lottery-canary-checklist-2026-07.md)).

Redeploy the Vercel app after env changes; run `bash test/current-release-target-guard.sh` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.18.0-bytecode-manifest.json` before traffic cutover.

### Per-Creator Deployments

Vault, wrapper, share OFT, gauge, and oracle addresses are creator-specific and are emitted during each launch flow. Use the deploy release packet and onchain events for creator-level address lookups.

## LayerZero Endpoints

| Chain | Endpoint ID | Endpoint Address |
|-------|-------------|------------------|
| Base | 30184 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Ethereum | 30101 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Arbitrum | 30110 | `0x1a44076050125825900e736c501f859c50fE728c` |
| BSC | 30102 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Avalanche | 30106 | `0x1a44076050125825900e736c501f859c50fE728c` |

## External Contracts

| Contract | Chain | Address |
|----------|-------|---------|
| Chainlink VRF Coordinator | Base | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| WETH | Base | `0x4200000000000000000000000000000000000006` |

### AlfaClub room 1659 LP pilot

| Role | Address / status |
|------|------------------|
| FriendKey ERC-1155 | `0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F` |
| FriendKey token ID | `1659` |
| Verified Creator Coin (AKITA) | `0x5b674196812451B7cEC024FE9d22D2c0b172fa75` |
| Factory owner | Protocol treasury Safe `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| Pilot seeder / canonical sender | `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5` |
| AlfaCreatorKeyLPFactory | `0x08156CF52BBD983Daf99a26508462d3593c5f6bf` |
| Factory deployment tx | `0xcc642be6d2b6ca7322a1574dd7628096bd0b3a767ce727c87a7a261a2d5e733e` |
| Seeder/pair allowlist tx | `0x3953ee689ea8b527bc3e78e76f56e17f21894e6ef2adf27665bfe5b8a56cfa86` |

The room creator (`0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9`)
is an AlfaClub identity, not the Creator Coin contract. The factory is source
verified on Basescan; its pool registry was empty immediately after deployment.
