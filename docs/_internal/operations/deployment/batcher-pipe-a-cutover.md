---
title: Pipe A batcher cutover
doc_template: runbook
---

# Pipe A batcher cutover

Payable `finalizePhase2` + ShareOFT auto-bridge for greenfield vaults.

**Live batcher (v1.14.1):** `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` — [current release](/operations/deployment/releases/current).

Policy: [share mesh lottery](/operations/solana/solana-share-mesh-lottery-policy) · Budget: [share mesh budget paths](/operations/solana/solana-share-mesh-budget-paths)

## Readiness

Pipe A requires live batcher bytecode with:

- Payable `finalizePhase2` / `finalizePhase2WithPermit2`
- Phase 2 split **30/30/30/10** with LZ `send{value}` on the 30% Solana leg
- `solanaShareOftPeer()` + `setSolanaShareOftPeer(bytes32)`
- OVault runtime (Solana EID `30168`), non-zero bridge adapter + destination
- Phase-1 `*WithSalt` accepts non-zero `shareOftSaltOverride`

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1
```

Exit `0` = ready. Look for `phase1_salt_override_enabled: ok`.

## Operator paths

### A. Full batcher epoch (greenfield)

1. Bump deployment epoch + deploy via `script/DeployBaseMainnetDeployer.s.sol`
2. Set Solana + OVault + share-OFT peer env on broadcast
3. Authorize batcher on CREATE2 deployer; update `contracts.defaults.ts` + Vercel batcher env
4. Redeploy app; run `./test/current-release-target-guard.sh`

### B. Phase 2 module hot-swap

When shell has peer storage but Phase 2 module is stale:

```bash
forge script script/UpgradeDeploymentBatcherPhase2Module.s.sol:UpgradeDeploymentBatcherPhase2Module \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

### C. Safe config only

```bash
pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts \
  --batcher 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 \
  --include-share-oft-peer --share-oft-peer 0x<mesh-peer>
```

## Post-cutover checks

| Check | Command |
|-------|---------|
| Readiness | `verify-batcher-pipe-a-readiness.ts` → exit 0 |
| OVault runtime | `cast call $BATCHER "getOVaultRuntimeConfig()(address,uint32,bool)"` |
| Default peer | `cast call $BATCHER "solanaShareOftPeer()(bytes32)"` |
| Dry-run | `pnpm -C frontend run dev:deploy-dry-run` → phase 2 finalize |

## Test gate

```bash
npx vitest run frontend/src/lib/deploy/finalizeShareBridgeFee.test.ts frontend/src/lib/deploy/shareBridgeOftWiring.test.ts
forge test --match-path test/DeploymentBatcher.ShareOftPeerWiring.t.sol
```

Historical epoch notes (v1.11.x Safe queue, deprecated batchers): [archive/batcher-pipe-a-cutover-history](/operations/archive/batcher-pipe-a-cutover-history).
