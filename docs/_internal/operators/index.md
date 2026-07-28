# Operators

Curated runbooks for production — **~69 pages** on [docs.4626.fun](https://docs.4626.fun), listed in the sidebar.

## Start here

| Topic | Link |
|-------|------|
| **Current release** | [v1.20.0 greenfield target](/operations/deployment/releases/current) |
| **Live addresses** | [Contract addresses](/reference/addresses) |
| **Greenfield gate** | [Launch readiness](/operations/vault/greenfield-launch-readiness) |
| **Deploy runbooks** | [Deployment hub](/operations/deployment) |
| **Keepers** | [Keeper HTTP API](/operations/automation/keeper-http-api) |
| **Wallet incidents** | [CSW recovery](/operations/wallet/csw-recovery-playbook) |
| **Solana policy** | [Share mesh + lottery](/operations/solana/solana-share-mesh-lottery-policy) |
| **Platform** | [Supabase setup](/operations/platform/supabase-setup) |

## Preflight (copy/paste)

```bash
./test/current-release-target-guard.sh
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032
```

AlfaClub, analytics, AKITA prelaunch, incidents, and historical archive notes live in `docs/_internal/operations/` (repo-only).
