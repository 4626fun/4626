# Greenfield launch readiness

> **Plain language:** checklist for **new vault launches** (not grandfather migrations). **Release:** v1.20.0 batcher `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032`.

Repeatable gate for **new vault deploys** (not grandfather migrations). Policy:
[solana-share-mesh-lottery-policy.md](../solana/solana-share-mesh-lottery-policy.md).

**AKITA full-stack redeploy:** use the dedicated checklist and one-command gate in [akita-full-stack-prelaunch.md](../../akita/akita-full-stack-prelaunch.md) (`pnpm -C frontend ops:verify-akita-prelaunch --production`).

## Two launch moments

| Milestone | Ready when | Solana lottery relay |
|-----------|------------|----------------------|
| **Base vault live** | Deploy session complete; Base ShareOFT buy → lottery works | Unavailable; former Twin workflows removed |
| **Solana trading live** | Per-creator LZ OFT store/mint + explicit registry peer + Meteora pool + LP | Unavailable; lottery remains on Base |

Base launch does not require Solana lottery relay.

## Platform gate (once)

Run before opening deploy to creators:

| Check | Command / URL |
|-------|----------------|
| Batcher OVault runtime | `cast call $BATCHER "getOVaultRuntimeConfig()(address,uint32,bool)"` → hub + EID `30168` + `true` |
| Pipe A batcher readiness | `pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts --batcher 0xa18169caf37fa0347285B16aAFC2B09eCB43F145` → exit 0 |
| Per-creator route | LZ OFT store/mint exists and `Registry4626.getRemoteOFTPeerBytes32(creatorToken, 30168)` is non-zero before finalize |
| Orchestrator | `curl https://orchestrator.4626.fun/healthz` → `ok: true` |
| Release target | `bash test/current-release-target-guard.sh` |
| Keeper registry auth | `curl -H "Authorization: Bearer $KPR_API_KEY" https://app.4626.fun/api/vaults/active?chainId=8453` |

### Required production configuration (Solana deploy lane)

| Variable | Purpose |
|----------|---------|
| `DEPLOYMENT_BATCHER` / `VITE_DEPLOYMENT_BATCHER` | v1.20.0 batcher `0x83A9…8032` |
| Batcher onchain config | Non-zero destination + enabled OVault runtime (Solana EID `30168`) |
| Registry per-creator config | Explicit `setRemoteOFTPeerBytes32` before finalize |

Redeploy production after env changes (`vercel deploy --prod --archive=tgz`).

### Keeper env (pre-launch defaults)

**Vercel:**

```bash
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,price_monitor
KEEPER_SOLANA_RECONCILE_WORKFLOW=solana-orchestrator
SOLANA_ORCHESTRATOR_URL=https://orchestrator.4626.fun
```

**Vultr** (`/etc/4626/solana-keeper-orchestrator.env`):

```bash
SOLANA_ORCHESTRATOR_EXECUTE=1
```

## Per-creator prep (before Deploy)

1. Creator coin on Zora; payout recipient correct  
2. **50M+** creator tokens for vault deposit  
3. Wallet **execution-ready** (parent CSW + embedded owner, or EOA track)  
4. Paid **`vault_full_deploy`** ($499) active/pending at `/creator/strategy/features`
   (bundles Charm + Ajna + Solana mesh + Meteora entitlement — all-or-nothing;
   legacy individual comp rows still work for grandfathered creators)
5. Optional: fork dry-run — `pnpm -C frontend run dev:deploy-dry-run`

Pipe A (30% ShareOFT auto-bridge at finalize) additionally requires a
**Pipe-A-ready batcher** and an explicit peer for this creator — see
[batcher-pipe-a-cutover.md](/operations/deployment/batcher-pipe-a-cutover):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```

Expect `readyForPipeAFinalizeBridge: true`. The deprecated `solana_bridge_strategy` Phase-3 TVL lane is removed; Solana share seeding happens in Phase 2 finalize instead.

Provision the per-creator LayerZero OFT store/mint and seed
`Registry4626.setRemoteOFTPeerBytes32` by following
[Solana share-mesh creator provisioning](/operations/solana/solana-share-mesh-creator-provisioning).
The Twin adapter/provisioner and batcher-global peer were removed; they are not
fallbacks.

## Deploy session checklist

- Phases 1–3 complete (+ Phase 4 if deferred launch)  
- If Solana enabled: session reaches `ovault_mesh_confirmed`  
- Base smoke: deposit, withdraw, ShareOFT **buy** → lottery entry  

## Solana post-launch (Meteora trading)

After Path 1, create and seed the Meteora pool against the creator's LZ
share-mesh mint using
[Solana share-mesh budget paths](/operations/solana/solana-share-mesh-budget-paths).
Base Uniswap lottery remains live. The former Twin entry/winner relay workflows
and creator-SPL/Alpha-Vault grain are not greenfield routes.

## Ops helpers

```bash
# Historical v1.19.0 packet audit only; do not execute for v1.19.1
pnpm -C frontend exec tsx scripts/ops/execute-v1190-registration-plane-safe.ts --dry-run

# Read-only Pipe A readiness gate
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts

# Execute queued Safe txs (1-of-N threshold met)
pnpm -C frontend exec tsx scripts/ops/execute-pending-safe-txs.ts <safeTxHash>...
```

Cutover runbook: [deployment/batcher-pipe-a-cutover.md](/operations/deployment/batcher-pipe-a-cutover).
