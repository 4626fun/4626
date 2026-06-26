# AlfaClub Auth Hardening — Operator Runbook

## Checklist

1. Confirm **single writer**: only Vercel cron `privy-token-refresher` or admin `POST /api/v1/alfaclub/chat-token` updates `alfaclub_runtime_secret`.
2. Probe health: `GET /api/v1/alfaclub/chat-auth-health` with `CRON_SECRET` (or GitHub monitor workflow).
3. On failure → [Token rotation](./token-rotation.md) (DB + env, fresh triplet).
4. If `cf-mitigated=challenge` → Cloudflare proxy env, not token rotation alone.
5. Railway Hermit: keep `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED=0` (cron is canonical writer).

This runbook covers the AlfaClub Privy/JWT bridge after the hardening
work in this PR. Read it together with:

- [`docs/operations/alfaclub-creative-architecture.md`](./alfaclub-creative-architecture.md) —
  the canonical creative-vs-auth boundary (PR #463).
- [`token-rotation.md`](./token-rotation.md) —
  mint browser triplet → DB + Vercel env → cron smoke (P0 recovery).
- [`docs/operations/deployment/eliza-runtime.md`](./deployment/eliza-runtime.md) —
  PR #458's gate on the in-process refresher (`ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED`).

## Single-writer invariant

The `alfaclub_runtime_secret` rows that hold AlfaClub auth state
(`chat_jwt`, `chat_privy_access_token`, `chat_privy_refresh_token`)
are written by **exactly one** logical writer at a time. Any second
writer races the canonical Vercel cron and silently overwrites the
slot, which is what triggered the `privy_refresh_failed:400 Invalid auth token`
flap historically (a Railway-side `cursor-hermit-rotate` writer
clobbered access/refresh tokens with values the Vercel cron had not
seen).

Expected writers — anything else is an anomaly:

| Writer name | Source | When |
| --- | --- | --- |
| `privy-token-refresher` | `runAlfaClubPrivyRefreshOnce` (Vercel cron `/api/v1/alfaclub/chat-token-refresh`) | Every ~30 min on a healthy bridge — canonical. |
| `<admin wallet, lowercase 0x…>` | Admin POST to `/api/v1/alfaclub/chat-token` | Operator-driven bootstrap or restore. |
| `admin.api` | Reserved name for documented admin paths that don't carry an admin wallet. | Future use. |
| `computer-token-restore` | Reserved name for the local restore script when the admin endpoint accepts a writer override. | Reserved; not currently emitted. |

**Anomalous** writer values:

- `cursor-hermit-rotate` — fingerprint of the legacy long-lived
  in-process refresher that PR #458 disabled by default. Surfacing it
  by name so a regression is recognized on sight.
- Any other freeform string — flagged as `unknown_writer`.
- Empty / whitespace / null — flagged as `empty_writer`.

The single source of truth for this list is
[`evaluateWriterAnomaly`](../../frontend/server/_lib/alfaclub/authHealthStore.ts).
Address-shaped writers (`0x[a-f0-9]{40}` after lowercasing) are
accepted as expected — they correspond to admin wallet stamps from
the chat-token bootstrap endpoint.

## How to keep Railway / Pinata from touching auth

- **Railway**: leave `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` unset (or
  remove it). The in-process loop returns a stub handle and logs
  `[alfaclub-refresher] in-process loop disabled (Vercel cron is canonical)`.
  Leave `ALFACLUB_CHAT_BRIDGE_ENABLED` unset unless you specifically
  want bridge collection to run from Railway.
- **Pinata / Hermit**: `frontend/server/_lib/hermit/architectureBoundary.test.ts`
  greps the creative-lane source files for forbidden symbols
  (`chatTokenStore`, `upsertAlfaClub*`, `runAlfaClubPrivyRefreshOnce`,
  …). The test fails CI if Hermit ever imports an auth module.
  See PR #463.

## Health endpoint

`GET /api/v1/alfaclub/chat-auth-health` (cron-secret-gated, same auth
as `chat-token-refresh`) returns a redacted snapshot of the auth
control plane's recent health.

Example body:

```json
{
  "success": true,
  "data": {
    "lastSuccess": {
      "at": "2026-05-01T11:55:00.000Z",
      "identityTokenExp": "2026-05-01T13:00:00.000Z",
      "writer": "privy-token-refresher",
      "rotatedRefresh": false,
      "writerAnomaly": { "isAnomalous": false, "reason": null, "writer": "privy-token-refresher" }
    },
    "lastFailure": null,
    "liveChatJwt": {
      "writer": "privy-token-refresher",
      "writerAnomaly": { "isAnomalous": false, "reason": null, "writer": "privy-token-refresher" },
      "expiresAt": "2026-05-01T13:00:00.000Z",
      "minutesUntilExpiry": 60,
      "updatedAt": "2026-05-01T11:55:00.000Z"
    }
  }
}
```

### Recommended monitoring thresholds

Wire these into whatever paging system you use (Datadog, Grafana,
cron-monitor, …). All probes are GETs to the health endpoint with the
shared `CRON_SECRET`.

| Condition | Action |
| --- | --- |
| `liveChatJwt.minutesUntilExpiry < 20` | Page — refresh probably stalled. |
| `liveChatJwt.minutesUntilExpiry < 5` | Wake oncall. |
| `lastSuccess.minutesUntilAccessExpiry < 20` | Page — Privy access-token cliff (added after incident 2026-05-01; the bearer the refresher sends to Privy has its own ~1h TTL that ages independently when Privy returns `privy_access_token: null`). |
| `liveChatJwt.writerAnomaly.isAnomalous === true` | Page — a non-canonical writer overwrote the slot. |
| `lastFailure.at > lastSuccess.at` (newer failure than success) | Page. |
| `lastFailure.errorCode` starts with `"privy_refresh_failed:400"` AND `liveChatJwt.minutesUntilExpiry < 30` | Wake oncall — refresh tokens may be revoked, fresh triplet needed. Matches subcoded variants too (`:missing_or_invalid_token` ⇒ bearer rejected; `:invalid_refresh_token` ⇒ refresh-token revoked). |
| `lastFailure.errorCode === "token_persistence_failed"` | Investigate RLS / role grants on `alfaclub_runtime_secret`. |

The endpoint never returns the raw `chat_jwt`; only the
`expires_at` / `updated_by` metadata is included. The
`writerAnomaly.writer` field is lowercased and may be a 0x-prefixed
admin wallet — that is by design (admin endpoint stamps it).

### Why the access-token cliff is its own row

The refresher hits Privy's `POST /api/v1/sessions` with two credentials:

- `Authorization: Bearer ${accessToken}` — the **access token** from
  `chat_privy_access_token`.
- body `{ refresh_token: ${refreshToken} }` — the refresh token from
  `chat_privy_refresh_token`.

Privy returns `privy_access_token: null` ("we kept the existing
credential alive") on a non-trivial fraction of calls. When that
happens, the refresher reuses the inbound access token verbatim and
only rotates identity. The **access token's own ~1h TTL keeps
ticking**: after a few cycles the bearer ages out even though
identity has been rotated every cycle. The next call to Privy then
fails with HTTP 400 and `code: missing_or_invalid_token` (the bearer
is the credential being rejected, not the refresh token).

The refresher's "is a refresh due?" gate now uses
`MIN(identityTokenExp, accessTokenExp)` so an aging access token
triggers a refresh before it crosses its own cliff. The
`lastSuccess.accessTokenExp` row captures the exp on every successful
pass, and the snapshot's `lastSuccess.minutesUntilAccessExpiry` is
the alert signal monitors should page on.

### Health row internals

The endpoint reads from two `alfaclub_runtime_secret` rows that
the refresher writes after each pass:

| Row | Meaning | Written by |
| --- | --- | --- |
| `chat_auth_health:last_success` | `{ at, identityTokenExp, accessTokenExp, writer, rotatedRefresh }` JSON. `accessTokenExp` is the Privy access token's exp (when it can be decoded); the snapshot endpoint also derives `minutesUntilAccessExpiry` so monitors can alert on the access-token cliff before it bites. | `privy-token-refresher` after a successful refresh. |
| `chat_auth_health:last_failure` | `{ at, status, errorCode, detail }` JSON. `errorCode` is one of `privy_refresh_failed:<status>[:<subcode>]`, `token_persistence_failed`, `refresher_disabled`, or `unknown`. When Privy's response body carries a recognised `code` (`missing_or_invalid_token`, `invalid_refresh_token`, `invalid_credentials`), it is appended as the third segment so monitors can distinguish bearer-rejection from refresh-token-revocation. `detail` is short and redacted (no token material). | `privy-token-refresher` on `error` or `missing_tokens` outcomes. |

The rows live in the same table as the tokens (RLS deny-all already
enforced), so no schema migration was required for this PR. A future
patch can split health out into a dedicated `alfaclub_auth_health`
table without changing the read API; consumers should rely on the
`/chat-auth-health` endpoint, not the row keys.

## External GitHub Actions monitor

The repo ships an external probe that runs on GitHub Actions every 5
minutes and on `workflow_dispatch`. A failed workflow run is the
alerting signal — GitHub emails the repo's notification list and
surfaces the failure in the Actions tab.

| File | Purpose |
| --- | --- |
| [`.github/workflows/alfaclub-auth-health-monitor.yml`](../../.github/workflows/alfaclub-auth-health-monitor.yml) | Cron + manual dispatch wrapper. Runs the script with the secret. |
| [`frontend/scripts/alfaclub-auth-health-monitor.mjs`](../../frontend/scripts/alfaclub-auth-health-monitor.mjs) | The probe itself. Node 20, no deps. Same script runs in CI and locally. |
| [`frontend/server/_lib/alfaclub/authHealthMonitor.test.ts`](../../frontend/server/_lib/alfaclub/authHealthMonitor.test.ts) | 44 tests covering the alert matrix (including the wake-oncall `refresh_failed_low_expiry` condition), redaction guarantees, fetch timeout coverage of the body read, and exit-code contract. |

### Setting the GitHub secret

The monitor needs the cron secret to call the endpoint. Set it once
per repo:

```sh
# Anywhere with `gh` and repo write access. The value is read from
# stdin so it never appears in shell history or process listings.
gh secret set ALFACLUB_HEALTH_CRON_SECRET --repo wenakita/4626 < /path/to/cron-secret-file
```

Or via the web UI: **Repo → Settings → Secrets and variables → Actions
→ New repository secret**, name `ALFACLUB_HEALTH_CRON_SECRET`, value
the same `CRON_SECRET` configured on Vercel for
`/api/v1/alfaclub/chat-auth-health`.

**If the workflow fails with `http_status_401`:** the GitHub secret no longer
matches Vercel Production `CRON_SECRET`. Re-sync using the command above,
then `gh workflow run "AlfaClub auth-health monitor"`. `vercel env pull` often
does not include `CRON_SECRET` — copy from the Vercel dashboard instead.

## Quick `/gmeow` smoke check

After Railway/Vercel deploys, run a room-level smoke check from the
repo root to verify end-to-end command ingest and reply:

```sh
pnpm -C frontend exec tsx --env-file=.env scripts/alfaclub-chat-smoke.ts \
  --jwt "<fresh alfaclub privy jwt>" \
  --admin-address 0x<admin_wallet> \
  --origin https://4626.fun \
  --room 1043 \
  --command "/gmeow" \
  --expect-text "cat laugh"
```

Notes:

- Use `--skip-rotate` if you only want to test with the currently active token.
- `--expect-text` is optional; keep it for deterministic post-deploy checks.
- Success means the script prints `✅ reply detected` and shows the new
  non-command message rows.

To override the URL (e.g. point the probe at a staging deploy), set a
**repository variable** (not a secret) named `ALFACLUB_HEALTH_URL`.
Default is `https://app.4626.fun/api/v1/alfaclub/chat-auth-health`.

### Alerting model

A failed workflow run (exit code ≠ 0) triggers GitHub's standard
notification path:

1. Email to repo collaborators (configurable per user under **Settings
   → Notifications → Actions**).
2. A red badge in the **Actions** tab and on every PR's status check
   panel.
3. Web / mobile app push if the user has subscribed to the workflow.

GitHub Actions itself only sends email and on-GitHub notifications
for failed runs — it does not natively forward to PagerDuty or Slack.
To page an external incident channel, wire one of your existing
integrations to the workflow separately (for example, PagerDuty's
GitHub Actions integration, a repository webhook on the `workflow_run`
event, or a follow-up step in the workflow that calls your incident
API on failure). The script's stderr line is structured for grep so
those downstream consumers can route on `<reason>`:

```
alfaclub-auth-health: FAIL <reason> minutesUntilExpiry=<n> minutesUntilAccessExpiry=<n> writer=<…> anomaly=<…> lastSuccess.at=<…> lastFailure.at=<…>
```

`<reason>` is one of: `http_status_<code>`, `response_not_success`,
`missing_data`, `missing_live_chat_jwt`, `expiring_soon`,
`access_token_expiring_soon`, `refresh_failed_low_expiry`,
`writer_anomaly`, `missing_last_success`, `failure_after_success`,
`fetch_error`. The thresholds match the
[Recommended monitoring thresholds](#recommended-monitoring-thresholds)
table above; `expiring_soon` and `access_token_expiring_soon`
default to 20 minutes (override via `ALFACLUB_HEALTH_MIN_EXPIRY_MINUTES`)
and the wake-oncall `refresh_failed_low_expiry` defaults to 30
minutes (override via `ALFACLUB_HEALTH_REFRESH_FAILED_LOW_EXPIRY_MINUTES`).

### Running the monitor locally

The same script runs on an operator's machine without GitHub Actions:

```sh
ALFACLUB_HEALTH_CRON_SECRET=…  \
  node frontend/scripts/alfaclub-auth-health-monitor.mjs
```

Optional env:

| Var | Default | Purpose |
| --- | --- | --- |
| `ALFACLUB_HEALTH_URL` | `https://app.4626.fun/api/v1/alfaclub/chat-auth-health` | Endpoint override (staging, alt domain). |
| `ALFACLUB_HEALTH_MIN_EXPIRY_MINUTES` | `20` | Threshold for the `expiring_soon` reason. |
| `ALFACLUB_HEALTH_REFRESH_FAILED_LOW_EXPIRY_MINUTES` | `30` | Threshold for the wake-oncall `refresh_failed_low_expiry` reason (Privy 400 + narrow expiry window). |
| `ALFACLUB_HEALTH_FETCH_TIMEOUT_MS` | `15000` | Max time to wait on the GET (covers headers + body). |

Exit codes: `0` healthy, `1` alert (one of the FAIL reasons listed
above), `2` misconfig (missing secret, bad URL).

### What the monitor will not print

The script enforces a redaction layer in addition to the endpoint's
own contract (the endpoint never returns the raw JWT). On stdout /
stderr the monitor emits **only** the documented summary fields:
`status` (via the FAIL/OK header), `minutesUntilExpiry`, `writer`,
`anomaly`, `lastSuccess.at`, `lastFailure.at`. Anything else from the
response body is dropped. As defense-in-depth, JWT-shaped substrings,
`Bearer …` headers, and long opaque base64url runs are stripped from
any error string before it reaches the logs. The
`ALFACLUB_HEALTH_CRON_SECRET` value is never logged.

## Recovery playbook — bridge is 401-ing

1. **Probe**. From any operator machine with `CRON_SECRET`:

   ```sh
   curl -sS -H "x-cron-secret: $CRON_SECRET" \
        https://<host>/api/v1/alfaclub/chat-auth-health | jq
   ```

   Look at:
   - `liveChatJwt.minutesUntilExpiry` — negative or near-zero means the
     stored identity token is expired.
   - `liveChatJwt.writer` and `writerAnomaly` — anomalies are the
     #1 historical cause of double-write outages.
   - `lastFailure.errorCode` — distinguishes Privy rejection (`privy_refresh_failed:400`)
     from persistence (`token_persistence_failed`) from misconfiguration
     (`refresher_disabled` / no recent success).

2. **If `lastFailure.errorCode = privy_refresh_failed:400`** (Privy
   rejected the existing access/refresh tokens), a fresh triplet is
   required. Use the restore script:

   ```sh
   # 1. Capture a fresh triplet from alfaclub.app devtools.
   #    Save as triplet.json with these keys:
   #    {
   #      "identity_token": "<privy_id_token>",
   #      "privy_access_token": "<privy_access_token>",
   #      "refresh_token": "<privy_refresh_token>"
   #    }

   # 2. DRY-RUN — verify shape and expiry without touching prod.
   node frontend/scripts/alfaclub-restore-tokens.mjs ./triplet.json

   # 3. APPLY — POSTs to the admin endpoint and (optionally) kicks
   #    chat-token-refresh + chat-bridge-run so you don't wait on cron.
   ALFACLUB_ADMIN_ENDPOINT=https://<host>/api/v1/alfaclub/chat-token \
   ALFACLUB_ADMIN_BEARER=<admin bearer> \
   CRON_SECRET=<cron secret> \
   ALFACLUB_HEALTH_ENDPOINT=https://<host>/api/v1/alfaclub/chat-auth-health \
     node frontend/scripts/alfaclub-restore-tokens.mjs ./triplet.json \
       --apply --call-cron-refresh --call-bridge-run
   ```

   The script never echoes raw token material — output describes
   tokens by length and decoded `exp` only, and any echoed response
   body goes through the same redactor as the server-side health log.

3. **If `liveChatJwt.writer` is anomalous** (e.g. `cursor-hermit-rotate`):
   identify the rogue writer first, stop it, then re-bootstrap.
   - Confirm `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` is unset on every
     Railway service that imports `startAlfaClubPrivyTokenRefresher`.
     Redeploy if it was set.
   - Confirm no out-of-tree script or scheduled task is calling the
     admin endpoint on its own cadence.
   - Once the second writer is gone, the canonical cron will overwrite
     the slot on its next tick (≤30 min).

4. **If `lastFailure.errorCode = token_persistence_failed`**: the
   refresh against Privy succeeded but the DB write was rejected,
   typically by an RLS policy. The error detail (already redacted)
   includes the pg error code where possible. Investigate the runtime
   role's grants on `alfaclub_runtime_secret`. The refresher
   intentionally skips no-op writes for the access/refresh token rows
   (PR #458 area), so a persistence failure on those rows surfaces as
   a `warn` log line, not a fatal error; only the identity-token write
   is treated as fatal.

## Direct DB inspection

If the health endpoint is itself down, the same data is in
`alfaclub_runtime_secret`. The values for the `chat_auth_health:*`
keys are JSON, not tokens.

```sql
-- Live token row writers + expiries.
SELECT secret_key,
       updated_by,
       updated_at,
       expires_at,
       expires_at - now() AS time_until_expiry
FROM alfaclub_runtime_secret
WHERE secret_key IN (
  'chat_jwt',
  'chat_privy_access_token',
  'chat_privy_refresh_token'
)
ORDER BY secret_key;

-- Health rows. secret_value is JSON; safe to inspect.
SELECT secret_key, secret_value, updated_at
FROM alfaclub_runtime_secret
WHERE secret_key LIKE 'chat_auth_health:%';

-- Anomaly probe: any non-canonical writer in the auth slots?
-- The app classifier (`evaluateWriterAnomaly`) lowercases `updated_by`
-- before matching, so this query lower()s the column to mirror that
-- behaviour. A mixed-case admin wallet stamp like `0xAB…` would
-- otherwise be flagged here even though the app accepts it.
SELECT secret_key, updated_by, updated_at
FROM alfaclub_runtime_secret
WHERE secret_key IN (
  'chat_jwt',
  'chat_privy_access_token',
  'chat_privy_refresh_token'
)
  AND lower(updated_by) NOT IN (
    'privy-token-refresher',
    'admin.api',
    'computer-token-restore'
  )
  -- Address-shaped admin writers are expected. Match against the
  -- lower()'d column so mixed-case wallet stamps are not flagged.
  AND lower(updated_by) !~ '^0x[0-9a-f]{40}$';
```

## What is intentionally out of scope

- **No new table.** Health rows live in the existing
  `alfaclub_runtime_secret` table under the `chat_auth_health:*` key
  prefix, which is RLS deny-all already. This avoids a real schema
  migration for the operator. If health storage needs to scale
  independently of token storage, a follow-up can introduce a
  dedicated `alfaclub_auth_health` table without changing the
  endpoint contract.
- **No DB migration shipped in this PR.** The operator does not need
  to apply anything before merging; the `chat_auth_health:*` rows are
  upserted by the refresher on its first write under
  `ON CONFLICT (secret_key) DO UPDATE`.
- **No external scheduled monitor.** This PR adds the health endpoint
  and the redacted response shape; wiring up Datadog / Grafana / a
  cron-monitor is left for the operator. The thresholds above are the
  recommended starting point.
- **No production secrets are touched.** All restore actions go
  through the existing admin endpoint with the operator's existing
  bearer.
