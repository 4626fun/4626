# 4626 Eliza Runtime

This is the active Eliza integration for 4626.

If you only remember one thing: **ElizaOS is not the app, wallet, or protocol layer here. It is the agent orchestration layer that sits between inbound chat messages and the existing 4626 server actions.**

## What is actually live

- Active runtime: `frontend/server/agents/eliza/index.ts`
- Active transport: `frontend/server/agents/eliza/plugins/xmtp/service.ts`
- Active memory/action bridge: `frontend/server/agents/eliza/runtimeBridge.ts`
- Active LLM fallback: `frontend/server/agents/eliza/llm.ts`
- Active plugin surface: `frontend/server/agents/eliza/plugins/*`

The package script `pnpm -C frontend agent:start` launches the active runtime in this folder.

Important boundary:

- This Railway runtime is for XMTP.
- Telegram bot updates are handled by the webhook runtime under `frontend/api/_handlers/telegram/`.
- Telegram Mini App auth/linking is separate from the long-lived XMTP agent process.

## Where ElizaOS comes into play

In this repo, ElizaOS provides the agent-shaped abstraction layer:

- `Plugin`: command families and context providers
- `Action`: executable behaviors like `/keepr`, `/coin`, `/intel`
- `Provider`: context injection for vault state, docs, channel metadata
- `Memory` and `State`: message history, summaries, semantic recall, continuity
- action ranking and selection before LLM fallback

What ElizaOS does **not** own here:

- Privy auth and delegated signing
- Coinbase Smart Wallet identity
- the Vercel API router
- the ERC-4626 contracts and vault logic
- Telegram webhook + Mini App transport handling
- the Telegram/XMTP frontend clients themselves

Those systems already exist. Eliza sits on top and decides how the agent should react.

## End-to-end runtime flow

XMTP path:

1. A message comes in from XMTP.
2. `plugins/xmtp/service.ts` turns it into a normalized runtime message.
3. `index.ts` rate-limits, validates, and stores it as runtime memory.
4. `runtimeBridge.ts` composes state and ranks Eliza actions.
5. Deterministic commands are delegated through production handlers.
6. If no action claims the message, XMTP fallback goes through `server/agents/core/processXmtpAgentInput.ts` and `server/agents/eliza/_xmtpFallback.ts`.
7. The fallback uses the active runtime context, so memory and continuity stay on the live Eliza runtime.
8. The reply is stored back into runtime memory and sent out over XMTP.

Telegram path:

1. Telegram Bot API updates hit the webhook runtime under `frontend/api/_handlers/telegram/`.
2. Native Telegram UI flows stay in that adapter layer.
3. Non-native command handling delegates through `server/agents/core/processTelegramAgentInput.ts`.
4. Telegram may reuse shared command/conversation helpers, but it is still a separate transport runtime from XMTP.

That means ElizaOS here is the **decision and memory layer**, not the low-level wallet or protocol implementation.

## Plugin map

- `plugins/keepr`: delegates to the shared deterministic executor in `server/agents/core/executeDeterministicCommand.ts`
- `plugins/keeperOps`: keeper observation and trigger commands
- `plugins/zora`: coin flows
- `plugins/uniswap`: swap skill routing
- `plugins/walletIntel`: `/intel`, `/funder`, `/portfolio`, `/labels`
- `plugins/reputation`: ERC-8004 reputation and feedback
- `plugins/knowledge`: local doc retrieval
- `plugins/lens`: Lens actions and lookups
- `plugins/telegram`, `plugins/discord`, `plugins/twitter`: optional channel context plugins

The important pattern is that the Eliza plugin layer mostly **adapts existing 4626 server capabilities** into an agent runtime instead of inventing a separate backend.

## Shared agent core

Shared command/conversation seams now live in:

- `server/agents/core/executeDeterministicCommand.ts`
- `server/agents/core/executeConversationalFallback.ts`
- `server/agents/core/processXmtpAgentInput.ts`
- `server/agents/core/processTelegramAgentInput.ts`
- `server/agents/core/resolveIdentityContext.ts`
- `server/agents/core/resolveVaultRole.ts`

These are shared building blocks, not evidence that Telegram ingress runs through the Railway XMTP runtime.

## Startup modes

The runtime supports three real execution modes plus one safe inspection mode.
Production-primary operation is intended to stay on Railway.
This repo assumes one Railway primary, not a primary/standby deployment pair.

### Railway Primary Keepr Agent — Required Environment Variables (Minimal Checklist)

The agent will hard-fail early (`process.exit(1)`) on Railway if these are not correct. This is by design.

**Must be set for Railway primary:**

- `AGENT_RUNTIME_ROLE=primary` (or leave unset — default is primary)
- `AGENT_CONSUME_XMTP=true` (or leave unset when role is primary)
- Database:
  - `DATABASE_URL` (Supabase strongly preferred) or `POSTGRES_URL` (legacy/generic fallback)
- For multi-agent mode (most production setups):
  - `XMTP_AGENT_KEY_ENCRYPTION_KEY` (32-byte hex)
- Persistent storage (critical on Railway):
  - `XMTP_DB_DIRECTORY` must point to a **mounted Railway volume** (not `/tmp`)
  - `XMTP_REQUIRE_PERSISTENT_DB=true` (default on for primary)
- If using Coinbase Smart Wallet for the agent identity (recommended):
  - `CANONICAL_CSW_ADDRESS`
  - `CANONICAL_CSW_PRIVY_WALLET_ID` (the Privy server wallet that signs for it)
  - Full Privy server auth: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_AUTHORIZATION_KEY`, `PRIVY_WALLET_OWNER_ID`

**Strongly recommended on Railway primary:**
- `AGENT_RUNTIME_LOCK_REQUIRED=true` (default when Postgres + primary on Railway)

If any of the above are missing or wrong, you will see the new early `[eliza][early]` logs + the detailed validation errors before the process exits.

See `validateStartupEnv()` in `index.ts` for the full current list of hard errors.

### Quick Diagnostic Command

Run this locally with the environment variables you plan to use on Railway:

```bash
pnpm agent:railway-keepr-doctor
```

It will print a clear pass/fail checklist of the most common things that cause the primary to hard-crash on Railway.

This is the fastest way to catch the exact missing or wrong variable before deploying.

On Railway itself you will also see very early `[eliza][early]` diagnostics printed during module evaluation. It now prints a clean table with the status of every critical requirement (role, consume flag, DB, encryption key, volume mount, CSW+Privy, etc.) plus a summary of any problems found. This appears before most other code and before the normal health server.

A standalone copy-paste friendly checklist is also available at `docs/railway-keepr-primary-checklist.md`. Paste it into your Railway service description or team runbook.

The super-early health listener (before most imports) will also return a small JSON payload on `/healthz` with a hint to check the logs for the early table. Once the full health server starts, detailed requests (with the health token) will include `earlyDiagnostics` in the response.

### 1. Safe local inspection

Use this when you want to understand the runtime without connecting to XMTP:

```bash
cd frontend
AGENT_RUNTIME_ROLE=standby AGENT_CONSUME_XMTP=false pnpm agent:eliza:doctor
AGENT_RUNTIME_ROLE=standby AGENT_CONSUME_XMTP=false pnpm agent:eliza:standby:smoke
```

This boots the runtime shape, health checks, and env validation without becoming a live consumer.
Production-primary boot is blocked off Railway by default unless you explicitly set `ELIZA_ALLOW_OFF_RAILWAY_PRIMARY=true`.
Treat this as a local diagnostic mode, not a second deployment target.

### 2. Single-agent CSW mode

This is the production-shaped single-agent path.
This is the normal Railway deployment path for this repo.

Required env:

- `CANONICAL_CSW_ADDRESS`
- `CANONICAL_CSW_PRIVY_WALLET_ID` (legacy: `XMTP_AGENT_PRIVY_WALLET_ID`)
- Privy server credentials
- `XMTP_DB_ENCRYPTION_KEY`
- one LLM provider key

Run this on Railway for real traffic.

On Railway, startup now fails fast if:

- `AGENT_RUNTIME_ROLE!=primary`
- `AGENT_CONSUME_XMTP=false`

On Railway primary with Postgres configured, the DB-backed runtime lease lock defaults on and is expected to stay enabled.

What it proves:

- the agent presents as the canonical Coinbase Smart Wallet on XMTP
- Privy acts as delegated signer
- Eliza routes messages to 4626 actions and LLM fallback

### 3. Single-agent EOA mode

This is the smallest true end-to-end dev path, but it is explicitly dev-only.

Required env:

- `XMTP_AGENT_PRIVATE_KEY`
- `XMTP_DB_ENCRYPTION_KEY`
- one LLM provider key

Use this only for explicit non-production or supervised overrides.

### 4. Multi-agent orchestrator mode

This is the full server orchestrator.

Required env:

- `DATABASE_URL` (Supabase) or `POSTGRES_URL` (legacy fallback)
- `XMTP_AGENT_KEY_ENCRYPTION_KEY`
- `XMTP_DB_ENCRYPTION_KEY`
- one LLM provider key

Deploy this on Railway for real traffic. Use local standby or non-production envs for inspection.

What it does:

- loads creator agents from Postgres
- decrypts agent signer material
- starts one XMTP runtime per configured creator agent
- shares the same Eliza plugin and memory pipeline

## Health and local verification

Once running, the runtime exposes:

- `GET /healthz`
- `GET /readyz`

Default port is `8080`.

Example:

```bash
curl http://localhost:8080/readyz
```

## Practical mental model

For 4626, think about the stack this way:

- Privy + CSW: identity and signing
- XMTP: transport
- Telegram webhook + Mini App: separate bot and account-linking transport
- existing server modules: real business logic
- ElizaOS: memory, routing, action selection, and conversational glue

If you removed ElizaOS, the underlying 4626 app and APIs would still exist. You would mainly lose the agent runtime that turns those capabilities into a persistent chat operator.

## Quick inspection command

Use the doctor script added for this repo:

```bash
pnpm -C frontend agent:eliza:doctor
```

It tells you:

- which runtime is active
- which startup mode your current env resolves to
- what is missing
- which channels and LLM providers are enabled
- what to run next
