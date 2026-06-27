---
title: Pipe A cutover history (archived)
status: historical
---

# Pipe A cutover — historical notes

Audit trail for v1.11.x → v1.14.1 batcher epochs. **Do not use for new greenfield deploys.** Current target: [v1.14.1 release](/operations/deployment/releases/current).

## Pre-cutover (deprecated)

Batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` (v1.11.1) had OVault runtime + Solana adapter/destination configured, but **`solanaShareOftPeer()` reverts** on pre–Pipe-A bytecode.

## v1.11.2-pipe-a epoch (2026-05-26)

| Contract | Address |
|----------|---------|
| UniversalBytecodeStoreV2 | `0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4` |
| UniversalCreate2DeployerFromStore | `0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7` |
| DeploymentBatcher (shell) | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| DeploymentBatcherPhase1Module | `0xf3b20557ef8173510693A13EF71F884DB835E8c0` |
| DeploymentBatcherPhase2Module | `0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f` |
| DeploymentBatcherPhase3Helper | `0x3c89e20AbccE3d8F6344AFf6c63c82F5619EFFCB` |
| DeploymentBatcherUniV4Helper | `0xF71a6236586077CD29C971443D2cce37B543DcBB` |
| DeploymentBatcherUtilsHelper | `0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D` |

Safe queue notes (protocol treasury `0x7d429e…`): nonces 76–81 — wire helpers, phase1 module, solana config, OVault runtime. Stale Safe rows cleared via `reject-stale-safe-transactions.ts`.

**Pipe A readiness PASS (2026-05-27)** on batcher `0xa99058…` with platform share-mesh peer bytes32 `0xdf9a9ef7…`.

## LZ Base↔Solana wire (2026-05-27)

Solana share-mesh infra live; Base mesh wire target correction required (scaffold stub `0x4df30…` was wrong — greenfield finalize uses per-vault `CreatorShareOFT`). See [creator provisioning](/operations/solana/solana-share-mesh-creator-provisioning).

## Failed v1.11.2 initcode attempt

Predicted batcher `0x1C29A839386Bac0fD65B23ae9173D1623bFa9C24` — **no code** (EIP-3860 initcode limit). Superseded by successful redeploy.
