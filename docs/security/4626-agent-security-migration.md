# 4626 Agent Security Migration Guide

This guide rolls out the secure agent control plane incrementally with backward-compatible defaults.

## What Changed

- Added control-plane schemas, policy checks, and audit emitter.
- Added Telegram trade confirmation integration with policy + control audit.
- Added keeper trust-zone routing and optional per-zone keys.
- Added outbound AI redaction middleware at all current remote-AI call boundaries.

## Backward Compatibility

- Existing `KEEPR_API_KEY` authentication still works as baseline.
- Zone keys are **optional** until configured.
- Existing `telegram_action_audit` behavior remains unchanged.
- Existing execution handlers (`executeDeterministicCommand`, bid userOp path, keeper queue logic) are reused.

## New Optional Environment Variables

### Keeper trust-zone keys

- `KEEPR_ZONE_KEY_FINANCIAL_EXECUTION`
- `KEEPR_ZONE_KEY_MARKET_MAINTENANCE`
- `KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING`

If a zone key is set, requests for that zone must include:

- header `x-keepr-zone-key: <zone-secret>`

### Redaction salt

- `AGENT_REDACTION_SALT` (optional but recommended for stable pseudonymization)

If unset, a deterministic repo fallback salt is used.

## Rollout Order

### 1) Deploy with zone keys unset

Deploy code first with only `KEEPR_API_KEY` active.

Expected behavior:

- no trust-zone auth breakage
- control audit table auto-creates on first write-capable flow
- Telegram trade confirmations continue to execute

### 2) Validate control-plane audit events

Check rows in `agent_control_audit_events` for:

- `proposal.created`
- `confirmation.accepted` / `confirmation.rejected`
- `policy.denied` (if present)
- `execution.started` / `execution.succeeded` / `execution.failed`

### 3) Update worker runtime secrets

For each worker/operator environment, set only the zone keys it should hold.

CRE queue executor automatically attaches:

- `x-keepr-trust-zone`
- `x-keepr-zone-key` (when corresponding env key exists)

### 4) Enable server-side zone key checks

Set one zone key at a time in API runtime and monitor for 401s.

Recommended order:

1. `queue_messaging_monitoring`
2. `market_maintenance`
3. `financial_execution`

### 5) Validate AI redaction outputs

Smoke-check:

- `_aiAssess` payloads are minimal and sanitized
- LLM/embedding calls still return expected outputs
- image prompt/evaluation flows still pass existing tests

## Operational Checklist

- [ ] `KEEPR_API_KEY` present in API + workers
- [ ] zone keys deployed only to intended trust-zone workers
- [ ] `AGENT_REDACTION_SALT` set in secure env
- [ ] control audit events observed in DB
- [ ] targeted tests passing in CI:
  - `policy.test.ts`
  - `redaction.test.ts`
  - keepr action auth tests
  - queue executor tests

## Rollback Plan

If zone enforcement causes disruption:

1. unset `KEEPR_ZONE_KEY_*` vars in API runtime
2. keep `KEEPR_API_KEY` unchanged
3. redeploy API

This returns keepers to baseline auth while preserving control/audit and redaction improvements.

## Notes for Maintainers

- This control plane is intentionally narrow.  
  Add new integrations by reusing:
  - `createControlCapability()`
  - `createActionProposal()`
  - `evaluatePolicy()`
  - `appendControlAuditEvent()`
- Prefer policy code changes over prompt changes for any write-path restrictions.
