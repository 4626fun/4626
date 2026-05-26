# Batcher Pipe A cutover (payable finalize + ShareOFT auto-bridge)

Operator runbook for greenfield vault deploys that auto-bridge **30% of ShareOFT** to Solana during `finalizePhase2` (Pipe A). Policy: [solana-share-mesh-lottery-policy.md](../solana-share-mesh-lottery-policy.md).

## What “ready” means

Pipe A finalize requires the **live** `DeploymentBatcher` bytecode to include:

- `payable finalizePhase2` / `finalizePhase2WithPermit2`
- Phase 2 split **30/30/30/10** with LZ `send{value}` on the 30% Solana allocation
- `solanaShareOftPeer()` storage + `setSolanaShareOftPeer(bytes32)`
- OVault runtime enabled with Solana EID `30168`
- Non-zero `solanaBridgeAdapter` + `solanaDestination`

Registry peer OR batcher default peer must resolve before finalize; the module seeds registry from `batcher.solanaShareOftPeer()` when registry peer is unset.

## Readiness gate (no mutations)

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8
```

Exit `0` = ready. Exit `2` = blocked (typical failure: `solana_share_oft_peer_selector` on pre-Pipe-A batcher).

## Cutover paths

### A. Full batcher epoch (preferred for greenfield)

1. Bump `DEPLOYMENT_EPOCH_TAG` and run `script/DeployBaseMainnetDeployer.s.sol` with fresh CREATE2 salts.
2. Set env on broadcast (treasury signer):
   - `CONFIGURE_SOLANA=1` + `SOLANA_BRIDGE_ADAPTER` + `SOLANA_DESTINATION`
   - `CONFIGURE_OVAULT_RUNTIME=1` + `OVAULT_HUB_COMPOSER` + `OVAULT_SOLANA_EID=30168`
   - `CONFIGURE_SOLANA_SHARE_OFT_PEER=1` + `SOLANA_SHARE_OFT_PEER=0x<mesh-peer>`
3. Authorize new batcher on `UniversalCreate2DeployerFromStore` (script does this inline).
4. Update `SPLIT_PHASE1_DEPLOYMENT_BATCHER` in `frontend/src/config/contracts.defaults.ts` + Vercel `CREATOR_VAULT_BATCHER*`.
5. Redeploy production (`vercel deploy --prod --archive=tgz`).
6. Re-run readiness gate + `bash test/current-release-target-guard.sh`.

### B. Phase 2 module hot-swap (same batcher address)

When batcher outer shell already has `setSolanaShareOftPeer` but Phase 2 module bytecode is stale:

```bash
forge script script/UpgradeDeploymentBatcherPhase2Module.s.sol:UpgradeDeploymentBatcherPhase2Module \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

Requires `PRIVATE_KEY` = `protocolTreasury()`.

### C. Safe config only (existing Pipe-A batcher)

Dry-run then propose:

```bash
pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts \
  --batcher 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 \
  --include-share-oft-peer \
  --share-oft-peer 0x<mesh-peer>

pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts --propose ...
pnpm -C frontend exec tsx scripts/ops/execute-pending-safe-txs.ts <safeTxHash>
```

Or Foundry treasury broadcast:

```bash
CONFIGURE_SOLANA_SHARE_OFT_PEER=1 SOLANA_SHARE_OFT_PEER=0x<mesh-peer> \
  forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

## Default mesh peer

`SOLANA_SHARE_OFT_PEER` is the platform fallback when per-creator registry peer is unset at finalize. Coordinate with OVault mesh provisioning — it must match the Solana share-mesh OFT peer for EID `30168`, not bridge-wrapped creator SPL mints.

## Post-cutover verification

| Check | Command |
|-------|---------|
| Readiness script | `verify-batcher-pipe-a-readiness.ts` → exit 0 |
| OVault runtime | `cast call $BATCHER "getOVaultRuntimeConfig()(address,uint32,bool)"` |
| Default peer | `cast call $BATCHER "solanaShareOftPeer()(bytes32)"` |
| Deploy UI | `/deploy/vault` → Pipe A wiring panel shows peer + quoted LZ fee |
| Dry-run | `pnpm -C frontend run dev:deploy-dry-run` → phase2 finalize passes |

## Known live state (pre-cutover)

Canonical batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` already has OVault runtime + Solana adapter/destination configured, but **`solanaShareOftPeer()` reverts** until bytecode cutover. Greenfield finalize bridge will fail with `SolanaShareOftPeerNotConfigured` until cutover completes.

### v1.11.2-pipe-a epoch attempt (2026-05-26)

CREATE2 infra for epoch `v1.11.2-pipe-a` partially landed; **DeploymentBatcher deploy failed** (`0x84826fad…`, predicted address `0x1C29A839386Bac0fD65B23ae9173D1623bFa9C24` has no code). Store + create2 deployer + vault modules at that epoch **did** deploy — do not reuse the same salts until the batcher failure root cause is fixed.

Safe queue on protocol treasury (`0x7d429e…`):

| Nonce | Action | Status |
|-------|--------|--------|
| 76 | `setOVaultRuntimeConfig` | Executed (no-op — already configured) |
| 77 | `setSolanaShareOftPeer` on **old** batcher | **Do not execute** — GS013 inner revert until Pipe-A bytecode is live; cancel and re-propose against the **new** batcher after successful cutover |

`SOLANA_SHARE_OFT_PEER` must be the Solana **ShareOFT mesh peer** (bytes32), not `SOLANA_DESTINATION` (LZ recipient wallet).

## Test gate (repo)

Before cutover promotion or doc claims:

```bash
npx vitest run frontend/src/lib/deploy/finalizeShareBridgeFee.test.ts frontend/src/lib/deploy/shareBridgeOftWiring.test.ts
forge test --match-path test/DeploymentBatcher.ShareOftPeerWiring.t.sol
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```

Vitest suites include **1000+ iteration** stress loops for fee attach + OFT wiring preflight.
