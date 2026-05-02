# AlfaClub Control Plane vs. Hermit Creative Lane — Operational Architecture

**Audience.** Operators who run the AlfaClub chat bridge and the Hermit /
Pinata creative agent.

**Goal.** A single page that says, for each AlfaClub-touching responsibility,
**which host owns it** and **which gates ensure no two hosts double-write the
same state**.

## TL;DR

| Responsibility | Owner | Gate |
| --- | --- | --- |
| AlfaClub auth state (`alfaclub_runtime_secret`) | Supabase (storage) | RLS deny-all |
| Privy session-token rotation | Vercel cron — `/api/v1/alfaclub/chat-token-refresh` | `CRON_SECRET` |
| Chat bridge tick (poll → command → reply) | Vercel cron — `/api/v1/alfaclub/chat-bridge-run` | `CRON_SECRET` + `ALFACLUB_CHAT_BRIDGE_ENABLED` |
| `/hermit`, `/meme`, `/gmeow` creative replies | Pinata-hosted Open Claw (Hermit) agent | Open to any AlfaClub room user (bridge-side gates only). `HERMIT_ALLOWED_USERS` still gates non-AlfaClub surfaces (direct HTTP, Telegram). `HERMIT_PINATA_*` for Pinata transport. |
| Eliza / XMTP / Telegram / Twitter / Discord runtimes | Railway long-lived agent | `AGENT_RUNTIME_ROLE=primary` |
| Hermit persona / memory / Spanish style guide | Pinata workspace `/home/node/clawd/workspace/` | manual seed sync (see below) |

**No single host owns both AlfaClub auth and creative.** That separation is
what stops the `privy_refresh_failed:400 missing_or_invalid_token` flap that
appears when two writers race the `chat_jwt` slot in Supabase. The
single-writer invariant, anomaly detection, the redacted health endpoint,
and the operator restore script are documented in
[`docs/operations/alfaclub-auth-hardening.md`](./alfaclub-auth-hardening.md).

## Components

### 1. Vercel — AlfaClub control plane

Hosts the stateless AlfaClub HTTP surface and the two crons that keep the
bridge alive:

- `POST /api/v1/alfaclub/chat-bridge-run` — every minute. Reads the active
  `chat_jwt` from `alfaclub_runtime_secret`, polls room history, dispatches
  matching slash commands through the deterministic command executor, and
  posts replies via AlfaClub's WebSocket transport.
- `POST /api/v1/alfaclub/chat-token-refresh` — every 30 minutes (`13,43 * * * *`).
  Calls `runAlfaClubPrivyRefreshOnce`, which exchanges the existing access /
  refresh tokens with Privy and writes the rotated identity token back into
  `alfaclub_runtime_secret.chat_jwt`. The bridge picks the rotated token up
  on its next tick.

Both are gated by `CRON_SECRET`. See
[`docs/operations/deployment/eliza-runtime.md` § "AlfaClub control path"](deployment/eliza-runtime.md).

#### `room_history_paginate` — Cloudflare egress and the optional proxy

`api.alfaclub.app` is fronted by Cloudflare. Cloudflare's
browser-integrity check returns HTTP 403 + CF error 1010 for
`Authorization` + naked-Node fetches. The bridge sends a Chromium
fingerprint (`User-Agent` + `Accept`/`Accept-Encoding`/`Accept-Language`
+ `sec-ch-ua` triple + `Sec-Fetch-Mode`/`Dest` + Origin/Referer/
Sec-Fetch-Site for AlfaClub-family hosts). For default
`https://api.alfaclub.app` that is enough.

When it isn't (Cloudflare WAF later starts IP-banning Vercel egress,
or the operator is replaying from a sandbox that triggers different
heuristics), set `ALFACLUB_CHAT_API_PROXY_URL` to a tiny relay you
control. Contract:

- HTTPS-only origin (cleartext is rejected by `normalizeApiProxyUrl`).
- Accepts `GET /api/websocket/room_history_paginate?...` and
  `POST /api/websocket/update_read_msg` at the same paths.
- Forwards each request unchanged (same query, same `Authorization`
  header, same body) to `https://api.alfaclub.app`.
- Returns the upstream response unchanged (status, headers, JSON body).
- The proxy MUST NOT consume the AlfaClub command/reply path
  (no posting back into the room). Vercel remains the canonical
  command processor.

A 30-line Cloudflare Worker, a fly.io app, or a Railway service
that does NOT enable `ALFACLUB_CHAT_BRIDGE_ENABLED` are all valid
deployment shapes.

When the proxy is set, the bridge calls it for both
`fetchRoomHistory` and `markReadMessage`. Diagnostic surfaces are
unchanged: a non-2xx response still lands in `tick.errors[]` with
the sanitized cf-ray / code / error / html-error-code suffix.

### 2. Supabase — AlfaClub runtime token state

`alfaclub_runtime_secret` rows (RLS deny-all) store:

- `chat_jwt` — Privy identity token; valid ~1 hour.
- `privy_access_token` — used as the Privy refresh-call input.
- `privy_refresh_token` — long-lived (~30 days) credential.

The Vercel cron is the canonical writer. The chat-bridge tick is a reader.

### 3. Railway — non-AlfaClub long-lived agents

Hosts the Eliza primary, XMTP transport, Telegram / Twitter / Discord
relays. **Does not** run the AlfaClub Privy refresher in-process: the
`startAlfaClubPrivyTokenRefresher` loop is gated by
`ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` (default off; see PR #458). Without
that flag, a Railway redeploy cannot race the Vercel cron for the `chat_jwt`
slot. Bridge polling is independently gated by `ALFACLUB_CHAT_BRIDGE_ENABLED`.

> **Operational invariant — leave both AlfaClub flags UNSET on
> Railway.** The Vercel cron is canonical. If Railway also has
> `ALFACLUB_CHAT_BRIDGE_ENABLED=true`, two bridges poll the same room
> in parallel and both attempt to reply through the same
> `keepr4626bot` identity. When the Railway image is older than
> Vercel (a stale redeploy), the Railway bridge can post replies
> from a code path Vercel has since fixed — for example a 2026-05-01
> incident where a stale Railway pre-#467 build emitted "Hermit
> access denied." into AlfaClub room 1043 in response to a normal
> `/gmeow` from a non-allowlisted sender. The Vercel bridge served
> the same command correctly on the same tick. Resolution: unset
> `ALFACLUB_CHAT_BRIDGE_ENABLED` on Railway and let Vercel be the
> only writer.

Recovery, drift symptoms, and operator playbook live in
[`docs/operations/deployment/eliza-runtime.md` § "AlfaClub control path"](deployment/eliza-runtime.md).

### 4. Pinata — Hermit creative agent

Hosts the Open Claw / Hermit agent that turns `/hermit`, `/meme`, `/gmeow`
prompts into copy / memes. Reads workspace seeds from
`/home/node/clawd/workspace/{SOUL,USER,MEMORY,SPANISH}.md`.

The Vercel chat bridge calls Pinata over a single HTTP / WebSocket endpoint
(`HERMIT_PINATA_CHAT_ENDPOINT` + `HERMIT_PINATA_BEARER_TOKEN`). This is the
only AlfaClub-related path Pinata participates in.

**Pinata must NOT** write any `alfaclub_runtime_secret` row, run the Privy
refresher, or otherwise touch AlfaClub auth. The boundary is enforced both
by code (the Hermit module never imports `chatTokenStore` /
`privyTokenRefresher`) and by tests
(`frontend/server/_lib/hermit/architectureBoundary.test.ts`,
`frontend/api/__tests__/alfaclubArchitectureInvariants.test.ts`).

#### Pinata creative backend configuration

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HERMIT_PINATA_CHAT_ENDPOINT` | Yes | — | Pinata Agent endpoint (HTTPS or WSS). |
| `HERMIT_PINATA_BEARER_TOKEN`  | Yes | — | Bearer for the Pinata Agent. |
| `HERMIT_PINATA_GATEWAY_BASE`  | No  | `https://4626.fun` | Public base for `/ipfs/<cid>` links served from saved memes. |
| `HERMIT_PINATA_HTTP_TIMEOUT_MS` | No | `30000` | HTTP fallback timeout for the creative call. Clamped to `[1000, 120000]`. |
| `HERMIT_OWNER_ADDRESS`        | No  | — | Wallet allowed to save / delete Hermit memes. |
| `HERMIT_ALLOWED_USERS`        | No  | — | Comma-separated wallet allowlist for `/hermit`, `/meme`, `/gmeow` on **non-AlfaClub** surfaces (direct HTTP at `/api/v1/chat/hermit`, Telegram). On the AlfaClub bridge (chatId `alfaclub:<room>`) the slash commands are open to any room user; this allowlist is not consulted there. Bare `gmeow` is independently sender-locked to Manito9v9 and ignores this allowlist. |
| `HERMIT_ALLOWED_ROOM_IDS`     | No  | derived from owner's AlfaClub holdings | Explicit room allowlist override. |

Failure modes:

- Pinata HTTP path 5xx or hangs → `runPinataDraft` returns `null`. `/hermit`
  and `/meme` surface `Hermit Pinata path unavailable`. `/gmeow` falls back
  to the local bundled meme catalogue (`memeStore.ts`) — the user always
  gets a reply.
- Pinata WS gateway disconnect / wrong protocol → same fallback path.
- Pinata bearer token expired → `runPinataDraft` returns `null`. The
  remediation is to rotate `HERMIT_PINATA_BEARER_TOKEN`. Hermit never tries
  to "refresh" a Pinata token — there is no shared auth state for it.

#### `/meme` inline-image contract

`/meme` returns a strict-JSON copywriter result by default
(`{ imagePrompt, caption, hashtags }`) — that's the historical
behaviour and still the default surface.

If the creative provider (today: Pinata; tomorrow: any provider behind
the same HTTP/WSS contract) opts in to surfacing a real image, it MAY
include any of the following fields in its JSON response:

| Field | Type | Notes |
| --- | --- | --- |
| `imageUrl` | string (HTTPS) | Preferred. Public URL ending in `.gif | .jpg | .jpeg | .png | .webp`. |
| `image_url` | string (HTTPS) | Snake-case alias of `imageUrl`. |
| `url` | string (HTTPS) | Last-resort top-level URL. |
| `attachments[]` | array | First entry wins; entries may be a string URL or `{ url \| imageUrl \| image_url }`. |
| `media[]`, `images[]` | array | Same shape as `attachments[]`. |

The bridge runs every candidate URL through
[`inferPublicMediaAttachment`](../../frontend/server/_lib/hermit/skillRouter.ts)
(see PR #481). Anything that does not pass — `http://`, `data:`,
malformed URLs, non-image extensions like `.svg` / `.html`, or a
`?filename=` value with a non-image extension — is dropped silently
and the reply falls back to the existing prompt/caption/hashtags
text (no error, no caller-visible change).

Provider URL contract:

- HTTPS only.
- Path tail must end in one of `.gif | .jpg | .jpeg | .png | .webp`,
  OR the URL must carry a `?filename=<name>.<ext>` query parameter
  carrying one of those extensions (covers IPFS gateway URLs).
- No tokens / signatures / temporary URLs that the AlfaClub client
  cannot fetch publicly.
- Never invent a URL: if the provider has no real image to surface,
  omit the field (or set it to `null`).

When a valid attachment is produced, AlfaClub's room renders it
inline. The validated URL is also appended to the textual reply so
clients that don't render attachments still surface a clickable
link.

### 5. Hermit workspace seeds — manual sync

The four seed files are content-only and live in this repo:

```
frontend/server/_lib/hermit/seed/SOUL.md
frontend/server/_lib/hermit/seed/USER.md
frontend/server/_lib/hermit/seed/MEMORY.md
frontend/server/_lib/hermit/seed/SPANISH.md
```

The Pinata host has no automated deployment hook from this repo. After
merging changes that touch any of these files, an operator runs:

```sh
bash frontend/scripts/hermit-seed-sync.sh diff-local      # verify contents
bash frontend/scripts/hermit-seed-sync.sh tar /tmp/seed.tar.gz
# upload tarball to Pinata workspace UI, extract into /home/node/clawd/workspace/
# then restart Hermit on Pinata so SOUL.md and friends are re-read
```

Available script modes: `list`, `bundle <out-dir>`, `tar <out-file>`,
`verify-local`, `diff-local`. `verify-local` is suitable for CI.

After deploy, run the smoke tests in
[`docs/operations/hermit-pinata-spanish.md` § "Verifying after deploy"](hermit-pinata-spanish.md).

## Why the split exists

Concrete incident class this prevents (PR #458 background):

1. Railway boots Eliza/Hermit, in-process Privy refresher rotates `chat_jwt`
   under `updated_by = cursor-hermit-rotate`.
2. Vercel cron fires 30 min later, refreshes again under
   `updated_by = privy-token-refresher`.
3. Both processes started from the same access/refresh triplet but their
   rotated outputs are independent — only the second writer's tokens are
   actually valid. The first writer's are now revoked.
4. Whichever process does the next refresh gets `400 Invalid auth token` →
   the bridge sees `privy_refresh_failed:400 missing_or_invalid_token` and
   stays broken until an operator pastes a fresh triplet.

By making Vercel cron the sole writer (and keeping the in-process refresher
default-off behind `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED`), the race
disappears. The Hermit creative lane is also kept fully out of the auth
path so that a Pinata bearer-token rotation cannot accidentally invalidate
AlfaClub auth.

## Operational checklists

### Daily / on-call

- `select updated_at, updated_by from alfaclub_runtime_secret where key = 'chat_jwt';`
  → `updated_by` should be `privy-token-refresher` and `updated_at` should
  be within the last ~30 minutes.
- If `updated_by` is anything else, see
  [`eliza-runtime.md` § "Recovery"](deployment/eliza-runtime.md).

### Before merging changes that touch hermit seeds

1. `bash frontend/scripts/hermit-seed-sync.sh verify-local` (CI runs this).
2. Eyeball `diff-local` output in the PR description so the reviewer can
   see what bytes are about to be shipped to Pinata.

### After merging changes that touch hermit seeds

1. `bash frontend/scripts/hermit-seed-sync.sh tar /tmp/seed.tar.gz`
2. Upload to the Pinata workspace.
3. Restart Hermit on Pinata.
4. Run the smoke tests in
   [`hermit-pinata-spanish.md` § "Verifying after deploy"](hermit-pinata-spanish.md).

### Recovering from `privy_refresh_failed:400 missing_or_invalid_token`

This is an **auth** incident, not a Hermit / creative incident. Do not touch
seed files, the Pinata bearer, or the Hermit module. Follow the recovery
steps in [`eliza-runtime.md` § "Recovery (operator playbook)"](deployment/eliza-runtime.md).
