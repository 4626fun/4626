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
  --batcher 0xa99058f424FB3ACC639F59355C65C40149030651
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

## Known live state

### Pre-cutover (deprecated)

Batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` (v1.11.1) had OVault runtime + Solana adapter/destination configured, but **`solanaShareOftPeer()` reverts** on pre–Pipe-A bytecode. Do not use for greenfield deploys.

### v1.11.2-pipe-a epoch (2026-05-26)

CREATE2 infra + helpers + batcher shell deployed at epoch `v1.11.2-pipe-a`:

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

Safe queue on protocol treasury (`0x7d429e…`):

| Nonce | Action | Status |
|-------|--------|--------|
| 76 | `setOVaultRuntimeConfig` on old batcher | Executed (no-op) |
| 77 | `setSolanaShareOftPeer` on **old** batcher | **Cancel** — pre–Pipe-A bytecode |
| 78 | `wireDeploymentHelpers` on **new** batcher | **Executed** — `0xdef6356c…328a7` (direct Safe exec, bypassed stale queue) |
| 79 | `setPhase1Module` | **Executed** — `0x3717c916…0fd1a` |
| 80 | `setSolanaConfig` | **Executed** — `0x5294eabc…5e53` |
| 81 | `setOVaultRuntimeConfig` | **Executed** — `0xe572a78d…d7c6`; stale tx-service row **rejected** at nonce 81 (`0xfc1d6780…48ee`) |

Clear stale Safe queue rows after direct on-chain exec:

```bash
pnpm -C frontend exec tsx scripts/ops/reject-stale-safe-transactions.ts --list
pnpm -C frontend exec tsx scripts/ops/reject-stale-safe-transactions.ts --nonces 81
```

When the Solana share-mesh peer bytes32 exists:

```bash
pnpm -C frontend exec tsx scripts/ops/execute-batcher-share-oft-peer-safe.ts \\
  --share-oft-peer 0x<mesh-peer-bytes32>
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```

**Still blocked for full Pipe A readiness:** `solanaShareOftPeer` unset — ShareOFT mesh mint/peer for EID `30168` is not provisioned yet (`read-akita-ovault-mesh-onchain.ts` → mesh configured: NO). Propose `setSolanaShareOftPeer` only after mesh peer bytes32 is known.

Safe wiring dry-run:

```bash
pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts \\
  --batcher 0xa99058f424FB3ACC639F59355C65C40149030651 \\
  --include-wire-helpers \\
  --include-ovault-runtime \\
  --ovault-hub-composer 0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1 \\
  --ovault-solana-eid 30168
```

### Failed v1.11.2-pipe-a attempt (2026-05-26, initcode fix)

First attempt predicted batcher `0x1C29A839386Bac0fD65B23ae9173D1623bFa9C24` — **no code** (EIP-3860 initcode limit). Infra salts from that attempt are superseded by the successful redeploy above; do not reuse failed batcher address.

## Test gate (repo)

Before cutover promotion or doc claims:

```bash
npx vitest run frontend/src/lib/deploy/finalizeShareBridgeFee.test.ts frontend/src/lib/deploy/shareBridgeOftWiring.test.ts
forge test --match-path test/DeploymentBatcher.ShareOftPeerWiring.t.sol
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```

Vitest suites include **1000+ iteration** stress loops for fee attach + OFT wiring preflight.
