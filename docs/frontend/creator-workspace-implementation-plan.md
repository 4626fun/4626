---
title: Creator Workspace Implementation Plan
sidebar_position: 2
---

# Creator Workspace / Vault Dashboard Implementation Plan

## Scope

Implement a production-ready creator workspace directly on the existing vault route (`/vault/:address`) without breaking deposit/withdraw behavior. Reuse existing Keepr, CRE, Telegram, and XMTP infrastructure and add a typed workspace API + read model.

## Delivery Phases

1. **Schema + Auth Foundation**
   - Add workspace schema bootstrap in `frontend/server/_lib/workspace/schema.ts`
   - Add role-aware auth gate in `frontend/server/_lib/workspace/auth.ts`
   - Add repository/service layers in:
     - `frontend/server/_lib/workspace/repository.ts`
     - `frontend/server/_lib/workspace/service.ts`

2. **Typed Workspace APIs**
   - Add `/api/v1/workspace/*` handlers:
     - `summary`, `strategies`, `monitoring`, `activity`, `rooms`, `tasks`, `settings`, `actions`
   - Register routes in `frontend/api/_handlers/_routes.v1.ts`

3. **Event Normalization + Notifications**
   - Add normalizer in `frontend/server/_lib/workspace/normalizer.ts`
   - Wire normalizer into:
     - `frontend/api/_handlers/cre/runtime/_ingest.ts`
     - `frontend/api/_handlers/cre/runtime/_decisions.ts`
     - `frontend/api/_handlers/keepr/actions/_updateStatus.ts`
   - Add adapters:
     - `frontend/server/_lib/workspace/telegramTransport.ts`
     - `frontend/server/_lib/workspace/xmtpPublisher.ts`

4. **Vault UI Extension**
   - Extend `frontend/src/pages/Vault.tsx` with non-breaking workspace panel toggle
   - Add deep-link query support: `?panel=workspace&tab=<tab>&task=<id>`
   - Add typed workspace client/hook:
     - `frontend/src/lib/workspace/types.ts`
     - `frontend/src/lib/workspace/api.ts`
     - `frontend/src/hooks/useCreatorWorkspace.ts`
   - Add workspace UI modules under `frontend/src/components/workspace/`

5. **Action Safety + Auditability**
   - Queue low-risk strategy actions immediately (rebalance/rebucket)
   - Route high-risk strategy actions through approval/task workflow
   - Persist workspace audit logs for sensitive mutations

6. **Verification + Docs**
   - Add API/UI tests
   - Run lint/typecheck/tests
   - Document API contracts and role matrix in `docs/frontend/creator-workspace.md`
