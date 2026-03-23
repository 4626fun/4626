---
title: Eliza Runtime
sidebar_position: 7
---

# Eliza Runtime Deployment Runbook

This runbook covers deploy, rollback, and on-call triage for the long-lived Eliza XMTP runtime (`frontend/server/agent/eliza/index.ts`).

## Scope

- Service: Eliza runtime container (`frontend/Dockerfile.agent`)
- Platform: Railway primary (or Docker with persistent volume for explicit operator-managed overrides)
- Health endpoints:
  - Liveness: `/healthz` (boot is allowed)
  - Readiness: `/readyz` (must be fully ready)

Operational assumption for this repo:

- one Railway service
- one replica
- one primary XMTP consumer
- no standby or failover deployment by default

## Critical Environment Checklist

Before shipping, verify these values are configured:

- `XMTP_DB_DIRECTORY` points to a persistent mounted path (Railway volume: `/data/.xmtp-data`)
- `XMTP_DB_ENCRYPTION_KEY` is set and stable across restarts
- Runtime role is explicit:
  - Railway deploy: `AGENT_RUNTIME_ROLE=primary` and `AGENT_CONSUME_XMTP=true`
  - Standby remains available only for local inspection
- Primary production boots are Railway-only by default:
  - set `ELIZA_ALLOW_OFF_RAILWAY_PRIMARY=true` only for supervised off-Railway overrides
- Off-Railway Grove registration uploads are disabled by default:
  - set `ELIZA_ALLOW_OFF_RAILWAY_GROVE_UPLOAD=true` only for supervised off-Railway overrides
- Optional split-brain guard (mostly future-proofing if you ever add a second deploy target):
  - `AGENT_RUNTIME_LOCK_REQUIRED=true`
  - `AGENT_RUNTIME_LOCK_KEY=xmtp-primary-runtime-lock`
  - `AGENT_RUNTIME_LOCK_HEARTBEAT_MS=10000`
  - `AGENT_RUNTIME_LOCK_STALE_MS=30000`
- Hard TEE gate for privileged signing/actions (if enabled):
  - `TEE_ENFORCEMENT_ENABLED=true`
  - `ERC8004_VALIDATION_REGISTRY` + `ERC8004_AGENT_ID` set
  - `TEE_VALIDATOR_ADDRESSES` includes trusted validators
- One runtime mode is configured:
  - Multi-agent: `DATABASE_URL` + `XMTP_AGENT_KEY_ENCRYPTION_KEY`
  - Single CSW: `XMTP_AGENT_CSW_ADDRESS` + `XMTP_AGENT_PRIVY_WALLET_ID`
  - Single EOA (dev only): `XMTP_AGENT_PRIVATE_KEY`
- At least one LLM key for conversational fallback (`GROQ_API_KEY`, `OPENAI_API_KEY`, etc)
- `NEYNAR_API_KEY` + `NEYNAR_SIGNER_UUID` if Farcaster mention replies are required

## Deploy Procedure (Railway)

1. Confirm config and image source:
   - `railway.toml` uses `frontend/Dockerfile.agent`
   - persistent volume is mounted at `/data/.xmtp-data`
   - `healthcheckPath` is `/readyz` (strict readiness gate)
   - Railway env is `AGENT_RUNTIME_ROLE=primary`
   - Railway env is `AGENT_CONSUME_XMTP=true`
2. Deploy (`railway up` or UI deploy).
3. Watch startup logs until runtime mode and plugin/action counts print.
4. Validate liveness and readiness:
   - `GET /healthz` should return `200`
   - `GET /readyz` should return `200` and `status: "ok"`

## Go / No-Go Gates

Ship only if all pass:

- `/readyz` is `200` with no blocking `readinessReasons`
- `dependencies.xmtp.ready` is `true`
- `dependencies.queueWorker.running` is `true` in multi-agent mode
- `dependencies.queueWorker.stats.staleProcessing` is `0`
- `runtime.role` is `primary`
- `runtime.consumeXmtp` is `true`
- If TEE gate is enabled, `teeAttestation.passed` is `true` from `/api/v1/agents/identity/verification`
- `/keepr status` succeeds end-to-end in XMTP chat for a known configured vault

## Rollback Procedure

1. Roll back to previous Railway deployment (or previous Docker image tag).
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
- Confirm Farcaster mention webhook route is reachable (`/api/farcaster/mention`) when enabled.

## Optional Telemetry And Channels

- Telemetry:
  - Set `ELIZA_TELEMETRY_ENABLED=true` to emit structured runtime/LLM/action events.
  - Optional webhook sink: `ELIZA_TELEMETRY_WEBHOOK_URL`.
- Feature-flagged channel context plugins:
  - `ELIZA_CHANNEL_TELEGRAM_ENABLED=true`
  - `ELIZA_CHANNEL_DISCORD_ENABLED=true`
  - `ELIZA_CHANNEL_TWITTER_ENABLED=true`
  - Keep channel bot tokens server-side only.
