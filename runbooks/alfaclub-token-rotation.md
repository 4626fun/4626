# AlfaClub Token Rotation

Use this when the in-tree Privy refresher cannot carry forward: refresh token expired, hard rotation forced, or recovery from a token-cliff incident. Seed fresh tokens into both stores or the bridge will keep failing.

**Important:** the refresher reads `alfaclub_runtime_secret` first and only falls back to Vercel env when the DB row is missing. Updating Vercel env alone is not enough if stale DB rows exist.

## Anti-Footguns

1. **Privy refresh tokens rotate single-use.** The moment the in-tree refresher consumes one, every prior copy, including anything in a terminal or doc, is permanently invalid. Treat the browser-minted triplet as a one-shot: seed it, verify the bridge, then walk away.
2. **Do not re-seed the DB from a stale triplet on a refresh failure.** `privy_refresh_failed:400:missing_or_invalid_token` means the DB row no longer matches what Privy thinks is the current refresh token. The fix is to mint a new browser triplet, not to re-push the one that just failed. Re-pushing overwrites the live DB row with a dead value and makes recovery harder.
3. **One refresh per recovery, no encore.** Once the bridge tick is green (`fetched > 0`, `errors: []`), the cron is healthy and will rotate on its own schedule. Manually forcing another refresh narrows the access-token window with no benefit.

## Step 1 - Mint a Fresh Session

1. Open `https://alfaclub.app` in a clean browser and sign in as the bot account:
   - Twitter: `keepr4626bot`
   - Wallet: `0x8719...71AF`
   - Privy user: `did:privy:cmoccih7w...`
2. Open DevTools -> Network.
3. Find a request to `https://auth.privy.io/api/v1/sessions`.
4. Copy the JSON response and extract:
   - `identity_token` -> `ALFACLUB_CHAT_JWT`
   - `privy_access_token` -> `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN`
   - `refresh_token` -> `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN`

Do not paste live token values into chat or commit them to the repo. Treat the access and identity tokens as valid bearer credentials for their full lifetime.

## Step 2 - Update Vercel Env

Set the three values for Production and all Preview environments. Prefer the Vercel API; `vercel env add` can block on an interactive Preview branch prompt in non-TTY sessions.

```bash
TEAM_ID="<team id>"
PROJECT_ID="<project id>"
VERCEL_TOKEN="<vercel api token>"

upsert_vercel_env() {
  curl -sS -X POST \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true" \
    -d "$(jq -n --arg k "$1" --arg v "$2" \
      '{key:$k, value:$v, type:"encrypted", target:["production","preview"]}')"
  echo
}

upsert_vercel_env ALFACLUB_CHAT_JWT "<identity_token>"
upsert_vercel_env ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN "<privy_access_token>"
upsert_vercel_env ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN "<refresh_token>"
```

Then redeploy Production so serverless functions pick up the env changes:

```bash
vercel deploy --prod --archive=tgz
```

## Step 3 - Update the DB Store

**The DB store is the active source once rows exist. You must update it too.**

POST the new triplet to:

```text
POST https://4626.fun/api/v1/alfaclub/chat-token
```

Request body:

```json
{
  "jwt": "<identity_token>",
  "privyAccessToken": "<privy_access_token>",
  "privyRefreshToken": "<refresh_token>"
}
```

This endpoint requires an admin session address, not `CRON_SECRET` and not `ADMIN_API_TOKEN`.

### Option A - Admin Browser Session

Use a logged-in admin browser session and POST from a trusted origin. This avoids locally minting a session token.

### Option B - Temporary Server-Signed Session

If browser admin POST is not available, mint a temporary session token locally with `AUTH_SESSION_SECRET` and an address from `CREATOR_ACCESS_ADMIN_ADDRESSES`. Keep the script outside the repo, do not print token material, and delete it immediately afterward.

Minimal signing shape:

```python
import base64
import hashlib
import hmac
import json
import time

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

admin_address = "<configured admin address, lowercase>"
auth_session_secret = "<AUTH_SESSION_SECRET>"
now_ms = int(time.time() * 1000)
payload = {"a": admin_address, "iat": now_ms, "exp": now_ms + 7 * 24 * 60 * 60 * 1000}
payload_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode())
sig_b64 = b64url(hmac.new(auth_session_secret.encode(), payload_b64.encode(), hashlib.sha256).digest())
session_token = f"{payload_b64}.{sig_b64}"
```

Then call:

```bash
curl -sS -X POST "https://4626.fun/api/v1/alfaclub/chat-token" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Origin: https://4626.fun" \
  -d '{
    "jwt": "<identity_token>",
    "privyAccessToken": "<privy_access_token>",
    "privyRefreshToken": "<refresh_token>"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "activeSource": "db",
    "refresherBootstrapped": {
      "access": true,
      "refresh": true
    }
  }
}
```

Action item: replace this temporary-session path with a `CRON_SECRET`-gated bootstrap endpoint or a local `--from-env` admin operation.

## Step 4 - Verify

Use the production `CRON_SECRET`.

```bash
curl -sS -H "x-cron-secret: ${CRON_SECRET}" \
  https://4626.fun/api/v1/alfaclub/chat-auth-health
```

Expected:

- `liveChatJwt.minutesUntilExpiry` is positive.
- `lastSuccess.identityTokenExp` is recent.
- `bridge.consecutiveAuthFailures` is `0`.
- `bridge.consecutiveCfChallenges` is `0` or not sustained.

Force a refresh:

```bash
curl -sS -X POST -H "x-cron-secret: ${CRON_SECRET}" \
  https://4626.fun/api/v1/alfaclub/chat-token-refresh
```

Expected:

```json
{
  "success": true,
  "data": {
    "status": "refreshed"
  }
}
```

Run the bridge tick:

```bash
curl -sS -X POST -H "x-cron-secret: ${CRON_SECRET}" \
  https://4626.fun/api/v1/alfaclub/chat-bridge-run
```

Expected:

- `data.tick.fetched > 0`
- `data.tick.errors` is `[]`
- no `room_history_failed:401`
- no `cf-mitigated=challenge`

## Step 5 - Clean Up

- Delete any temp scripts or files that touched token material.
- If you forced `chat-token-refresh` as part of Step 4 and it succeeded, stop there. That refresh consumed the pasted refresh token and rotated forward.
- If `chat-token-refresh` returns `privy_refresh_failed:400:missing_or_invalid_token`, the pasted access/refresh grant is not usable anymore. Mint a new browser triplet and repeat the Vercel env + DB seed steps. Do not keep retrying or re-seeding the same DB row.
- Once `/api/v1/alfaclub/chat-bridge-run` is green (`fetched > 0`, `errors: []`), stop touching tokens. Let the normal cron own rotation from there.
