---
title: Creator Workspace
sidebar_position: 1
---

# Creator Workspace

The Creator Workspace extends the canonical vault page (`/vault/:address`) with an operator dashboard while preserving existing deposit/withdraw UX.

## Route and UI

- Canonical route: `/vault/:address`
- Workspace deep links:
  - `/vault/:address?panel=workspace`
  - `/vault/:address?panel=workspace&tab=strategies`
  - `/vault/:address?panel=workspace&tab=tasks&task=123`

## Role Matrix

Workspace roles are resolved from vault config + server admin override:

- `OWNER`
- `ADMIN`
- `OPERATOR`
- `VIEWER`

Permission policy:

- `read`: all roles
- `strategy_manage`, `tasks_manage`, `action_execute_low_risk`: owner/admin/operator
- `settings_manage`, `rooms_manage`, `action_execute_high_risk`: owner/admin

Write actions enforce canonical identity resolution (except explicit server-admin override).

## Workspace APIs

All APIs are under `/api/v1/workspace/*`:

- `GET /summary?vault=0x...`
- `GET /strategies?vault=0x...`
- `GET /monitoring?vault=0x...`
- `GET /activity?vault=0x...&includeSystem=true&limit=150`
- `GET /rooms?vault=0x...`
- `GET /tasks?vault=0x...&taskStatus=pending&approvalStatus=pending`
- `GET /settings?vault=0x...`
- `POST /actions?vault=0x...`

### Action endpoint

`POST /api/v1/workspace/actions?vault=0x...` accepts:

```json
{
  "action": "strategy.execute",
  "payload": {
    "strategyAddress": "0x...",
    "actionType": "strategy.charm.rebalance",
    "params": {}
  }
}
```

Supported action families:

- `strategy.setTarget`
- `strategy.execute`
- `task.approve|reject|snooze|assign`
- `approval.approve|reject`
- `settings.notifications.upsert`
- `rooms.telegram.link|unlink`
- `rooms.xmtp.publish`

## Persistence Model

Workspace tables are bootstrapped by `ensureWorkspaceSchema()`:

- `workspace_strategy_targets`
- `workspace_monitoring_snapshots`
- `workspace_alert_events`
- `workspace_approvals`
- `workspace_task_state`
- `workspace_activity_events`
- `workspace_notification_preferences`
- `workspace_audit_logs`

## Event Normalization Map

Normalizer hooks:

- CRE ingest (`runtime record`) -> `workspace_activity_events` (+ alert/task for warn/critical)
- CRE decisions -> `workspace_activity_events` + task (+ approval when required)
- Keepr action status updates -> `workspace_activity_events` (+ alert/task on failed/retry)

Entry points:

- `frontend/api/_handlers/cre/runtime/_ingest.ts`
- `frontend/api/_handlers/cre/runtime/_decisions.ts`
- `frontend/api/_handlers/keepr/actions/_updateStatus.ts`

## Notification Adapters

- Telegram summaries: `frontend/server/_lib/workspace/telegramTransport.ts`
- XMTP structured publishes: `frontend/server/_lib/workspace/xmtpPublisher.ts`

The workspace action flow can emit Telegram and XMTP summaries without coupling UI actions to transport internals.
