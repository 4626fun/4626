---
title: Pipe A batcher cutover
doc_template: runbook
---

# Pipe A batcher cutover

Payable `finalizePhase2` + ShareOFT auto-bridge for greenfield vaults.

**Live batcher (v1.19.0):** `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` — [current release](/operations/deployment/releases/current).

Policy: [share mesh lottery](/operations/solana/solana-share-mesh-lottery-policy) · Budget: [share mesh budget paths](/operations/solana/solana-share-mesh-budget-paths)

> **Retired:** Twin `solanaBridgeAdapter` / batcher-global `solanaShareOftPeer` /
> `setSolanaShareOftPeer`. Per-creator peers are seeded on
> `Registry4626.setRemoteOFTPeerBytes32`. Batcher shell only needs destination +
> OVault runtime.

## Readiness

Pipe A requires live batcher bytecode with:

- Payable `finalizePhase2` / `finalizePhase2WithPermit2`
- Phase 2 split **30/30/30/10** with LZ `send{value}` on the 30% Solana leg
- Non-zero `solanaDestination()` + enabled `getOVaultRuntimeConfig()` (Solana EID `30168`)
- Phase-1 `*WithSalt` accepts non-zero `shareOftSaltOverride`
- Per-creator Solana peer seeded in `Registry4626` (not a batcher-global peer)

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x02D7abC547F8B1e7E2D7a919D8D1005918361750
```

Exit `0` = batcher shell ready (destination + OVault runtime + modules + registry auth + salt).
Look for `phase1_salt_override_enabled: ok`. Seed each creator peer separately before finalize.

## Operator paths

### A. Full batcher epoch (greenfield)

1. Bump deployment epoch + deploy via `script/DeployBaseMainnetDeployer.s.sol`
2. Set Solana destination + OVault runtime env on broadcast (`setSolanaDestination` / `setOVaultRuntimeConfig`)
3. Authorize batcher on CREATE2 deployer; update `contracts.defaults.ts` + Vercel batcher env
4. Redeploy app; run `./test/current-release-target-guard.sh`
5. For each creator: provision LZ OFT + `Registry4626.setRemoteOFTPeerBytes32` ([creator provisioning](/operations/solana/solana-share-mesh-creator-provisioning))

### B. Phase 2 module hot-swap

When shell has destination/runtime but Phase 2 module is stale:

```bash
forge script script/UpgradeDeploymentBatcherPhase2Module.s.sol:UpgradeDeploymentBatcherPhase2Module \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

### C. Registration Safe packet

Generate the current unsigned packet:

```bash
pnpm -C frontend exec tsx scripts/ops/execute-v1190-registration-plane-safe.ts \
  --dry-run
```

Require `operationCount: 11`. The packet contains five module-codehash
approvals, helper wiring, Phase 1 selection, codeId approval, factory
authorization, destination, and OVault runtime. Regenerate after any handoff,
manifest, address, or operation change; never reuse stale adapter/global-peer
calldata.

Twin/global-peer Safe scripts (`propose-batcher-solana-config-safe.ts`,
`execute-*-share-oft-peer-safe.ts`) are **fail-closed**. Wire destination + OVault
runtime via current Safe ops / cutover scripts that call `setSolanaDestination` and
`setOVaultRuntimeConfig` only. Seed peers with:

```bash
export REGISTRY=0x…
export CREATOR_TOKEN=0x…
export SOLANA_EID=30168
export SOLANA_REMOTE_OFT_PEER_BYTES32=0x<mesh-peer>

forge script script/SeedRegistry4626SolanaPeer.s.sol:SeedRegistry4626SolanaPeer \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

## Post-cutover checks

| Check | Command |
|-------|---------|
| Readiness | `verify-batcher-pipe-a-readiness.ts` → exit 0 |
| OVault runtime | `cast call $BATCHER "getOVaultRuntimeConfig()(address,uint32,bool)"` |
| Destination | `cast call $BATCHER "solanaDestination()(bytes32)"` |
| Per-creator peer | `cast call $REGISTRY "getRemoteOFTPeerBytes32(address,uint32)(bytes32)" $CREATOR 30168` |
| Dry-run | `pnpm -C frontend run dev:deploy-dry-run` → phase 2 finalize |

## Test gate

```bash
npx vitest run frontend/src/lib/deploy/finalizeShareBridgeFee.test.ts frontend/src/lib/deploy/shareBridgeOftWiring.test.ts
forge test --match-path test/DeploymentBatcher.ShareOftPeerWiring.t.sol
```

Historical epoch notes (v1.11.x Safe queue, deprecated batchers, Twin global peer): [archive/batcher-pipe-a-cutover-history](/operations/archive/batcher-pipe-a-cutover-history).
