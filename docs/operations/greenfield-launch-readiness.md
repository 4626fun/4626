# Greenfield launch readiness

Repeatable gate for **new vault deploys** (not grandfather migrations). Policy: [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md).

**AKITA full-stack redeploy:** use the dedicated checklist and one-command gate in [akita-full-stack-prelaunch.md](./akita-full-stack-prelaunch.md) (`pnpm -C frontend ops:verify-akita-prelaunch --production`).

## Two launch moments

| Milestone | Ready when | Solana lottery relay |
|-----------|------------|----------------------|
| **Base vault live** | Deploy session complete; Base ShareOFT buy → lottery works | Off (`relay_entries` paused) |
| **Solana lottery live** | Share-mesh Meteora pool + LP; **B2:** test pool buy confirms Base lottery via `relay_entries`. **B1:** Meteora trading only (relay not shipped) | On (**B2 only**) |

Base launch does not require Solana lottery relay.

## Platform gate (once)

Run before opening deploy to creators:

```bash
KPR_API_KEY=... curl -sS -H "Authorization: Bearer $KPR_API_KEY" \
  https://app.4626.fun/api/deploy/solanaInfraStatus | jq '.data | {readyForAutoRegistration, blockers}'
```

Expect `readyForAutoRegistration: true` and `blockers: []`.

Also verify:

| Check | Command / URL |
|-------|----------------|
| Batcher OVault runtime | `cast call $BATCHER "getOVaultRuntimeConfig()(address,uint32,bool)"` → hub + EID `30168` + `true` |
| Pipe A batcher readiness | `pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts` → exit 0 |
| Provisioner | `curl -H "Authorization: Bearer $SECRET" https://provisioner.4626.fun/healthz` → `ok: true`, payer healthy |
| Orchestrator | `curl https://orchestrator.4626.fun/healthz` → `ok: true` |
| Release target | `bash test/current-release-target-guard.sh` |
| Keeper registry auth | `curl -H "Authorization: Bearer $KPR_API_KEY" https://app.4626.fun/api/vaults/active?chainId=8453` |

### Required Vercel production env (Solana deploy lane)

| Variable | Purpose |
|----------|---------|
| `SOLANA_DYNAMIC_ROUTE_ENABLED=1` | Remote provisioner for mesh mints |
| `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL` / `_SECRET` / `_HEALTH_URL` | `provisioner.4626.fun` |
| `SOLANA_ADAPTER_OWNER_PRIVATE_KEY` | Must match `SolanaBridgeAdapter.owner()` (not `KPR_PRIVATE_KEY`) |
| `DEPLOY_SOLANA_REGISTRATION_SECRET` + `DEPLOY_SOLANA_REGISTRATION_ORIGINS` | Cross-origin session registration |
| `DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE=ovault_first` | Mesh-first deploy preflight |
| `SOLANA_OVAULT_ASSET_MINT_ORIGIN=new` | Greenfield mints (skip legacy existing-mint hint blockers) |
| `SOLANA_BRIDGE_ADAPTER` + `SOLANA_DESTINATION` | Batcher-aligned adapter + keeper pubkey |
| `METEORA_IX_PROVISIONER_URL` / `_SECRET` | Optional Meteora ix generation |

Redeploy production after env changes (`vercel deploy --prod --archive=tgz`).

### Keeper env (pre-launch defaults)

**Vercel:**

```bash
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay
KEEPER_SOLANA_RECONCILE_WORKFLOW=solana-orchestrator
SOLANA_ORCHESTRATOR_URL=https://orchestrator.4626.fun
```

**Vultr** (`/etc/4626/solana-keeper-orchestrator.env`):

```bash
SOLANA_ORCHESTRATOR_EXECUTE=1
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
```

## Per-creator prep (before Deploy)

1. Creator coin on Zora; payout recipient correct  
2. **50M+** creator tokens for vault deposit  
3. Wallet **execution-ready** (parent CSW + embedded owner, or EOA track)  
4. Paid features at `/creator/strategy/features`:
   - At least one Phase 3 strategy (`charm_active_lp` or `ajna_sleeve`)
   - `solana_ovault_mesh` if Solana mesh is wanted  
5. Optional: fork dry-run — `pnpm -C frontend run dev:deploy-dry-run`

Pipe A (30% ShareOFT auto-bridge at finalize) additionally requires a **Pipe-A-ready batcher** — see [batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```

Expect `readyForPipeAFinalizeBridge: true`. The deprecated `solana_bridge_strategy` Phase-3 TVL lane is removed; Solana share seeding happens in Phase 2 finalize instead.

## Deploy session checklist

- Phases 1–3 complete (+ Phase 4 if deferred launch)  
- If Solana enabled: session reaches `ovault_mesh_confirmed`  
- Base smoke: deposit, withdraw, ShareOFT **buy** → lottery entry  

## Solana lottery flip (Phase B — **B2 only today**)

After share-mesh Meteora pool + LP, and (**B2**) hook PDAs + one verified pool buy → Base lottery:

```bash
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
# SOLANA_CREATOR_MINTS + SOLANA_SHARE_OFT_MAPPING → hook / share mint (not creator SPL 9JWh…)
```

**B1 (Meteora trading without Solana lottery relay):** stop after pool + LP; keep `relay_entries` off; Base Uniswap lottery remains live.

Redeploy Vercel; restart orchestrator on Vultr.

## Ops helpers

```bash
# Safe batcher config proposals (dry-run, then --propose)
pnpm -C frontend exec tsx scripts/ops/propose-batcher-solana-config-safe.ts

# Read-only Pipe A readiness gate
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts

# Execute queued Safe txs (1-of-N threshold met)
pnpm -C frontend exec tsx scripts/ops/execute-pending-safe-txs.ts <safeTxHash>...
```

Cutover runbook: [deployment/batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md).
