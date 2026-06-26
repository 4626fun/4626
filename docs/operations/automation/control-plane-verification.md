# Control Plane Verification Checklist

Use this checklist for implementation PRs touching control-plane lifecycle behavior.

## Golden Contract Checks

- Run focused lifecycle tests:
  - `pnpm -C frontend exec vitest run server/_lib/controlPlane/policy.test.ts`
  - `pnpm -C frontend exec vitest run server/_lib/controlPlane/operatorActions.test.ts`
  - `pnpm -C frontend exec vitest run api/__tests__/keeper-claim-execute-race.test.ts`
- Validate operation timeline writes:
  - operation rows (`control_plane_operations`)
  - stage rows (`control_plane_stages`)
  - event rows (`control_plane_events`)
  - linked queue rows (`keeper_jobs.operation_id`, `keeper_jobs.stage_id`)

## Integration Checks

- Apply latest migrations in a linked/local database.
- Execute one async verb (`provisionVaultEconomy`, `runMaintenanceCycle`, or `queueOperatorAction`) and confirm:
  - request returns `operationId`
  - operation transitions through `requested -> queued -> running -> succeeded|failed`
  - stage transition events are present
- Execute `settleVault` with invalid stage + `settledAt` and confirm validation failure without `keepr_vaults` mutation.

## Metrics and Observability

- Verify `[control-plane/metrics]` events emit for:
  - operation status transitions
  - stage status transitions
  - job completion states
- Confirm high-cardinality identifiers (`operationId`, `stageId`, `jobId`) appear in correlation fields, not label dimensions.

## Payment and Solana Lanes

- Stripe webhook path records:
  - `payment_orders` status updates
  - `payment_events` dedupe by `(provider, provider_event_id)`
- x402 activation path records:
  - `payment_orders` status updates
  - `payment_events` dedupe by `(provider, provider_event_id)`
- Solana reconcile path records:
  - `keepr_workflow_checkpoints` idempotency
  - control-plane operation + stage + event timeline

