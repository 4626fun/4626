# Bot / Integration Tokens (/docs/developers/api-endpoints/bot-tokens)



Alfa Club supports per-user **bot tokens** - long-lived API credentials that act on your behalf, scoped narrowly to chat actions in rooms you hold a key in. Use them when you want to wire up a bot, a webhook, an analytics job, or any external automation that needs to post to a chat or read room history without keeping a live user session open.

This is the recommended replacement for keeping a Privy session warm and reusing the resulting JWT - that approach is fragile (sessions drop, tokens rotate, scope is unbounded). Bot tokens are explicit, revocable, and rate-limited.

## Before you start [#before-you-start]

A few things to understand:

* **The bot acts as you.** Messages it sends appear under your username and avatar (with a small 🤖 badge so other keyholders can tell). Anything the bot says, you said. Treat the token like a password.
* **The bot inherits your room access.** If you hold a key in room `42`, the bot can use its granted chat scopes in room `42`. Sell the key - the bot loses access on the next request, automatically. Buy a new key elsewhere - the bot can use its granted scopes there too.
* **Two chat scopes.** `messages:send` lets a token post chat messages. `messages:read` lets it read paginated room history. Bots cannot trade, stake, bridge, manage rooms, or take any other action.
* **Tokens are private.** They are shown exactly once, when created. Alfa Club only stores a SHA-256 hash; nobody (including support) can recover a token after creation. If you lose it, revoke and create a new one.

## Creating a token [#creating-a-token]

1. Open the app and sign in
2. **Settings → Developer → API Tokens**
3. Click **Create token**, give it a descriptive name (e.g. `analytics-bot`, `discord-relay`), and select the scopes it needs
4. **Copy the plaintext** shown in the modal - it starts with `alfa_bot_` followed by 32 random characters. You will not see it again.
5. The list view shows the token's prefix, last-used time, and expiry. Use the **Revoke** button to invalidate it at any time.

You can hold up to **5 active tokens** at a time. Revoke unused ones.

Prefer the least-privileged scope set:

| Scope           | Allows                                      | Typical use                           |
| --------------- | ------------------------------------------- | ------------------------------------- |
| `messages:send` | Post chat messages in rooms you can access. | Discord relays, alerts, webhook bots. |
| `messages:read` | Read chat history in rooms you can access.  | Analytics, moderation tools, exports. |

## API reference [#api-reference]

The interactive panel below documents the endpoints exposed to bot tokens.
Use the **Test it** tab to issue a request directly from the browser - paste
your `alfa_bot_…` token into the `Authorization` field and a room you hold a
key in.

<APIPage
  document="openapi/bot-tokens.yaml"
  operations="[
  { path: &#x22;/api/room/{roomId}/message&#x22;, method: &#x22;post&#x22; },
  { path: &#x22;/api/room/{roomId}/messages&#x22;, method: &#x22;get&#x22; },
]"
  hasHead="false"
/>

### Reading room history [#reading-room-history]

Use `GET /api/room/{roomId}/messages` with a token that has `messages:read`.
The response includes message objects plus `nextCursor` and `prevCursor`. Some
additional display metadata fields may be present; treat fields not documented
in the API schema as unstable.

Room access is checked on every request. The token owner must hold a key in the
room, unless the room is the default public room. If `roomAllowlist` is set on
the token, the requested room must also be in that allowlist.

History visibility follows the same rule as the app:

* Room owners can read the full visible room history.
* Non-owner keyholders can read messages sent after their key was created, plus up to 10 older visible messages before that join timestamp.
* The default public room is not subject to the 10-message historical cap.

### Idempotency [#idempotency]

For message sends, set an `Idempotency-Key` header to safely retry network
failures without sending duplicates. Repeats of the same `(token, key)`
combination within a 5-minute window return the same `messageId` and set
`deduped: true` in the response. Different keys are treated as different
messages. Keys must be ≤ 128 characters; longer values are silently treated as
if no key was sent. History reads are naturally idempotent and do not use this
header.

## Rate limits [#rate-limits]

Bot token sends and reads use separate token-bucket limits.

| Endpoint     | Bucket    | Capacity | Refill                 | Effect when exceeded            |
| ------------ | --------- | -------- | ---------------------- | ------------------------------- |
| Send message | Per-token | 5        | 1 message every 3 s    | `429` with `Retry-After` header |
| Send message | Per-owner | 600      | 600 messages per hour  | `429` with `Retry-After` header |
| Read history | Per-token | 60       | 1 request every second | `429` with `Retry-After` header |
| Read history | Per-owner | 600      | 600 requests per hour  | `429` with `Retry-After` header |

The per-token bucket is the burst limiter. The per-owner bucket is a backstop against creating many tokens to evade per-token caps.

If you need higher throughput, get in touch - we'd rather raise your cap than have you fight the limiter.

## Lifecycle [#lifecycle]

| Event                  | Effect                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Create**             | Token is generated, hashed, stored. Plaintext shown once.                                                          |
| **Use**                | `last_used_at` updated (≤ once per minute per token).                                                              |
| **Hard expiry**        | All tokens expire 1 year after creation.                                                                           |
| **Idle revoke**        | A daily sweep revokes tokens unused for > 90 days.                                                                 |
| **Manual revoke**      | Press **Revoke** in Settings → Developer. Effect is immediate - the next request from a revoked token returns 401. |
| **Sell your last key** | The next request returns 403; no token action needed. Buy back the key and the bot resumes.                        |
| **Account deletion**   | All your tokens are cascaded out.                                                                                  |

## Security and accountability [#security-and-accountability]

A few things worth being explicit about:

* **You are accountable for what your bot says.** Every bot message is internally attributable to the token that sent it. Other keyholders see your username with a 🤖 badge - they know it's a bot but they associate it with you.
* **Read tokens can expose room history.** Treat a `messages:read` token like any other credential with access to private room content. If a tool only needs to post, do not grant `messages:read`.
* **Spam, harassment, or wash-amplification via bots is grounds for action** under the same policies as human posts. Repeated abuse from a single owner can result in losing API token privileges entirely (separate from any room-level moderation).
* **If a token leaks, revoke it immediately** in Settings → Developer. If you suspect compromise we can identify which messages came from the leaked token vs. legitimate use of your account.
* **Never commit a token to a public repo.** GitHub's secret scanner can be configured to alert on the `alfa_bot_` prefix; we recommend doing so.

## What's not supported [#whats-not-supported]

Bot tokens are scoped to sending chat messages and reading paginated room history. They cannot search messages, trade, stake, bridge, manage rooms, update read state, or take any other write action.

If you have a specific use case that would benefit from a broader API surface, let us know - that's the strongest signal for what to ship next.
