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
| Chat bridge tick (poll → command → reply) | Vercel cron — `/api/v1/alfaclub/chat-bridge-run` | `CRON_SECRET` + `ALFACLUB_CHAT_BRIDGE_ENABLED`; replies prefer `ALFACLUB_API_KEY` / `alfaclub_api_key` bot-token sends when configured |
| `/hermit`, `/meme`, `/gmeow` creative replies | Pinata-hosted Open Claw (Hermit) agent | Open to any AlfaClub room user (bridge-side gates only). `HERMIT_ALLOWED_USERS` still gates non-AlfaClub surfaces (direct HTTP, Telegram). `HERMIT_PINATA_*` for Pinata transport. |
| Eliza / XMTP / Telegram / Twitter / Discord runtimes | Railway long-lived agent | `AGENT_RUNTIME_ROLE=primary` |
| Hermit persona / memory / Spanish style guide | Pinata workspace `/home/node/clawd/workspace/` | manual seed sync (see below) |

**No single host owns both AlfaClub auth and creative.** That separation is
what stops the `privy_refresh_failed:400 missing_or_invalid_token` flap that
appears when two writers race the `chat_jwt` slot in Supabase. The
single-writer invariant, anomaly detection, the redacted health endpoint,
and the operator restore script are documented in
[`docs/operations/alfaclub-auth-hardening.md`](./alfaclub-auth-hardening.md).
Token rotation (browser triplet → DB + env): [`alfaclub-token-rotation.md`](./alfaclub-token-rotation.md).

## Components

### 1. Vercel — AlfaClub control plane

Hosts the stateless AlfaClub HTTP surface and the two crons that keep the
bridge alive:

- `POST /api/v1/alfaclub/chat-bridge-run` — every minute. Reads the active
  `chat_jwt` from `alfaclub_runtime_secret`, polls room history, dispatches
  matching slash commands through the deterministic command executor, and
  posts replies through AlfaClub's stable bot-token endpoint when
  `ALFACLUB_API_KEY` (or the local `alfaclub_api_key` alias) is configured.
  If no bot token is configured, it falls back to the legacy WebSocket send
  transport.
- **Cron tick optimizations (defaults on):** `ALFACLUB_BRIDGE_CRON_SKIP_WS=1`
  skips live websocket connect (serverless cannot keep WS between ticks);
  `ALFACLUB_BRIDGE_CRON_HISTORY_LIMIT=12` caps history fetch size;
  ingest upserts only slash-command candidates (less Supabase churn);
  one read-receipt per batch instead of per command; bridge-runner Pinata
  calls use HTTP draft lane (no gateway WS echo).
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
relays. **For the dedicated Hermit service (hermit.4626.fun):** it is now recommended
to set `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED=1` on this service only.
This makes the long-lived Hermit process the owner of token rotation for the
AlfaClub bridge (especially important for 1659 theatrical marketing).

Other Railway services (Keepr primary, etc.) should leave the flag unset so
the Vercel cron remains the writer.

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

### 4. Hermit creative brain — first-party `/api/hermit/draft` (AI Gateway)

> **Pinata OpenClaw is retired.** The creative brain is now a first-party
> Vercel route, `POST /api/hermit/draft`
> (`frontend/api/_handlers/hermit/_draft.ts`), which relays the prompt to a
> model through the **Vercel AI Gateway** and returns the generated line. The
> Pinata gateway WebSocket transport and `HERMIT_PINATA_*` env have been
> removed from `skillRouter.ts`.

Turns `/hermit`, `/meme`, `/gmeow` prompts into copy / memes. The skill
router (`server/_lib/hermit/skillRouter.ts`) owns persona, room context, and
strict-JSON instructions inside the `prompt` it builds; the draft endpoint is
a thin, stateless relay.

The Vercel chat bridge and the Railway Hermit worker both call the brain over
a single authenticated HTTP endpoint (`HERMIT_AGENT_CHAT_ENDPOINT` +
`HERMIT_AGENT_BEARER_TOKEN`). The contract is `POST { prompt }` →
`{ text }` — `runPinataDraftOverHttp` reads the top-level `text` (or
`response` / `output` / `message`).

Reply transport is separate from Hermit generation. AlfaClub now supports
scope-specific bot tokens: `messages:send` for reply transport and
`messages:read` for room-history polling. The bridge prefers
`ALFACLUB_READ_BOT_TOKEN` for polling and still uses `chat_jwt` for websocket
ingest / reaction lanes.

**The Hermit lane must NOT** write any `alfaclub_runtime_secret` row, run the
Privy refresher, or otherwise touch AlfaClub auth. The boundary is enforced
both by code (the Hermit module never imports `chatTokenStore` /
`privyTokenRefresher`) and by tests
(`frontend/server/_lib/hermit/architectureBoundary.test.ts`,
`frontend/api/__tests__/alfaclubArchitectureInvariants.test.ts`).

#### Creative backend configuration

| Env var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HERMIT_AGENT_CHAT_ENDPOINT` | Yes | — | Creative brain endpoint. Point at `https://app.4626.fun/api/hermit/draft`. |
| `HERMIT_AGENT_BEARER_TOKEN`  | Yes | — | Shared bearer the caller sends and the draft route verifies. The route fails closed (HTTP 503) when this is unset, so it can never generate unauthenticated. |
| `AI_GATEWAY_API_KEY`         | On Vercel: no (OIDC); elsewhere: yes | — | AI Gateway auth for the draft route. Vercel deployments use OIDC automatically. |
| `HERMIT_AGENT_MODEL`         | No  | `openai/gpt-4.1-mini` | Model routed through the AI Gateway (plain `provider/model` string). |
| `HERMIT_AGENT_SYSTEM`        | No  | — | Optional system prompt. Leave unset — the router already embeds persona/context in the prompt. |
| `HERMIT_AGENT_MAX_OUTPUT_TOKENS` | No | `400` | Max output tokens per draft. Clamped to `[32, 4000]`. |
| `HERMIT_AGENT_DRAFT_TIMEOUT_MS` | No | `25000` | Server-side generation timeout. Clamped to `[5000, 60000]`. Keep below `HERMIT_AGENT_HTTP_TIMEOUT_MS`. |
| `HERMIT_AGENT_HTTP_TIMEOUT_MS` | No | `30000` | Caller-side HTTP timeout for the creative call. Clamped to `[1000, 120000]`. |
| `HERMIT_AGENT_GATEWAY_BASE`  | No  | `https://4626.fun` | Public base for `/ipfs/<cid>` links served from saved memes. |
| `HERMIT_OWNER_ADDRESS`        | No  | — | Wallet allowed to save / delete Hermit memes. |
| `HERMIT_ALLOWED_USERS`        | No  | — | Comma-separated wallet allowlist for `/hermit`, `/meme`, `/gmeow` on **non-AlfaClub** surfaces (direct HTTP at `/api/v1/chat/hermit`, Telegram). On the AlfaClub bridge (chatId `alfaclub:<room>`) the slash commands are open to any room user; this allowlist is not consulted there. Bare `gmeow` is independently sender-locked to Manito9v9 and ignores this allowlist. |
| `HERMIT_ALLOWED_ROOM_IDS`     | No  | derived from owner's AlfaClub holdings | Explicit room allowlist override. |

#### `/gmeow` latency policy (default optimized)

| `HERMIT_GMEOW_HERMIT_CAPTION` | Behaviour |
| --- | --- |
| *(unset)* | **Local bundled GIF only** for bare `/gmeow`. The Hermit agent runs only when the user adds text after the command (e.g. `/gmeow moon`). |
| `always` / `1` | Hermit caption on every `/gmeow` when `HERMIT_AGENT_*` is set (legacy behaviour). |
| `prompt` | Same as unset — explicit alias. |
| `0` / `never` | Never call the Hermit agent for `/gmeow`. |
| `legacy` | Always call the Hermit agent when configured (pre-optimization default). |

This keeps the hot path (spammy bare `/gmeow`) off the model while `/meme` and `/hermit` still use the Hermit agent.

Failure modes:

- Draft route 5xx or hangs → `runPinataDraft` returns `null`. `/hermit`
  and `/meme` surface `Hermit agent path unavailable`. `/gmeow` falls back
  to the local bundled meme catalogue (`memeStore.ts`) — the user always
  gets a reply.
- Bearer mismatch / unset → the draft route returns 401 / 503 and the caller
  treats the non-2xx as `null` (same fallback path). Remediation is to align
  `HERMIT_AGENT_BEARER_TOKEN` on both the caller and the route.
- AI Gateway auth/model error → the draft route returns 502; same fallback.
  Check `AI_GATEWAY_API_KEY` (or Vercel OIDC) and `HERMIT_AGENT_MODEL`.

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

When a valid attachment is produced, AlfaClub's room can render it
inline. For AlfaClub bridge replies (`chatId = alfaclub:<roomId>`),
the default runtime now posts to X first and returns the tweet URL
in-room when `HERMIT_ALFACLUB_POST_X_FIRST` is enabled (default).
Set `HERMIT_ALFACLUB_POST_X_FIRST=0` to keep direct inline media
delivery in-room. Non-AlfaClub surfaces can still use
`HERMIT_NON_ALFACLUB_POST_X_FIRST` (tweet URL only).

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
- Official Hermit command rooms for hermit4626:
  - **1043** (primary ops/creative surface)
  - **1659** (https://alfaclub.app/rooms/1659/)
  - In **1043** or **1659**: `/bridge` or `/alfa status` for pipeline + JWT health; `/help` for command list.
  - Daily digest cron posts to the bridge room unless `ALFACLUB_DAILY_BRIEF_ROOM_ID` points at a room the bot can reach (we do not use room 2 — no post access).
- Local env checklist (no secrets printed):
  `pnpm -C frontend exec tsx scripts/ops/alfaclub-env-preflight.ts`
- Full Hermit creative audit (tests + seeds + probe + manual room checklist):
  `bash frontend/scripts/ops/audit-hermit-e2e.sh --strict`
  Add `--production-env` to run preflight/probe against Vercel production vars.
- **Digest (default):** leave `ALFACLUB_DAILY_BRIEF_ROOM_ID` unset so cron posts to
  `ALFACLUB_CHAT_ROOM_ID` (1043). Only set a separate digest room when the bridge
  account can post there.

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
