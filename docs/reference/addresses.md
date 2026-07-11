---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed contract addresses for 4626 on Base mainnet (**v1.18.0-greenfield**).

> **Post-broadcast:** on-chain cutover complete 2026-07-08. Release packet: [`v1.18.0-greenfield.md`](../_internal/deployment-releases-legacy/v1.18.0-greenfield.md). Handoff: `tmp/base-v1.18.0-handoff.env`.

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
| OVaultFactory4626 | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| VaultActivationBatcher | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| LotteryManager4626 | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| VRFConsumer4626 | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| SolanaBridgeAdapter | `0x9A61814082A26192DD9Cb201b44058506685Be60` |
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

Notes:
- **v1.18.0-greenfield** fresh shared/global + phased deploy infra under epoch tag `v1.18.0`. Phase 3 remains **45% Charm + 45% Ajna + 10% idle**; Solana is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use **Phase1Module immutables** (`phase1Module()` → `0x808fC8…`), not batcher-shell module getters until Safe wiring completes.
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
2. `./script/wire-amoe-router-v1161.sh` — `router.setManager(0xbE87AD…)`, `manager.setAuthorizedAmoeRelayer(<new router>)`, publishers → protocol CSW (`0x793c…`).
3. Set `LOTTERY_AMOE_ROUTER=<new router>` on Vercel (`production`, `preview`, `development`) and redeploy.
4. Republish allowlist + points-ledger Merkle roots on the new router (`/api/v1/lottery/amoe/publish-cron` or manual ops). Roots are **one-shot per epoch** on each router address.
5. Confirm signed AMOE messages embed `Lottery Manager: 0xB68F359e01626Ec5d15C624037311C70DacAba43` (nonce API reads live `LOTTERY_MANAGER` env).

## Environment cutover (v1.18.0-greenfield)

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env | Client (Vite) env | v1.18.0-greenfield value |
|------------|-------------------|---------------------------|
| `REGISTRY_4626` | `VITE_REGISTRY` | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| `OVAULT_FACTORY` | `VITE_FACTORY` | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| `VAULT_ACTIVATION_BATCHER` | `VITE_VAULT_ACTIVATION_BATCHER` | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| `LOTTERY_MANAGER` | `VITE_LOTTERY_MANAGER` | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| `VRF_CONSUMER` | `VITE_VRF_CONSUMER` | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| `UNIVERSAL_BYTECODE_STORE` | `VITE_UNIVERSAL_BYTECODE_STORE` | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| `DEPLOYMENT_BATCHER` | `VITE_DEPLOYMENT_BATCHER` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `SOLANA_BRIDGE_ADAPTER` | `VITE_SOLANA_BRIDGE_ADAPTER` | `0x9A61814082A26192DD9Cb201b44058506685Be60` |
| `LOTTERY_AMOE_ROUTER` | — | `0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7` |
| — | `VITE_DEPLOYMENT_VERSION` | `v1.18.0` |

Sync local env from handoff: `./script/sync-greenfield-env-from-handoff.sh tmp/base-v1.18.0-handoff.env`

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

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
