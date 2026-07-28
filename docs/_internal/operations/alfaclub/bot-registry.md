# Bot Registry

Operational source of truth for bot identities, token ownership, and env-variable scope.

## Why this exists

- Prevent credential mixups across multiple bots/services.
- Keep token rotation and incident response deterministic.
- Make it obvious which runtime owns each bot.

## Naming policy

- Canonical human-readable name in this repo: **Hermit (`@keepr4626bot`)**.
- Treat `Hermit` (runtime/persona) and `@keepr4626bot` (X handle) as the same bot identity.
- In docs/ops messages, prefer the combined label `Hermit (@keepr4626bot)` on first mention.
- Use an explicit runtime prefix for bot-specific env vars (example: `HERMIT_TWITTER_*`).
- Avoid sharing one bot's OAuth credentials across multiple runtimes.
- Keep plain/generic env names (`TWITTER_*`) reserved for compatibility only.

## Current bots

| Bot Handle | Purpose | Owning Runtime/Service | Primary Env Prefix | Notes |
| --- | --- | --- | --- | --- |
| `@keepr4626bot` / `hermit4626bot` (Telegram) | Hermit AlfaClub creative posting (`/hermit`, `/meme`, `/gmeow`, `/x post`) | **Vercel** (`4626.fun` bridge cron + `hermit.4626.fun` Telegram webhook) | `HERMIT_TWITTER_*`, `HERMIT_PINATA_*`, `TELEGRAM_TO_ALFACLUB_*` | Chat bridge ticks run on Vercel cron (`/api/v1/alfaclub/chat-bridge-run`). Railway `4626-hermit-agent` is optional and **blocked from in-process bridge** unless `ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY=1`. |
| `<fill-me>` | `<fill-me>` | `<fill-me>` | `<fill-me>` | Add every additional bot before enabling it in production. |

## Bot profile: Hermit (`@keepr4626bot`)

### Responsibilities

- **AlfaClub room automation (primary):**
  - Official Hermit command rooms (via `ALFACLUB_HERMIT_COMMAND_ROOMS` or legacy `ALFACLUB_CHAT_ROOM_ID`):
    - `1043` (primary ops / creative command surface)
    - `1659` (https://alfaclub.app/rooms/1659/)
  - The bridge ingests commands from these rooms (and all rooms when `ALFACLUB_CHAT_WS_INGEST_ALL_ROOMS_ENABLED=1`).
  - Handles slash commands (`/hermit`, `/meme`, `/gmeow`, `/help`, etc.) routed into deterministic command execution.
- **Hermit creative lane:**
  - `/hermit`, `/meme`, `/gmeow` run through Pinata agent endpoint.
  - Creative generation is isolated from AlfaClub auth-token rotation.
- **Telegram relay (optional fan-out):**
  - Mirrors room responses to configured Telegram chat/thread when enabled.
- **Twitter/X posting lane:**
  - Supports `/x status`, `/x post`, `/tweet`.
  - `/gmeow` can post to X first and return tweet URL when feature-flagged.

### Service/runtime ownership

- **Owning service:** Vercel production (`akita-llc/4626`) — bridge cron + Telegram ingress on `hermit.4626.fun`
- **Optional long-lived host:** Railway `4626-hermit-agent` (`frontend/server/agents/hermit/index.ts`) — health at Railway URL, not `hermit.4626.fun/healthz` (that host serves the Vercel SPA)
- **Identity rule:** if logs say `hermit` and social/chat surfaces say `@keepr4626bot`, that is expected and refers to one bot.
- **Canonical auth refresher model:** in-process refresher disabled; Vercel cron remains canonical token writer.

### Key env groups

- **AlfaClub bridge core**
  - `ALFACLUB_CHAT_BRIDGE_ENABLED`
  - `ALFACLUB_CHAT_ROOM_ID` (legacy single primary; still honored)
  - `ALFACLUB_HERMIT_COMMAND_ROOMS` (preferred: comma-separated list, e.g. `1043,1659`)
  - `ALFACLUB_API_KEY`
  - `ALFACLUB_CHAT_API_BASE_URL`
  - `ALFACLUB_CHAT_API_PROXY_URL`
  - `ALFACLUB_CHAT_API_PROXY_SECRET`
- **Websocket stability controls**
  - `ALFACLUB_CHAT_WS_LIVE_FALLBACK_ENABLED`
  - `ALFACLUB_CHAT_WS_INGEST_ALL_ROOMS_ENABLED`
- **Telegram relay**
  - `ALFACLUB_TELEGRAM_RELAY_ENABLED`
  - `ALFACLUB_TELEGRAM_RELAY_CHAT_ID`
  - `ALFACLUB_TELEGRAM_RELAY_THREAD_ID`
  - `ALFACLUB_TELEGRAM_BOT_TOKEN` (or fallback `TELEGRAM_BOT_TOKEN`)
- **Pinata creative lane**
  - `HERMIT_PINATA_CHAT_ENDPOINT`
  - `HERMIT_PINATA_BEARER_TOKEN`
  - `HERMIT_PINATA_GATEWAY_BASE`
- **Twitter/X lane**
  - Preferred: `HERMIT_TWITTER_API_KEY`, `HERMIT_TWITTER_API_SECRET`, `HERMIT_TWITTER_ACCESS_TOKEN`, `HERMIT_TWITTER_ACCESS_SECRET`
  - Compatibility fallback: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
  - AlfaClub media mode: `HERMIT_ALFACLUB_POST_X_FIRST` (default on — post to X first, then send tweet URL in-room)
  - Non-AlfaClub X-first mode: `HERMIT_NON_ALFACLUB_POST_X_FIRST`

### Telegram room mapping (`@keepr4626bot`)

Current mapping:

| Environment | Relay enabled | Telegram chat ID | Thread/topic ID | Deep link | Source env |
| --- | --- | --- | --- | --- | --- |
| Production (`4626`) | `true` | `-1003709479662` | `2` | [Open topic](https://t.me/c/3709479662/2) | `ALFACLUB_TELEGRAM_RELAY_ENABLED`, `ALFACLUB_TELEGRAM_RELAY_CHAT_ID`, `ALFACLUB_TELEGRAM_RELAY_THREAD_ID` |
| Staging/Test | `<fill-me>` | `<fill-me>` | `<fill-me>` | `<fill-me>` | Add before enabling relay in any non-prod environment. |

Link note:

- Telegram private supergroup links use the form `https://t.me/c/<chatIdWithout-100>/<threadId>`.
- You must be a member of the target group/topic for the link to open.

Update rule:

- When changing Telegram destination, update these env vars together and redeploy.
- Keep this table in sync with production after each destination change.

### Per-room channel bindings (AlfaClub hub ↔ Telegram ↔ XMTP)

Canonical registry: `alfaclub.room_channel_bindings` (migration
`20260716170000_alfaclub_cross_channel_foundation.sql`). Implementation:
`frontend/server/_lib/alfaclub/roomChannelBindings.ts` +
`roomChannelBridge.ts`. The retired `room1659XmtpBridge.ts` module is gone;
room `1659` is the seeded canary row only.

- **Authority:** AlfaClub room transcript + `alfaclub.room_access_memberships`
  remain source of truth. Telegram / XMTP / 4626 web are adapters.
- **Seed:** room `1659` ships with `enabled=false`, `rollout_status='canary'`,
  synthetic Keepr vault `0x0000000000000000000000000000000000001659`.
  No Telegram/XMTP flags are on until an operator promotes the row.
- **Ingress ledger:** `alfaclub.cross_channel_ingress` claims source messages
  (`telegram` | `xmtp` | `web4626`), stores original command text, and links
  the resulting AlfaClub message id to a validated profile + parent CSW issuer.
  Command execution refuses relayed messages without a trusted linked issuer.
- **Loop prevention:** `alfaclub.chat_bridge_message_origin` origins are
  `telegram` | `xmtp` | `web4626`. Fan-out skips only the source channel.
- **Native UI:** `/rooms?tab=chat` reads/posts via
  `GET|POST /api/v1/alfaclub/room-chat` (session auth + active membership).
- **Sending identity for XMTP bridge actions:** protocol agent CSW
  (`PROTOCOL_CSW_*`) via Keepr queue — never a user wallet and never a new
  bridge wallet.
- **Legacy env fallback:** `TELEGRAM_TO_ALFACLUB_*` and
  `ALFACLUB_TELEGRAM_RELAY_*` remain for unconfigured rooms during transition;
  registry rows win when present. Prefer registry over new env for additional rooms.

#### Room 1659 canary stages (operator checklist)

**Access split (2026-07-28):** GET allows FriendKey **or** creator-coin buy-quote equivalent; POST / XMTP membership require FriendKey hold or stake. Coin holders are read-only. Ops helper: `pnpm -C frontend ops:alfaclub-room1659-chat-canary` (`--enable-xmtp`, `--backfill`).

Promote only after the previous stage is healthy. Mirror **new messages only**
(no historical backfill in MVP).

1. **Web read-only** — leave binding `enabled=false`; verify Chat tab loads
   ingest history for members with session auth.
2. **Web posting** — enable room-access policy for 1659; confirm POST
   `/api/v1/alfaclub/room-chat` rejects non-members and links `web4626` ingress.
3. **Telegram bidirectional** — set `telegram_enabled` + chat/thread on the
   binding; confirm linked Telegram identity + active membership required;
   confirm origin-aware fan-out (no Telegram echo loops).
4. **XMTP bidirectional** — set `xmtp_enabled=true` (requires protocol CSW
   runtime config); confirm Keepr vault bootstrap, outbound enqueue, inbound
   membership/issuer fail-closed path.
5. **Active-member backfill** — run
   `backfillActiveRoomChannelBridgeMembers({ roomId: '1659' })` once after
   XMTP enable; verify idempotent add_member dedupe keys.
6. **Cross-channel commands** — slash commands from Telegram/XMTP/web must
   execute as the linked parent CSW issuer from ingress, never the relay bot.
7. **Second curated room** — insert another binding and prove isolation before
   enabling further rooms by registry rows (no new code).

Retired note: `ROOM_1659_XMTP_BRIDGE_ENABLED` is no longer the control plane;
use the `1659` row in `alfaclub.room_channel_bindings`.

### Fast health checks

- **Bridge alive:** startup logs show `AlfaClub chat bridge started` and `AlfaClub chat seeded`.
- **CF challenge health:** no repeated `room_history_cf_challenge` / `cf_challenge_sustained`.
- **WS lane health:** no recurring `ws_error` rollups (or disable WS fallback lanes for poll-only mode).
- **Twitter write health:** run `/x status`, verify expected handle + `oauth1 access-level: read-write`.
- **Creative path health:** `/gmeow` returns clean reply (or tweet URL in X-first mode), no raw provider OAuth errors in user-facing text.

## Rotation checklist

1. Rotate keys in X Developer Portal for the target bot.
2. Update only that bot's env prefix on the owning service.
3. Redeploy the owning service.
4. Run `/x status` and verify:
   - expected account handle
   - `oauth1 access-level: read-write`
5. Record `rotated_at` and operator in your release notes or incident log.

## Incident guardrails

- If `/x status` reports an unexpected handle, treat as credential misbinding.
- If access level drops to `read`, regenerate Access Token + Access Secret after confirming app permission is `Read and write`.
- Never copy secrets between runtimes "temporarily"; rotate and scope instead.
