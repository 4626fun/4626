# AlfaClub Privy token rotation — operator runbook

**When to use:** `/gmeow` or other Hermit commands stop replying; GitHub
`alfaclub-auth-health-monitor` fails with `expiring_soon`,
`refresh_failed_low_expiry`, or `missing_last_success`; Vercel logs show
`room_history_failed:401` or `privy_refresh_failed`.

**Related docs:**

- [`alfaclub-auth-hardening.md`](./alfaclub-auth-hardening.md) — single-writer
  invariant, health endpoint, GitHub monitor.
- [`alfaclub-gmeow-outage-postmortem-2026-05-02.md`](./alfaclub-gmeow-outage-postmortem-2026-05-02.md) —
  Cloudflare proxy + token cliff context.
- [`alfaclub-creative-architecture.md`](./alfaclub-creative-architecture.md) —
  what must **not** touch auth (Pinata/Railway).

## Precedence: DB before env

The Vercel cron refresher (`privy-token-refresher`) reads **`alfaclub_runtime_secret`
in Supabase first**, then falls back to inline env vars
(`ALFACLUB_CHAT_JWT`, `ALFACLUB_PRIVY_ACCESS_TOKEN`,
`ALFACLUB_PRIVY_REFRESH_TOKEN`).

| Symptom | Likely cause |
| --- | --- |
| You updated Vercel env but refresh still fails | Stale DB row still wins |
| Health shows good env but bridge 401s | DB `chat_jwt` expired |
| Restore “worked” then broke again | Pasted an already-rotated refresh token |

**Recovery always updates both:**

1. Supabase `alfaclub_runtime_secret` (via admin `POST /api/v1/alfaclub/chat-token`
   or restore script `--apply`).
2. Vercel Production env for the three bootstrap vars (optional but recommended
   so cold starts and tooling agree).

Do **not** rely on `vercel env pull` for `CRON_SECRET` — it is often omitted
from pulled files. Copy `CRON_SECRET` from the Vercel dashboard (or your
secrets manager) when running local smoke scripts.

## Field mapping (browser → env → API body)

Export a JSON object from a real **alfaclub.app** session (logged-in bot or
operator account). Accepts either Privy `/sessions` shape or a flat object:

| Browser / export key | Vercel env (bootstrap) | `POST /api/v1/alfaclub/chat-token` body |
| --- | --- | --- |
| `identity_token` or `token` | `ALFACLUB_CHAT_JWT` | `jwt` |
| `privy_access_token` or `access_token` | `ALFACLUB_PRIVY_ACCESS_TOKEN` | `privyAccessToken` |
| `refresh_token` | `ALFACLUB_PRIVY_REFRESH_TOKEN` | `privyRefreshToken` |

All three must be **future-dated** (identity + access are JWTs with valid
`exp`). The restore script validates this before any network call.

## Recommended rotation flow

### 1. Mint a fresh triplet in the browser

1. Open https://alfaclub.app in a normal browser (not Telegram WebView).
2. Sign in as the bot/bridge account.
3. Export session JSON to a local file (devtools → Application → storage, or
   your documented capture path). **Never paste tokens into chat or tickets.**

### 2. Dry-run validate

```sh
node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json
```

Fix any “already expired” errors by re-exporting after a fresh login.

### 3. Write to Supabase (admin session or CRON_SECRET)

**Option A — admin session** (wallet on the 4626 admin allowlist):

```sh
ALFACLUB_ADMIN_ENDPOINT=https://app.4626.fun/api/v1/alfaclub/chat-token \
ALFACLUB_ADMIN_BEARER='<admin session bearer from browser>' \
  node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json --apply
```

**Option B — cron bootstrap** (no admin wallet; uses production `CRON_SECRET`):

```sh
curl -sS -X POST 'https://app.4626.fun/api/v1/alfaclub/chat-token' \
  -H 'content-type: application/json' \
  -H "x-cron-secret: $CRON_SECRET" \
  -d @triplet.json
```

`triplet.json` body shape:

```json
{
  "jwt": "<identity_token>",
  "privyAccessToken": "<access_jwt>",
  "privyRefreshToken": "<refresh_opaque>"
}
```

Writer is stamped `cron-token-bootstrap`. A **409** with `stale_refresh_token`
means you pasted a refresh token Privy already rotated away — mint a new
triplet in the browser.

### 4. Optional: mirror bootstrap vars on Vercel

Update Production (and Preview if you test bridge there):

- `ALFACLUB_CHAT_JWT`
- `ALFACLUB_PRIVY_ACCESS_TOKEN`
- `ALFACLUB_PRIVY_REFRESH_TOKEN`

Then redeploy **`akita-llc/4626`** production (`main` only).

CLI example (replace values from your triplet file; do not commit secrets):

```sh
cd frontend
printf '%s' '<identity_jwt>' | vercel env add ALFACLUB_CHAT_JWT production
printf '%s' '<access_jwt>'   | vercel env add ALFACLUB_PRIVY_ACCESS_TOKEN production
printf '%s' '<refresh>'      | vercel env add ALFACLUB_PRIVY_REFRESH_TOKEN production
vercel deploy --prod --archive=tgz
```

If `vercel env add` blocks on Preview branch prompts, use the Vercel dashboard
or REST API (see postmortem action #12).

### 5. Force refresh + smoke

```sh
CRON_SECRET='<from Vercel dashboard>' \
  node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json \
    --call-cron-refresh --call-bridge-run

# Or the combined ops script:
CRON_SECRET='<from Vercel dashboard>' \
  pnpm -C frontend exec tsx scripts/ops/alfaclub-prod-cron-smoke.ts
```

### 6. Room-level check (room 1043)

In the command bridge room:

- `/help` — lists commands
- `/gmeow` — local GIF (no Pinata unless you add prompt text)
- `/bridge status` — bridge config summary
- `/alfa brief post` — post digest to the configured digest room (defaults to the
  bridge room when `ALFACLUB_DAILY_BRIEF_ROOM_ID` is unset)

## Digest room (production baseline)

Daily digest posts **dynamically**: cron tries command rooms where the bot API
key can post (`ALFACLUB_CHAT_ROOM_ID`, then `ALFACLUB_HERMIT_COMMAND_ROOMS`).
Leave `ALFACLUB_DAILY_BRIEF_ROOM_ID` unset unless you need an explicit override
(and the bridge account can reach that room). We do **not** target room 2.

| Env | Production value | Purpose |
| --- | --- | --- |
| `ALFACLUB_CHAT_ROOM_ID` | `1043` | Command bridge room |
| `ALFACLUB_HERMIT_COMMAND_ROOMS` | `1043,1659` | Hermit command rooms (digest fallback order) |
| `ALFACLUB_DAILY_BRIEF_ROOM_ID` | *(unset)* | Optional override tried first |
| `ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE` | `0` / unset | Only blocks when explicit brief room equals bridge |

## GitHub auth-health monitor secret

The workflow
[`.github/workflows/alfaclub-auth-health-monitor.yml`](../../.github/workflows/alfaclub-auth-health-monitor.yml)
uses repo secret **`ALFACLUB_HEALTH_CRON_SECRET`**. It must equal Vercel
Production **`CRON_SECRET`** or every 5-minute probe returns `http_status_401`
or misleading health failures.

```sh
# One-time or after CRON_SECRET rotation on Vercel:
gh secret set ALFACLUB_HEALTH_CRON_SECRET --repo wenakita/4626 < /path/to/cron-secret-file
gh workflow run "AlfaClub auth-health monitor"
```

Local probe (same script as CI):

```sh
ALFACLUB_HEALTH_CRON_SECRET='<CRON_SECRET>' \
  node frontend/scripts/alfaclub-auth-health-monitor.mjs
```

Exit `0` = healthy; exit `1` = read the `alfaclub-auth-health: FAIL <reason>`
line and follow the matching row in
[`alfaclub-auth-hardening.md` § Recommended monitoring thresholds](./alfaclub-auth-hardening.md).

Plan digest room without posting:

```sh
pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts
```

Test post to the bridge room (requires bot access in that room):

```sh
pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts --post-test
```

Force a test digest (needs `DATABASE_URL` + valid tokens):

```sh
pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts --post-test --room=2
```

## Cloudflare proxy (do not skip after token rotation)

If logs show `cf-mitigated=challenge` or `room_history_cf_challenge`, tokens
alone will not fix history reads. Ensure Production has:

- `ALFACLUB_CHAT_API_PROXY_URL`
- `ALFACLUB_CHAT_API_PROXY_SECRET`

See [`alfaclub/infra/cloudflare-proxy/README.md`](../../alfaclub/infra/cloudflare-proxy/README.md).

## What not to do

- Do **not** enable `ALFACLUB_CHAT_BRIDGE_ENABLED` on Railway XMTP primary.
- Do **not** set `HERMIT_NON_ALFACLUB_POST_X_FIRST=1` on production unless you
  explicitly want non-AlfaClub `/gmeow` replies to return tweet URLs.
- Do **not** paste stale refresh tokens after a successful rotation (Privy
  refresh tokens are single-use).
- Do **not** treat Pinata/Hermit env rotation as AlfaClub auth rotation.

## Health snapshot: `dbEnvStaleness`

`GET /api/v1/alfaclub/chat-auth-health` (cron-secret) now includes
`data.dbEnvStaleness` when Vercel env JWTs expire **later** than the DB rows
the bridge reads. If you see `kind: "db_lags_env"`, update the DB via Option A
or B above — env-only changes are not enough.

## Open improvements (tracked in postmortem)

- Log-ingest alert on `cf_challenge_sustained` (#5).
- Rename misleading `room_history_auth_failed` log keys (#7).
