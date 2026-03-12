# Eliza Cloud Primary Failover Runbook

This runbook defines blue/green operations for running Eliza Cloud as primary and Railway as hot standby without dual XMTP consumers.

## Runtime Role Contract

- **Primary**
  - `AGENT_RUNTIME_ROLE=primary`
  - `AGENT_CONSUME_XMTP=true`
- **Standby**
  - `AGENT_RUNTIME_ROLE=standby`
  - `AGENT_CONSUME_XMTP=false`

Optional lock (recommended when sharing one Postgres):

- `AGENT_RUNTIME_LOCK_REQUIRED=true`
- `AGENT_RUNTIME_LOCK_KEY=xmtp-primary-runtime-lock`
- `AGENT_RUNTIME_LOCK_HEARTBEAT_MS=10000`
- `AGENT_RUNTIME_LOCK_STALE_MS=30000`

## Promotion Checklist

1. Confirm standby `/readyz` returns `status: "standby"`.
2. Promote standby to primary by setting:
   - `AGENT_RUNTIME_ROLE=primary`
   - `AGENT_CONSUME_XMTP=true`
3. Demote previous primary to standby by setting:
   - `AGENT_RUNTIME_ROLE=standby`
   - `AGENT_CONSUME_XMTP=false`
4. Verify only one runtime consumes XMTP.
5. Run smoke: `/keepr status` in a known vault group.

## Rollback Checklist

1. Revert role/env toggles to the previous state.
2. Confirm promoted instance reports `status: "standby"`.
3. Confirm restored primary reports `status: "ok"`.
4. Run `/keepr status` smoke again.

## Readiness Gates

- `/healthz` should remain `200` through boot.
- `/readyz` must be `200` before traffic promotion.
- Runtime payload must show:
  - `runtime.role=primary` and `runtime.consumeXmtp=true` on active runtime
  - `runtime.role=standby` and `runtime.consumeXmtp=false` on passive runtime
