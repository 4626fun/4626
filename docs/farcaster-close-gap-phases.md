# Farcaster Close-the-Gap Rollout

This document tracks implementation of the protocol-first Farcaster rollout.

## Phase 0 — Provider abstraction + mode flags
- ✅ Added `frontend/server/_lib/farcasterProvider.ts`.
- ✅ Added mode selection via `FARCASTER_PROVIDER_MODE=neynar|protocol|hybrid`.

## Phase 1 — Replace direct Neynar callsites in critical identity reads
- ✅ `frontend/api/_handlers/social/_farcaster.ts` now resolves via provider abstraction.
- ✅ `frontend/server/_lib/waitlistPreprovision.ts` now resolves Farcaster via provider abstraction.

## Phase 2 — Observability and controlled fallback
- ✅ `/api/social/farcaster` now returns provider `source` and `mode` plus response headers:
  - `X-Farcaster-Provider-Mode`
  - `X-Farcaster-Provider-Source`
- ✅ Provider logs when hybrid mode falls back to Neynar.

## Phase 3 — Strictness controls for frame validation
- ✅ Added `FRAMES_VALIDATION_MODE=best-effort|strict` in `frontend/api/_handlers/frames/_action.ts`.
- ✅ In strict mode, unverified actions are rejected with HTTP 401.
- ✅ Added response headers:
  - `X-Frames-Validation-Mode`
  - `X-Frames-Validation-Source`

## Phase 4 — Miniapp auth hardening
- ✅ Existing Quick Auth / SIWF flow remains primary for in-miniapp user auth.
- ✅ This rollout keeps auth rails unchanged while reducing social-profile dependency lock-in.

## Phase 5 — Reputation/communication provenance
- ✅ Source provenance is surfaced in social profile responses (`source`, `mode`).
- ✅ Provenance is now threaded into `/api/v1/agents/wallet-intelligence` and `/api/lens/reputation-graph` responses.

## Environment variables
- `FARCASTER_PROVIDER_MODE=hybrid` (default)
- `FRAMES_VALIDATION_MODE=best-effort` (default)

Recommended production migration path:
1. `FARCASTER_PROVIDER_MODE=hybrid`
2. monitor `source` distribution
3. move to `protocol` where acceptable
4. enable `FRAMES_VALIDATION_MODE=strict` on sensitive routes


## Operational dashboard + cutover policy
- New dashboard endpoint: `GET /api/admin/farcaster/provider-dashboard?hours=168`
- Data source: `farcaster_rollout_events` telemetry table (`provider_resolution`, `frame_validation`, `agent_publish`).

Recommended cutover policy for selected read endpoints:
1. Stay on `hybrid` until sample size is at least 200 profile resolutions in the window.
2. Move endpoint to `protocol` when protocol source share is >= 95% for 7 consecutive days and error-rate is stable.
3. Roll back to `hybrid` automatically if protocol share drops below 90% or if endpoint error budget is exceeded.

Staging defaults:
- `FRAMES_VALIDATION_MODE` now defaults to `strict` when `APP_ENV`/`VERCEL_ENV` is `staging|preview` unless explicitly overridden.
