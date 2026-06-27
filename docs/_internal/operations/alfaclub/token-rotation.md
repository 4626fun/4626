---
title: AlfaClub token rotation
doc_template: runbook
status: current
---

# AlfaClub token rotation

Recover when `/gmeow` or bridge reads fail with `room_history_failed:401`, `privy_refresh_failed`, or the auth-health monitor reports `expiring_soon` / `missing_last_success`.

**Related:** [Auth hardening](./alfaclub-auth-hardening.md) · [Gmeow outage postmortem](../incidents/alfaclub-gmeow-outage-postmortem-2026-05-02.md)

## Checklist

1. Mint a **fresh** Privy triplet in a normal browser at [alfaclub.app](https://alfaclub.app) (never reuse a pasted refresh token).
2. Dry-run: `node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json`
3. Seed **Supabase** (required): `POST /api/v1/alfaclub/chat-token` via admin session, `CRON_SECRET`, or `alfaclub-restore-tokens.mjs --apply`
4. Mirror **Vercel** bootstrap env (`ALFACLUB_CHAT_JWT`, `ALFACLUB_PRIVY_ACCESS_TOKEN`, `ALFACLUB_PRIVY_REFRESH_TOKEN`) and redeploy production if you use env fallback.
5. Smoke: `pnpm -C frontend exec tsx scripts/ops/alfaclub-prod-cron-smoke.ts` (or manual `chat-auth-health` → `chat-token-refresh` → `chat-bridge-run` with `CRON_SECRET`).
6. If logs show `cf-mitigated=challenge`, fix [Cloudflare proxy](https://github.com/wenakita/4626/tree/main/alfaclub/infra/cloudflare-proxy) — tokens alone will not restore history reads.

## Rules

- **DB wins over env.** The refresher reads `alfaclub_runtime_secret` first. Updating Vercel alone does not fix a stale DB row.
- **Refresh tokens are single-use.** After a successful refresh, mint a new browser triplet; do not re-seed the same refresh token.
- **One recovery pass.** When `chat-bridge-run` shows `fetched > 0` and `errors: []`, stop — let the cron own rotation.

## Field mapping

| Browser export | Vercel env | `POST /api/v1/alfaclub/chat-token` body |
| --- | --- | --- |
| `identity_token` / `token` | `ALFACLUB_CHAT_JWT` | `jwt` |
| `privy_access_token` / `access_token` | `ALFACLUB_PRIVY_ACCESS_TOKEN` | `privyAccessToken` |
| `refresh_token` | `ALFACLUB_PRIVY_REFRESH_TOKEN` | `privyRefreshToken` |

## Seed DB

**Admin session** (wallet on admin allowlist):

```bash
ALFACLUB_ADMIN_ENDPOINT=https://app.4626.fun/api/v1/alfaclub/chat-token \
ALFACLUB_ADMIN_BEARER='<session bearer>' \
  node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json --apply
```

**Cron bootstrap** (no admin wallet):

```bash
curl -sS -X POST 'https://app.4626.fun/api/v1/alfaclub/chat-token' \
  -H 'content-type: application/json' \
  -H "x-cron-secret: $CRON_SECRET" \
  -d @triplet.json
```

`409 stale_refresh_token` → mint a new triplet in the browser.

## Verify

```bash
CRON_SECRET='<from Vercel dashboard>' \
  node frontend/scripts/alfaclub-restore-tokens.mjs /path/to/triplet.json \
    --call-cron-refresh --call-bridge-run
```

Expect: positive JWT expiry on `chat-auth-health`, `bridge-run` with `fetched > 0`, no sustained `401` or CF challenge.

## GitHub monitor secret

`ALFACLUB_HEALTH_CRON_SECRET` must equal Vercel `CRON_SECRET`:

```bash
gh secret set ALFACLUB_HEALTH_CRON_SECRET --repo wenakita/4626
gh workflow run "AlfaClub auth-health monitor"
```

## Do not

- Enable `ALFACLUB_CHAT_BRIDGE_ENABLED` on Railway XMTP primary.
- Treat Pinata/Hermit env rotation as AlfaClub auth rotation.
- Paste tokens into chat, tickets, or git.
