# 4626 Eliza Runtime

This is the active Eliza integration for 4626.

If you only remember one thing: **ElizaOS is not the app, wallet, or protocol layer here. It is the agent orchestration layer that sits between inbound chat messages and the existing 4626 server actions.**

## What is actually live

- Active runtime: `frontend/server/agent/eliza/index.ts`
- Active transport: `frontend/server/agent/eliza/plugins/xmtp/service.ts`
- Active memory/action bridge: `frontend/server/agent/eliza/runtimeBridge.ts`
- Active LLM fallback: `frontend/server/agent/eliza/llm.ts`
- Active plugin surface: `frontend/server/agent/eliza/plugins/*`

The package script `pnpm -C frontend agent:start` launches the active runtime in this folder.

## Where ElizaOS comes into play

In this repo, ElizaOS provides the agent-shaped abstraction layer:

- `Plugin`: command families and context providers
- `Action`: executable behaviors like `/keepr`, `/cre`, `/coin`, `/intel`
- `Provider`: context injection for vault state, docs, channel metadata
- `Memory` and `State`: message history, summaries, semantic recall, continuity
- action ranking and selection before LLM fallback

What ElizaOS does **not** own here:

- Privy auth and delegated signing
- Coinbase Smart Wallet identity
- the Vercel API router
- the ERC-4626 contracts and vault logic
- the Telegram/XMTP frontend clients themselves

Those systems already exist. Eliza sits on top and decides how the agent should react.

## End-to-end message flow

1. A message comes in from XMTP.
2. `plugins/xmtp/service.ts` turns it into a normalized runtime message.
3. `index.ts` rate-limits, validates, and stores it as runtime memory.
4. `runtimeBridge.ts` composes state and ranks Eliza actions.
5. A plugin action handles it if there is a match.
6. Most plugin actions delegate into existing 4626 production code.
7. If no action claims it, `llm.ts` generates a fallback conversational reply.
8. The reply is stored back into runtime memory and sent out over XMTP.

That means ElizaOS here is the **decision and memory layer**, not the low-level wallet or protocol implementation.

## Plugin map

- `plugins/keepr`: delegates to `server/keepr/commands.ts`
- `plugins/cre`: keeper observation and trigger commands
- `plugins/zora`: coin flows
- `plugins/uniswap`: swap skill routing
- `plugins/walletIntel`: `/intel`, `/funder`, `/portfolio`, `/labels`
- `plugins/reputation`: ERC-8004 reputation and feedback
- `plugins/knowledge`: local doc retrieval
- `plugins/lens`: Lens actions and lookups
- `plugins/telegram`, `plugins/discord`, `plugins/twitter`: optional channel context plugins

The important pattern is that the Eliza plugin layer mostly **adapts existing 4626 server capabilities** into an agent runtime instead of inventing a separate backend.

## Startup modes

The runtime supports three real execution modes plus one safe inspection mode.
Production-primary operation is intended to stay on Railway.
This repo assumes one Railway primary, not a primary/standby deployment pair.

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

- `XMTP_AGENT_CSW_ADDRESS`
- `XMTP_AGENT_PRIVY_WALLET_ID`
- Privy server credentials
- `XMTP_DB_ENCRYPTION_KEY`
- one LLM provider key

Run this on Railway for real traffic.

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

- `DATABASE_URL` or `POSTGRES_URL`
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
