# Virtuals ACP v2 bridge (ElizaOS-driven)

Connects the 4626 Eliza stack to a **Virtuals Protocol ACP agent**
(app.virtuals.io) using `@virtuals-protocol/acp-node-v2` — the event-driven v2
SDK. The bridge listens for ACP job-room entries and lets the Eliza LLM service
propose a `JobSession` tool action. Deterministic policy, quotas, payment gates,
and typed capabilities decide whether any proposal may execute.

This is **not** the Arena lane. The degen.virtuals.io trading agent (`/arena`)
keeps its existing dgclaw-skill + acp-cli path under
`frontend/server/_lib/arena/`. The two share nothing except the Virtuals
brand.

## Architecture

| Piece | Path | Role |
| --- | --- | --- |
| Config | `frontend/server/agents/eliza/plugins/virtuals/config.ts` | Env reader + validation (`readVirtualsAcpConfig`, `checkVirtualsAcpConfig`) |
| Tool loop helpers | `frontend/server/agents/eliza/plugins/virtuals/toolLoop.ts` | Pure functions: typed execution policy, strict spend validation/capping, system prompt build, LLM JSON decision parsing |
| Service | `frontend/server/agents/eliza/plugins/virtuals/service.ts` | `VirtualsAcpService` singleton — `AcpAgent` lifecycle, `entry` handler, LLM decision execution |
| Eliza plugin | `frontend/server/agents/eliza/plugins/virtuals/index.ts` | Chat commands `/virtuals status`, `/virtuals browse <keyword>` |
| Standalone runner | `frontend/server/agents/eliza/plugins/virtuals/runner.ts` | `pnpm -C frontend agent:virtuals` — runs the bridge as its own process |
| Preflight doctor | `frontend/scripts/agent/virtuals-acp-doctor.ts` | `pnpm -C frontend agent:virtuals:preflight` — validates ACP env + Virtuals compute |
| Compute ping | `frontend/server/agents/eliza/plugins/virtuals/computePing.ts` | `pnpm -C frontend virtuals:compute-ping` — one-shot inference credit check |

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
- **Observe-only by default.** `VIRTUALS_ACP_AUTO_LLM` defaults to `0`; the
  connection stays live and logs entries without requesting or executing LLM
  tool decisions.
- **High-risk proposal boundary.** `setBudget`, `fund`, `submit`, `complete`,
  and `reject` are proposal-only unless their exact typed name appears in
  `VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS`. Prompt text never grants authority.
  Proposal-only decisions are sent to the counterparty with
  `JobSession.sendMessage(..., "proposal")` as versioned structured JSON; that
  outbound message consumes the same quota as any other dispatch.
  `VIRTUALS_ACP_AUTO_FUND` is retained only as a legacy prompt flag and grants
  no execution authority.
- **Default-deny tool boundary.** Only SDK `wait` and `sendMessage` are
  low-risk by default. Known mutating tools require the typed allowlist;
  unknown/future tools are denied. Before `executeTool`, arguments must match
  the names, required fields, and runtime types in the current
  `availableTools()` definition.
- **Strict spend validation.** `setBudget` / `fund` require a finite positive
  numeric `amount`; invalid, missing, string, zero, or negative amounts are
  blocked rather than dispatched. Valid amounts are capped at
  `VIRTUALS_ACP_MAX_BUDGET_USDC` (default `5`).
- **Bounded execution.** Service-run defaults allow at most `100` tool
  executions globally and `10` per chain/job. Configuration is hard-bounded
  to `1000` globally and `100` per job. Quota is consumed immediately before
  dispatch and is never restored after a thrown dispatch because a remote side
  effect may already have occurred. Per-job counters are evicted at terminal
  events without mutating SDK session state.
- **Paid-only backtests.** Backtests require the SDK `JobSession` and loaded
  `AcpJob` to both be funded plus a finite positive
  `session.job.budget.amount`; there is no config bypass. Proposed budgets,
  zero amounts, unloaded jobs, and unknown states fail closed.
- **Wait semantics.** `wait` is a local no-action decision only when the SDK
  currently lists it. It does not call `executeTool` or consume dispatch quota;
  the prompt never offers `wait` when the current role/status omits it.

## Setup

1. Create/locate your ACP agent on [app.virtuals.io](https://app.virtuals.io)
   and grab from the agent's wallet/session page:
   - agent wallet address → `VIRTUALS_ACP_WALLET_ADDRESS`
   - Privy wallet id → `VIRTUALS_ACP_WALLET_ID`
   - session signer private key → `VIRTUALS_ACP_SIGNER_PRIVATE_KEY`
2. For Virtuals compute credits, set `VIRTUALS_API_KEY` from the agent's
   **Compute** tab on [app.virtuals.io](https://app.virtuals.io). Optionally
   add a fallback provider (`GROQ_API_KEY`, `OPENAI_API_KEY`, etc.).
3. Set the `VIRTUALS_ACP_*` block in `.env` (see `frontend/.env.example`).
4. For revenue-first credit usage, keep:
   - `ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY=VirtualsCompute,Groq,OpenAI,Anthropic,OpenRouter`
     (default) so `agentKey=virtuals-acp` spends Virtuals credits first.
5. Preflight before starting:
   ```bash
   pnpm -C frontend agent:virtuals:preflight
   pnpm -C frontend virtuals:compute-ping   # optional one-shot API check
   ```
6. Start it:
   - **Standalone (recommended):** `pnpm -C frontend agent:virtuals`.
     Optional `VIRTUALS_ACP_HEALTH_PORT` exposes `/healthz` + `/readyz` for
     hosted deploys.
   - **In-process with Eliza:** set `VIRTUALS_ACP_ENABLED=1` on the Eliza
     runtime — the service boots after `runtime_ready` and the
     `/virtuals` chat commands become available. Keep this off on the Railway
     Keepr primary unless product explicitly wants the ACP loop co-resident.

## Railway deploy (dedicated service)

Run the ACP bridge on a **separate Railway service** from the XMTP Keepr
primary. Use `frontend/Dockerfile.agent` with:

| Variable | Value |
| --- | --- |
| `AGENT_PROCESS` | `virtuals` |
| `VIRTUALS_ACP_ENABLED` | `1` |
| `VIRTUALS_ACP_AUTO_LLM` | `0` for first rollout, then `1` |
| `VIRTUALS_ACP_AUTO_FUND` | `0` |
| `VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS` | empty (proposal-only) |
| `VIRTUALS_ACP_GLOBAL_TOOL_EXECUTION_QUOTA` | `100` |
| `VIRTUALS_ACP_PER_JOB_TOOL_EXECUTION_QUOTA` | `10` |
| `VIRTUALS_ACP_HEALTH_PORT` | `8080` (optional probe) |
| `ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY` | `VirtualsCompute,Groq,OpenAI,Anthropic,OpenRouter` |

Store these as **runtime secrets** (not committed env files):

- `VIRTUALS_API_KEY`
- `VIRTUALS_ACP_WALLET_ADDRESS`
- `VIRTUALS_ACP_WALLET_ID`
- `VIRTUALS_ACP_SIGNER_PRIVATE_KEY`

After deploy, run preflight from a shell with the same secrets. The doctor
reports credential presence/validity only; it never prints credential bytes,
addresses, wallet-id fragments, or API-key fragments. The runner pings
Virtuals compute on boot only when `VIRTUALS_API_KEY` is set and `AUTO_LLM=1`.

## Operating

- `/virtuals status` (XMTP chat) — running state, agent wallet, active job
  sessions, entries-handled / tools-executed counters, last error.
- `/virtuals browse <keyword>` — search the ACP agent registry.
- Standalone runner logs a heartbeat every 5 minutes with session counts.
- Public `/healthz` and `/readyz` responses contain only `{"ok": boolean}`;
  `/healthz` is process liveness, while `/readyz` requires the service and SDK
  transport connection callback to be ready. Sessions, job IDs, counters, and
  errors remain in private logs/status output; private status lists only a
  bounded set of non-terminal sessions.
- The dedicated Docker process runs as the unprivileged `node` user.

## Rollout recommendation

Start with `VIRTUALS_ACP_AUTO_LLM=0` (observe-only) and watch the logged
entries for a day. Then enable `VIRTUALS_ACP_AUTO_LLM=1` with
an empty `VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS` list. Add one exact
capability at a time only after review; enabling `AUTO_LLM` or prompt language
does not authorize high-risk execution.

## Revenue-first credit policy

When your primary objective is ACP job throughput/revenue (not trade gating),
prefer this operating policy:

1. **Phase A (observe, 2-3 days)**
   - `VIRTUALS_ACP_AUTO_LLM=0`
   - `VIRTUALS_ACP_AUTO_FUND=0`
   - Validate incoming job mix before allowing tool execution.
2. **Phase B (constrained execute, 3-5 days)**
   - `VIRTUALS_ACP_AUTO_LLM=1`
   - `VIRTUALS_ACP_AUTO_FUND=0`
   - `VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS=` (empty)
   - Keep conservative `VIRTUALS_ACP_MAX_BUDGET_USDC`.
3. **Phase C (scale)**
   - Increase quality/throughput only if completion and net economics improve.
   - Add only reviewed typed capabilities, with `fund` requiring explicit
     inclusion plus the spend cap and quotas.

Keep counter-trade LLM gating separate unless explicitly changing objectives.

Suggested budget guardrails for `$200/week` credits:

- Theoretical daily ceiling: about `$28.57/day`.
- Start at 70-80% utilization budget (about `$20-$23/day`) to avoid end-of-week
  starvation during bursty job windows.
- If this runner is dedicated to ACP jobs, set `ELIZA_DAILY_LLM_USD_BUDGET`
  accordingly and scale up only after quality gates hold.

## Monitoring and stop/go gates

Track these metrics daily/weekly:

- job completion count and completion rate
- average time-to-first-response
- unparseable-decision rate
- tools executed vs decisions attempted
- net USDC/job (after funding + inference spend)

`/virtuals status` now surfaces LLM execution telemetry:
- `attempted`, `executed`, `wait`, `unparseable`, and average decision latency.

Pause/retune if unparseable decisions or timeout behavior rises, or if net
USDC/job degrades week-over-week.
