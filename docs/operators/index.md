---
title: Operators
sidebar_position: 1
slug: /operators
---

# Operators

Curated runbooks for production. The sidebar lists the essentials; more pages under `docs/operations/` are searchable on this site.

## Start here

| Topic | Link |
|-------|------|
| **Current release** | [v1.14.1 greenfield target](/operations/deployment/releases/current) |
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
  --batcher 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1
```

Historical release packets and WIP notes live in `docs/_internal/` (repo-only, not published).
