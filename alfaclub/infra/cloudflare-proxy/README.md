# alfaclub-proxy

A Cloudflare Worker that the 4626 chat bridge calls instead of `https://api.alfaclub.app` directly. Bypasses the Cloudflare bot-fight challenge that was blocking Vercel egress IPs.

## Canonical hostname

**Custom domain: `https://relay.4626.fun`**

`alfaclub.4626.fun` is reserved for the AlfaClub product SPA on Vercel. Do not re-bind this Worker to `alfaclub.4626.fun`.

Set Vercel:

```
ALFACLUB_CHAT_API_PROXY_URL=https://relay.4626.fun
```

## What it does

- Accepts `GET /api/websocket/room_history_paginate`, `POST /api/websocket/update_read_msg`, and `POST /api/room/:roomId/message`.
- Forwards them to `UPSTREAM_API_BASE` (default `https://api.alfaclub.app`) on a clean Cloudflare-egress IP.
- Strips Cloudflare-injected headers (`cf-connecting-ip`, `cf-ray`, `cdn-loop`, etc.) so the upstream WAF sees a clean fingerprint.
- Preserves the bridge's `Authorization: Bearer <jwt>`, `Origin`, `Referer`, `User-Agent`, and `sec-ch-ua*` headers.
- Returns the upstream response unchanged (including its `cf-ray`, which the bridge already parses).

It is **not** a JWT minter. It is **not** a token store. It never inspects request bodies.

## Cutover order (required)

1. Deploy this Worker with `relay.4626.fun` bound (`pnpm deploy` from this directory).
2. Set `ALFACLUB_CHAT_API_PROXY_URL=https://relay.4626.fun` on Vercel (Production + Preview) and redeploy.
3. Verify `/_health` and chat-bridge traffic on `relay.4626.fun`.
4. Only then remove any remaining `alfaclub.4626.fun` Worker binding and attach `alfaclub.4626.fun` to the frontend Vercel project.

Do not release `alfaclub.4626.fun` to Vercel before step 3 — that creates a chat-proxy outage.

## Setup (5 minutes)

```bash
cd alfaclub/infra/cloudflare-proxy
pnpm install                       # installs wrangler + types
pnpm wrangler login                # opens browser, picks the account
```

Generate a long random shared secret (32 bytes ≈ 64 hex chars):

```bash
SHARED_SECRET=$(openssl rand -hex 32)
echo "$SHARED_SECRET"              # copy this — we'll need it twice
```

Push the secret to Cloudflare:

```bash
echo -n "$SHARED_SECRET" | pnpm wrangler secret put PROXY_SHARED_SECRET
```

Deploy:

```bash
pnpm deploy
# → Published alfaclub-proxy
#   Custom domain: https://relay.4626.fun
#   (workers.dev URL also available as fallback)
```

## Wire it into the 4626 frontend

Add to Vercel project env (Production + Preview):

```
ALFACLUB_CHAT_API_PROXY_URL=https://relay.4626.fun
ALFACLUB_CHAT_API_BASE_URL=https://api.alfaclub.app
ALFACLUB_CHAT_API_PROXY_SECRET=<paste $SHARED_SECRET here>
```

The bridge already sends `x-proxy-secret` when `ALFACLUB_CHAT_API_PROXY_SECRET` is set (`frontend/server/_lib/alfaclub/chatBridge.ts`).

Redeploy. The bridge will route history reads through the Worker; the fingerprint headers (`Origin: https://alfaclub.app`, `Referer`, `Sec-Fetch-Site: same-site`) are preserved because `fingerprintBaseUrl` still points at `api.alfaclub.app`.

## Verify it's working

```bash
# Direct health check
curl -s https://relay.4626.fun/_health
# → {"ok":true,"upstream":"https://api.alfaclub.app"}

# Auth gate is enforced
curl -s -o /dev/null -w "%{http_code}\n" \
  https://relay.4626.fun/api/websocket/room_history_paginate?roomId=1043
# → 401 (expected — no x-proxy-secret)

# End-to-end through the bridge
curl -sH "x-cron-secret: $CRON_SECRET" \
  https://<vercel-host>/api/v1/alfaclub/chat-bridge-run | jq
# → fetched > 0, no `cf-mitigated=challenge` in errors[].
```

In Vercel logs after the redeploy, you should see:
- ✅ `[alfaclub-chat] room_history_cf_challenge` count drops to **0** per tick.
- ✅ `[alfaclub-refresher] immediate refresh requested reason=bridge_auth_fail` stops firing.
- ✅ `/gmeow` posts get a reply within one tick.

In Cloudflare Workers logs (`pnpm logs` or dashboard → **Logs**), you'll see one entry per bridge call with `cf-ray` correlation.

## Operational notes

- **Path allowlist** is in `wrangler.toml` (`ALLOWED_PATH_PREFIXES`). If you ever need a third endpoint, add it there and redeploy — never expand the list dynamically.
- **Cache TTL** is `0` by design. Stale chat history would mask new `/gmeow` messages.
- **Rotation:** to rotate `PROXY_SHARED_SECRET`, generate a new one, run `wrangler secret put PROXY_SHARED_SECRET`, then update `ALFACLUB_CHAT_API_PROXY_SECRET` in Vercel and redeploy. The Worker only ever reads the latest secret, so you'll get a brief 401 window — fine for a 30-second swap, but if you need zero-downtime, add a second secret slot first.
- **Removing the proxy:** unset `ALFACLUB_CHAT_API_PROXY_URL` in Vercel and redeploy. The bridge falls back to direct calls. You can leave the Worker live or `wrangler delete`.
- **WS traffic** still goes direct (`ALFACLUB_CHAT_WS_URL` → `wss://api.alfaclub.app/...`). The Cloudflare challenge usually fires on HTTP first, and command replies use the HTTP bot-token path (`/api/room/:roomId/message`) through this Worker. If WS starts getting challenged later, you can add a separate WS-tunnel Worker; this one stays HTTP-only.
- **Logging:** the Worker never logs request bodies, JWTs, or full URLs. It logs status code + cf-ray + path prefix only (via Workers' built-in observability).

## Files

```
alfaclub/infra/cloudflare-proxy/
  README.md           ← this file
  wrangler.toml       ← Worker config + plain vars (relay.4626.fun)
  package.json
  tsconfig.json
  src/index.ts        ← the Worker (≈200 lines, no deps)
```
