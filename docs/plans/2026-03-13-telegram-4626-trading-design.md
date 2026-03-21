# Telegram-Native 4626 Trading Experience Design

Date: 2026-03-13  
Status: Approved  
Owner: 4626 Product + Agent Platform

> Historical note (2026-03-20): this design predates the current Telegram model. Telegram now uses the Mini App only for secure account linking and wallet-finalization steps; ongoing actions run through the bot. The canonical 4626 identity is the verified email, while the canonical CSW remains the execution wallet. See [frontend/docs/account-auth-invariants.md](/home/akitav2/projects/4626/frontend/docs/account-auth-invariants.md).

## Implementation Snapshot (2026-03-13)

- Phase A+ shipped: link/unlink/status, read command set, callback menu wiring, and Telegram audit/schema helpers.
- Phase B shipped: `/buy` and `/sell` preview/confirm, in-place menu edits, callback toasts, and 4626 scope guards.
- Phase C shipped: `/bid` USD-intent ETH execution path, richer signal posts, copy shortcuts, and signal-topic routing.
- Balanced controls shipped: scoped `setMyCommands`, menu-button config endpoint, copy_text fallback path, membership checks, and rate limiting.
- Stars tips-first shipped behind feature flags:
  - `TELEGRAM_STARS_TIPS_ENABLED`
  - `TELEGRAM_STARS_TIPS_ALLOWED_CHAT_IDS`
  - Tip callbacks now open `XTR` invoices, pre-checkout is validated, and successful payments are logged into audit + thanked in chat.
- Verification executed on shipped state:
  - `pnpm -C frontend test -- api/__tests__/telegramEndpoints.test.ts api/__tests__/telegramWebhook.test.ts api/__tests__/waitlistVerifySocial.test.ts`
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend exec eslint api/_handlers/telegram/_webhook.ts api/__tests__/telegramWebhook.test.ts api/__tests__/telegramEndpoints.test.ts api/_handlers/waitlist/_verify-social.ts`

## Context

The current command and messaging model works, but user behavior is concentrated in Telegram and X. Users want a Friendtech-like social experience where discovery and coordination happen in Telegram, while onchain actions stay constrained to the 4626 ecosystem.

Historical target model:

- Telegram-first social surface
- one-time identity/linking handshake in app
- ongoing onchain actions from Telegram bot flows without repeated link handshakes
- strict canonical wallet enforcement (canonical Coinbase Smart Wallet as sender/account)

## Goals

- Build a Telegram-first social + trading loop for 4626.
- Allow one-time link: `telegram_user_id -> privy_user_id -> canonical_csw_address`.
- Restrict write actions to 4626-only scope.
- Use inline preview + confirm for all write actions.
- Show exact onchain execution amounts at confirmation time.
- Keep execution safe with short-lived signed callback tokens, replay protection, and audit logs.

## Success Metrics and KPIs

- Link completion rate > 70%
- Percent of 4626 trades executed via Telegram: 65%+ within 90 days
- Daily active traders in supergroup
- Signal engagement (reactions + copy-trades)
- Average time from command to confirmed tx < 15s

## Non-Goals

- No generic token routing outside 4626.
- No free-form write execution from arbitrary text without inline confirmation.
- No silent sender/account switching away from canonical CSW.
- No dependence on repeated Mini App opens for each transaction.

## Product Shape (Chosen + Enhanced)

Flagship Telegram supergroup with topic-based segmentation:

- `Lobby` (open social discussion)
- `Holders` (token-gated access)
- `Signals` (bot-posted activity feed: buys/sells/bids, leaderboard, notable events)

UX layers for fast discovery and retention:

- Persistent bot menu (`setMyCommands` scoped to supergroup):
  - `Buy`, `Sell`, `Bid`, `Portfolio`, `Vaults`, `Auctions`, `Signals`, `Linked`
- Inline query picker:
  - type `@4626bot vaultx` for instant dropdown command suggestions
- Flexible command parsing (order-independent args and shorthand variants)
- Auto welcome message with deep-link action carousel on join

Core loop:

1. User joins Telegram group.
2. User runs `/link`.
3. User completes one-time app auth link with Privy.
4. Bot marks user linked/qualified.
5. User executes `/buy`, `/sell`, `/bid` (or quick actions) via inline preview/confirm.
6. Bot posts outcomes and social proof events in Telegram.

## Command Contract (Expanded)

### Read and setup

- `/link` - start one-time Telegram + Privy + canonical CSW link
- `/unlink` - revoke link
- `/linked` - show linked/qualified status
- `/portfolio` - positions, PnL, quick inline sell buttons
- `/vaults` or `/list` - searchable allowed 4626 vaults with live prices
- `/auctions` - active CCA auctions with time left
- `/mybids` - personal bid status
- `/signals` - personal + group activity feed
- `/help` - command and inline shortcut menu

### Write actions (4626-only)

- `/buy <vault|ticker> <native-amount> --confirm`
- `/sell <vault|ticker> <native-amount> --confirm`
- `/bid <vault|auction> $<usd-amount> --confirm`

All write actions use inline callbacks with signed short-lived tokens.

## Amount Semantics and Confirmation UX

### Buy and sell

- User input: native amounts (`ETH` for buy, `SHARE` amount for sell).
- Preview includes USD estimate, position context, and gas estimate.
- Confirm button shows exact onchain amount.

Examples:

- `Confirm Buy 0.0500 ETH`
- `Confirm Sell 1200.00 SHARE`

### Bid

- User input: USD intent (`$250`).
- Execution unit: ETH only.
- Confirmation always shows exact ETH bid that will be sent onchain.

Example preview:

- Intent: `$250`
- Estimated bid: `0.0874 ETH`
- Confirm button: `Confirm Bid 0.0874 ETH`

Execution note:

- USD is intent and approximation only.
- Engine re-quotes at confirm/execute time.
- Hard safety breaker if quote health fails (stale feed or extreme anomaly, e.g. > 3% drift).

### Rich inline preview cards

- Current position size
- 24h change and depth hint
- Quick actions (`Confirm`, `Edit Amount`, `Cancel`, optional `Max`)

## Security and Authority Model (Tightened)

Write execution eligibility requires:

1. Linked Telegram identity
2. Mapped profile + Privy user
3. Canonical CSW resolved
4. Owner verification state healthy
5. Action in 4626 allowlist scope
6. Valid unexpired callback token for the same user/chat/action

Hard rules:

- No external token/address actions.
- No write execution from plain text without confirm token.
- No fallback non-canonical sender path.
- Private RPC plus Flashbots-style bundle path for all sends.
- Slippage tolerance per vault (default 0.5%).
- Per-user rate limits (10 actions/min global; bids capped at 3/min).
- Per-chat signal spam protection.

## Risks and Mitigations

- Telegram webhook downtime
  - Mitigation: fallback queue and replay-safe webhook handling
- Privy auth drift
  - Mitigation: owner/link re-verify on next write action
- Oracle staleness
  - Mitigation: hard breaker + retry UX
- Group spam/abuse
  - Mitigation: holder-gated topics + per-chat allowlists + rate limits
- Ownership transfer
  - Mitigation: canonical resolver re-check and forced re-link

## Architecture

### Components

- Telegram webhook handler (messages + callbacks)
- Link orchestration endpoints
- Preview/quote service (buy/sell/bid)
- Action confirmation executor
- Canonical wallet + owner validation layer
- Privy-backed signing/execution layer
- Audit and telemetry sink

### Existing modules reused

- `frontend/server/_lib/requestPrincipal.ts`
- `frontend/server/_lib/canonicalWalletResolver.ts`
- `frontend/server/_lib/canonicalCswDelegation.ts`
- `frontend/server/_lib/walletSync.ts`
- `frontend/api/_handlers/auth/_privy.ts`
- `frontend/api/_handlers/wallet/_prepare-add-privy-owner.ts`
- `frontend/api/_handlers/wallet/_confirm-owner.ts`

## Data Model (Updated)

### `telegram_user_links`

- `telegram_user_id` bigint unique
- `telegram_username` text nullable
- `profile_id` bigint not null
- `privy_user_id` text not null
- `canonical_csw_address` text not null
- `owner_verified` boolean not null default false
- `link_status` text not null (`active`, `revoked`, `pending_reverify`)
- `linked_at` timestamptz not null default now()
- `last_verified_at` timestamptz nullable
- `last_used_at` timestamptz nullable
- `revoked_at` timestamptz nullable
- `failure_count` integer not null default 0
- `last_failure_reason` text nullable
- `unlink_requested_at` timestamptz nullable

### `telegram_action_tokens`

- `token_hash` text primary key
- `telegram_user_id` bigint not null
- `chat_id` text not null
- `action_type` text not null (`buy`, `sell`, `bid`)
- `intent_payload_json` jsonb not null
- `expires_at` timestamptz not null
- `consumed_at` timestamptz nullable
- `created_at` timestamptz not null default now()

### `telegram_action_audit`

- `id` uuid primary key
- `telegram_user_id` bigint not null
- `chat_id` text not null
- `message_id` bigint nullable
- `profile_id` bigint not null
- `canonical_csw_address` text not null
- `action_type` text not null
- `intent_json` jsonb not null
- `quote_json` jsonb nullable
- `execution_json` jsonb nullable
- `status` text not null
- `tx_hash` text nullable
- `error_code` text nullable
- `error_message` text nullable
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `telegram_chat_vault_scope`

- `chat_id` text primary key
- `allowed_vault_ids` jsonb not null
- `buy_sell_enabled` boolean not null default true
- `bid_enabled` boolean not null default true

### Index recommendations

- `telegram_user_links`: `telegram_user_id`, `canonical_csw_address`, `(link_status, owner_verified)`
- `telegram_action_tokens`: `expires_at`, `(telegram_user_id, consumed_at)`
- `telegram_action_audit`: `(telegram_user_id, created_at)`, `created_at`

## API Contracts

### `POST /api/telegram/link/start`

Input:

- Telegram user/chat context from webhook

Output:

- one-time app link URL
- expiry timestamp

### `POST /api/telegram/link/complete`

Input:

- one-time link token

Behavior:

- verify token
- resolve authenticated Privy principal
- resolve profile and canonical CSW
- verify owner state
- upsert `telegram_user_links`

Output:

- linked status, canonical CSW, owner verification state

### `GET /api/telegram/link/status`

Output:

- linked/unlinked
- owner verification status
- canonical CSW summary

### `POST /api/telegram/unlink` (new)

Behavior:

- revoke active link
- mark link status as revoked
- preserve audit trail

### `GET /api/telegram/portfolio` (new)

Behavior:

- return user portfolio summary used by `/portfolio`
- include quick-sell metadata for inline buttons

### `POST /api/telegram/trade/preview`

Input:

- action type (`buy|sell|bid`)
- vault reference/ticker
- amount input

Output:

- scoped quote summary
- exact execution amount for confirm
- short-lived confirm token

### `POST /api/telegram/trade/confirm`

Input:

- confirm token

Behavior:

- validate and consume token
- re-quote
- enforce safety breakers
- execute sign/send
- persist audit

Output:

- final status, tx hash, executed amount summary

## Runtime Flow

### Link flow

1. `/link` command
2. bot issues one-time link token
3. user completes app auth
4. backend upserts mapping and canonical authority state
5. `/linked` returns ready state

### Buy and sell flow

1. parse command
2. resolve vault in 4626 allowlist
3. build quote preview
4. send inline confirm
5. consume confirm token
6. execute and report

### Bid flow

1. parse USD intent
2. resolve active CCA auction
3. compute ETH preview
4. inline confirm with exact ETH
5. re-quote and execute ETH bid
6. report bid tx hash and executed ETH

## Abuse Controls and Failure Handling (Enhanced)

- Callback token TTL: 90s
- One-time consume semantics
- User/chat binding on tokens
- Per-user and per-chat rate limits
- Structured reject reasons with retry-friendly UX
- Full audit rows for preview/confirm/send outcomes

## Rollout Plan (Accelerated)

### Phase A+

- Status: shipped
- link + unlink + status endpoints
- read-only commands (`/portfolio`, `/vaults`, `/auctions`, `/signals`)
- onboarding welcome flow
- audit plumbing

### Phase B

- Status: shipped
- `/buy` + `/sell` preview/confirm/execution
- rich inline preview cards
- strict 4626 scope enforcement

### Phase C

- Status: shipped
- `/bid` USD intent -> ETH execution
- richer signal posts, leaderboard, copy-trade actions
- Stars tips-first social layer (`XTR` invoice callbacks + pre-checkout + paid audit)

### Phase D

- Status: pending
- X parity as secondary surface
- further automation and ranking loops

## Verification Plan

- Unit tests:
  - token issuance/verification/consume
  - scope guard logic
  - quote formatting and ETH amount preview logic
- Integration tests:
  - link start/complete/status
  - preview/confirm lifecycle
  - rejection paths and safety breakers
- E2E tests:
  - Telegram `/link` -> app complete -> `/buy` success path
  - `/bid` with USD intent and ETH confirmation
  - unlinked user denied write action

## Appendix: Message Mockups

### 1) Buy preview inline keyboard

```text
VaultX Price: $1,234.56 (+4.2%)
You hold: 420 SHARES
Est. gas: 0.0008 ETH

Confirm Buy 0.0500 ETH (approx $61.73)
[ Confirm ] [ Edit Amount ] [ Cancel ] [ Max ]
```

### 2) Bid confirm

```text
CCA Auction #47 - ends in 2h 14m
Intent: $250 USD
Re-quoted: 0.0874 ETH

You will send exactly 0.0874 ETH
[ Confirm Bid 0.0874 ETH ] [ Cancel ]
```

### 3) Success signal post

```text
SUCCESS @user bought 0.0500 ETH of VaultX
Tx: 0xabc...123
New position: 420 SHARES
[ View on 4626 ] [ Copy Trade ]
```

### 4) Portfolio quick-sell

```text
Your Portfolio
VaultX: 420 SHARES ($518)
VaultY: 0.12 ETH ($148)

Quick Sell VaultX:
[ Sell 100 ] [ Sell 200 ] [ Sell All ]
```
