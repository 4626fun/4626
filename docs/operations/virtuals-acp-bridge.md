# Virtuals ACP v2 bridge (ElizaOS-driven)

Connects the 4626 Eliza stack to a **Virtuals Protocol ACP agent**
(app.virtuals.io) using `@virtuals-protocol/acp-node-v2` — the event-driven v2
SDK. The bridge listens for ACP job-room entries and lets the Eliza LLM service
decide which `JobSession` tool to execute (respond, negotiate, deliver,
complete/reject), with hard spend guardrails.

This is **not** the Arena lane. The degen.virtuals.io trading agent (`/arena`)
keeps its existing dgclaw-skill + acp-cli path under
`frontend/server/_lib/arena/`. The two share nothing except the Virtuals
brand.

## Architecture

| Piece | Path | Role |
| --- | --- | --- |
| Config | `frontend/server/agents/eliza/plugins/virtuals/config.ts` | Env reader + validation (`readVirtualsAcpConfig`, `checkVirtualsAcpConfig`) |
| Tool loop helpers | `frontend/server/agents/eliza/plugins/virtuals/toolLoop.ts` | Pure functions: tool policy filter, spend clamping, system prompt build, LLM JSON decision parsing |
| Service | `frontend/server/agents/eliza/plugins/virtuals/service.ts` | `VirtualsAcpService` singleton — `AcpAgent` lifecycle, `entry` handler, LLM decision execution |
| Eliza plugin | `frontend/server/agents/eliza/plugins/virtuals/index.ts` | Chat commands `/virtuals status`, `/virtuals browse <keyword>` |
| Standalone runner | `frontend/server/agents/eliza/plugins/virtuals/runner.ts` | `pnpm -C frontend agent:virtuals` — runs the bridge as its own process |

The LLM lane reuses the existing `ElizaLlmService` (`server/agents/eliza/llm.ts`)
with its provider fallback, retry, and budget machinery. Since that service has
no native tool calling, the bridge presents `JobSession.availableTools()` in
the system prompt and parses a strict one-line JSON decision
(`{"tool": "...", "args": {...}}` or `{"tool": null, "reason": "..."}`) from
the completion. Unparseable or unknown-tool responses are logged and skipped —
never guessed.

## Safety model

- **Disabled by default.** Everything is behind `VIRTUALS_ACP_ENABLED=1`.
- **Fail-open loading.** Both the plugin and the in-process service boot use
  dynamic `import()` with catch-and-warn, so a broken SDK dependency can never
  block the Railway Keepr primary (same pattern as the AlfaClub plugin).
- **Spend clamping.** `setBudget` / `fund` USDC amounts are clamped to
  `VIRTUALS_ACP_MAX_BUDGET_USDC` (default 5). The clamp happens after the LLM
  decision, in code — the model cannot exceed it.
- **Fund opt-in.** The `fund` tool is filtered out of the prompt entirely
  unless `VIRTUALS_ACP_AUTO_FUND=1`.
- **Observe-only mode.** `VIRTUALS_ACP_AUTO_LLM=0` keeps the connection live
  and logs every entry but never executes tools — useful for the first days of
  a new agent.

## Setup

1. Create/locate your ACP agent on [app.virtuals.io](https://app.virtuals.io)
   and grab from the agent's wallet/session page:
   - agent wallet address → `VIRTUALS_ACP_WALLET_ADDRESS`
   - Privy wallet id → `VIRTUALS_ACP_WALLET_ID`
   - session signer private key → `VIRTUALS_ACP_SIGNER_PRIVATE_KEY`
2. Make sure at least one Eliza LLM provider key is set (`GROQ_API_KEY`,
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY`).
3. Set the `VIRTUALS_ACP_*` block in `.env` (see `frontend/.env.example`).
4. Start it:
   - **Standalone (recommended):** `pnpm -C frontend agent:virtuals`.
     Optional `VIRTUALS_ACP_HEALTH_PORT` exposes `/healthz` + `/readyz` for
     hosted deploys.
   - **In-process with Eliza:** set `VIRTUALS_ACP_ENABLED=1` on the Eliza
     runtime — the service boots after `runtime_ready` and the
     `/virtuals` chat commands become available. Keep this off on the Railway
     Keepr primary unless product explicitly wants the ACP loop co-resident.

## Operating

- `/virtuals status` (XMTP chat) — running state, agent wallet, active job
  sessions, entries-handled / tools-executed counters, last error.
- `/virtuals browse <keyword>` — search the ACP agent registry.
- Standalone runner logs a heartbeat every 5 minutes with session counts.

## Rollout recommendation

Start with `VIRTUALS_ACP_AUTO_LLM=0` (observe-only) and watch the logged
entries for a day. Then enable `VIRTUALS_ACP_AUTO_LLM=1` with
`VIRTUALS_ACP_AUTO_FUND=0` and a small `VIRTUALS_ACP_MAX_BUDGET_USDC`. Only
enable auto-fund once you trust the job mix the agent receives.
