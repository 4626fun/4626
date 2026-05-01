---
title: Eliza Runtime
sidebar_position: 7
---

# Eliza Runtime Deployment Runbook

This runbook covers deploy, rollback, and on-call triage for the long-lived Eliza XMTP runtime (`frontend/server/agent/eliza/index.ts`).

## Scope

- Service: Eliza runtime container (`frontend/Dockerfile.agent`)
- Platform: Railway primary
- Health endpoints:
  - Liveness: `/healthz` (boot is allowed)
  - Readiness: `/readyz` (must be fully ready)

Operational assumption for this repo:

- one Railway service
- one replica
- one primary XMTP consumer
- no standby or failover deployment by default

Architecture note:

- XMTP is the live Eliza transport on Railway.
- Telegram remains a separate webhook + Mini App runtime and should not be treated as a second Eliza deployment target.
- Shared cross-channel command/conversation logic lives in the agent core, but only the XMTP transport is hosted by this long-lived Railway service.
- Vercel serves the frontend and stateless API handlers only; it is not a production XMTP worker target in the default repo posture.
- `/api/agent/process` must not be scheduled on Vercel production or preview deployments.

## Critical Environment Checklist

Before shipping, verify these values are configured:

- `XMTP_DB_DIRECTORY` points to a persistent mounted path (Railway volume: `/data/.xmtp-data`)
- `XMTP_DB_ENCRYPTION_KEY` is set and stable across restarts
- Runtime role is explicit:
  - Railway deploy: `AGENT_RUNTIME_ROLE=primary` and `AGENT_CONSUME_XMTP=true`
  - Standby remains available only for local inspection
  - Railway standby or `AGENT_CONSUME_XMTP=false` is treated as startup misconfiguration and fails fast
- Primary production boots are Railway-only by default:
  - set `ELIZA_ALLOW_OFF_RAILWAY_PRIMARY=true` only for supervised off-Railway overrides
- Off-Railway Grove registration uploads are disabled by default:
  - set `ELIZA_ALLOW_OFF_RAILWAY_GROVE_UPLOAD=true` only for supervised off-Railway overrides
- DB-backed runtime lease lock:
  - `AGENT_RUNTIME_LOCK_REQUIRED=true`
  - `AGENT_RUNTIME_LOCK_KEY=xmtp-primary-runtime-lock`
  - `AGENT_RUNTIME_LOCK_HEARTBEAT_MS=10000`
  - `AGENT_RUNTIME_LOCK_STALE_MS=30000`
  - On Railway primary with Postgres configured, this is expected to be enabled and defaults on.
- Hard TEE gate for privileged signing/actions (if enabled):
  - `TEE_ENFORCEMENT_ENABLED=true`
  - `ERC8004_VALIDATION_REGISTRY` + `ERC8004_AGENT_ID` set
  - `TEE_VALIDATOR_ADDRESSES` includes trusted validators
- One runtime mode is configured:
  - Multi-agent: `DATABASE_URL` + `XMTP_AGENT_KEY_ENCRYPTION_KEY`
  - Single CSW: `XMTP_AGENT_CSW_ADDRESS` + `XMTP_AGENT_PRIVY_WALLET_ID`
  - Single EOA (dev only): `XMTP_AGENT_PRIVATE_KEY`
- At least one LLM key for conversational fallback (`GROQ_API_KEY`, `OPENAI_API_KEY`, etc)

## Deploy Procedure (Railway)

1. Confirm config and image source:
   - `railway.toml` uses `frontend/Dockerfile.agent`
   - persistent volume is mounted at `/data/.xmtp-data`
   - `healthcheckPath` is `/readyz` (strict readiness gate)
   - Railway env is `AGENT_RUNTIME_ROLE=primary`
   - Railway env is `AGENT_CONSUME_XMTP=true`
   - Runtime lock is enabled (`AGENT_RUNTIME_LOCK_REQUIRED=true`, default-on when Postgres is present)
2. Deploy (`railway up` or UI deploy).
3. Watch startup logs until runtime mode and plugin/action counts print.
4. Validate liveness and readiness:
   - `GET /healthz` should return `200`
   - `GET /readyz` should return `200` and `status: "ok"`
   - `status: "standby"` on Railway is a no-go and should be treated as misconfiguration

## Vercel Guardrail

Keep the deployment split clean:

- Vercel may serve `frontend/api/*` request/response handlers.
- Railway is the only production-primary XMTP consumer.
- Do not add a Vercel cron for `/api/agent/process`.
- If `/api/agent/process` starts firing from a Vercel deployment, treat that as config drift. The usual symptom is repeated `503` noise because XMTP-primary env such as `XMTP_AGENT_KEY_ENCRYPTION_KEY` is intentionally not present there.

## AlfaClub control path (Vercel cron is canonical)

For the full operational architecture (Vercel ↔ Supabase ↔ Railway ↔ Pinata),
see [`docs/operations/alfaclub-creative-architecture.md`](../alfaclub-creative-architecture.md).

The AlfaClub chat bridge and Privy token refresher run as **Vercel crons**:

- `POST /api/v1/alfaclub/chat-bridge-run` — bridge tick (CRON_SECRET-gated).
- `POST /api/v1/alfaclub/chat-token-refresh` — Privy refresher (CRON_SECRET-gated, every 30 min).

Railway-hosted long-lived agents (Eliza primary, Hermit AlfaClub runtime) **must not** also run the Privy refresher in-process. A second writer races the cron and overwrites the `alfaclub_runtime_secret.chat_jwt` slot under a different `updated_by`, hiding the source of truth and producing 401-loop symptoms. The in-process refresher is therefore default-OFF, gated by:

```
ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED=
```

Leave unset on Railway. Set to `1` only if you are intentionally retiring the Vercel cron path for that environment.

The chat bridge itself is independently gated by `ALFACLUB_CHAT_BRIDGE_ENABLED` (default unset) so a Railway agent can opt into in-process command polling without owning token refresh.

### Symptoms of cron / Railway double-write

- Supabase `alfaclub_runtime_secret.chat_jwt` `updated_by` column flapping between `privy-token-refresher` (Vercel cron) and `cursor-hermit-rotate` / similar (Railway-side identity).
- `chat-token-refresh` returning HTTP 502 `privy_refresh_failed:400:{"error":"Invalid auth token","code":"missing_or_invalid_token"}` shortly after a Railway redeploy.
- `chat_jwt` expiry timestamp regressing or jumping inconsistently relative to refresh-cron schedule.

### Recovery (operator playbook)

1. Confirm `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` is unset on every Railway service that boots Eliza or the Hermit AlfaClub runtime.
2. Confirm `ALFACLUB_CHAT_BRIDGE_ENABLED` is unset on every Railway service unless you have an explicit reason to run the bridge in-process.
3. Once a fresh Privy triplet is available (alfaclub.app browser session → devtools → Local Storage / Cookies):
   - Set `ALFACLUB_CHAT_JWT`, `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN`, `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN` on the Vercel deployment, **or** POST the new JWT to `/api/v1/alfaclub/chat-token` (admin-only).
   - The next `/api/v1/alfaclub/chat-token-refresh` cron tick (within 30 min) will rotate the DB-backed token and the bridge will pick it up on its next tick.
4. To verify which writer last touched the slot, query Supabase: `select updated_at, updated_by from alfaclub_runtime_secret where key = 'chat_jwt'`. Expected: `privy-token-refresher`. Anything else (e.g. `cursor-hermit-rotate`) means a long-lived host is still running the in-process refresher.

## Go / No-Go Gates

Ship only if all pass:

- `/readyz` is `200` with no blocking `readinessReasons`
- `/readyz` reports `status: "ok"`; `status: "standby"` is a deploy failure on Railway
- `dependencies.xmtp.ready` is `true`
- `dependencies.queueWorker.running` is `true` in multi-agent mode
- `dependencies.queueWorker.stats.staleProcessing` is `0`
- `runtime.role` is `primary`
- `runtime.consumeXmtp` is `true`
- If TEE gate is enabled, `teeAttestation.passed` is `true` from `/api/v1/agents/identity/verification`
- `/keepr status` succeeds end-to-end in XMTP chat for a known configured vault

## Rollback Procedure

1. Roll back to previous Railway deployment.
2. Keep the same XMTP DB volume and encryption key (do not rotate during rollback).
3. Re-check `/healthz` then `/readyz`.
4. Re-run `/keepr status` smoke test.

## Health Triage

Use `/readyz` payload first; map `readinessReasons` to action:

- `booting`: wait for startup completion and initial sync.
- `no_agents`: verify selected startup mode and agent registration rows.
- `env_validation_failed`: fix required env vars; restart deploy.
- `db_unavailable`: check database connectivity and credentials.
- `xmtp_not_running`: inspect XMTP start logs and installation persistence.
- `queue_stale_leases`: verify worker health; stale leases are auto-reclaimed, but sustained growth indicates handler failures.

## XMTP Installation Churn Recovery

Symptoms: repeated new installations, approaching 10/10 installation limit, or degraded reconnect behavior.

1. Verify DB persistence:
   - mounted volume exists and is writable
   - `.db3` files persist across restarts
2. Verify `XMTP_DB_ENCRYPTION_KEY` is unchanged.
3. Do **not** repeatedly restart while volume is broken.
4. If inbox is near installation limit, perform controlled recovery and only then temporarily enable revoke mode (`XMTP_REVOKE_OTHER_INSTALLATIONS=true`) for one supervised boot.
5. Disable revoke mode after recovery.

## Post-Deploy Smoke

- Send `"/keepr status"` in XMTP and confirm response returns.
- Trigger a plain `/ai` question and confirm non-empty response (or explicit budget/rate-limit message).
- If Telegram bot flows matter for the release, verify them separately; Telegram is not served by this Railway XMTP runtime.

## Optional Telemetry And Channels

- Telemetry:
  - Set `ELIZA_TELEMETRY_ENABLED=true` to emit structured runtime/LLM/action events.
  - Optional webhook sink: `ELIZA_TELEMETRY_WEBHOOK_URL`.
- Feature-flagged channel context plugins:
  - `ELIZA_CHANNEL_TELEGRAM_ENABLED=true`
  - `ELIZA_CHANNEL_DISCORD_ENABLED=true`
  - `ELIZA_CHANNEL_TWITTER_ENABLED=true`
  - Keep channel bot tokens server-side only.
