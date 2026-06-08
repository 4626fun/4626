---
title: Mutable Surface Inventory
sidebar_position: 5
---

# Mutable Surface Inventory

Maintainer inventory of production mutation surfaces and their required controls.

## Scope

This file tracks write-capable paths only. Read-only diagnostics are excluded unless they can trigger side effects.

## Contract upgrade and configuration surfaces

| Surface | Path | Auth model | Required guardrails | Rollback posture |
| --- | --- | --- | --- | --- |
| Batcher helper wiring and config updates | `frontend/scripts/ops/propose-batcher-solana-config-safe.ts` + safe execution | Safe owner + on-chain ownership | Verify target batcher is canonical, verify helper/deployer auth before and after write | Re-submit config tx through Safe to previous known-good values |
| Deploy-session continuation writes | `frontend/api/_handlers/deploy/v2/session/_continueCore.ts` | session access + machine auth checks | no hidden side effects in status/preflight, explicit stage transitions, invariant checks before settle | mark operation failed + re-run from explicit stage |
| Keeper mutation relay | `frontend/api/_handlers/keepr/actions/_execute.ts` | `KPR_API_KEY` + trust-zone key + zone kill switch | action-type to trust-zone match, per-zone write enable checks, explicit 503 on disabled zones | disable zone (`KPR_ZONE_DISABLE_*`) and replay only approved queued actions |
| Vault strategy mutation module | `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` | owner/keeper module permissions | strategy active checks, impairment guards, bounded idle logic, explicit eventing | owner path to remove/reinstate strategy + impairment lifecycle |

## Server mutation endpoints

| Surface | Path | Auth model | Required guardrails | Rollback posture |
| --- | --- | --- | --- | --- |
| Keepr action enqueue | `frontend/api/_handlers/keepr/actions/_enqueue.ts` | machine auth + zone auth | bounded body parse, zone mismatch rejection, zone disabled fail-closed | pause affected zone and clear/requeue actions after fix |
| Keepr action status update | `frontend/api/_handlers/keepr/actions/_updateStatus.ts` | machine auth | status transition validation, auditable writes only | mark stale rows terminal + enqueue replay |
| Keeper jobs enqueue fanout | `frontend/api/_handlers/keeper/jobs/_enqueue*.ts` | cron/machine auth | explicit zone guard for financial actions | disable enqueue flag and process backlog manually |

## Data/schema mutation surfaces

| Surface | Path | Auth model | Required guardrails | Rollback posture |
| --- | --- | --- | --- | --- |
| Runtime schema bootstrap | `frontend/server/_lib/db/schemaBootstrap.ts` | server-only DB role | no raw DDL in production code, migration-first policy, `guard:schema` must pass | apply rollback migration and rerun bootstrap verify |
| Migration execution | `supabase/migrations/*` + `pnpm -C frontend db:migrate` | operator credentials | reviewed SQL only, additive-first policy, RLS checks | down-migration or compensating forward migration |

## Verification checklist (before mutation)

1. Confirm caller auth model matches table above.
2. Confirm trust-zone or owner scope for the requested action.
3. Confirm required invariant checks are green (readiness scripts/guard scripts).
4. Confirm rollback command/path exists and is documented.

## Related

- [4626 Agent Security Model](./4626-agent-security-model.md)
- [Historical Risk Review Checklist](./historical-risk-review.md)
- [Vercel cron production fixes](../operations/vercel-cron-production-fixes.md)
