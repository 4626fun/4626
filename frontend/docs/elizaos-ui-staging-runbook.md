# elizaOS UI Staging Runbook (Keepr)

This runbook configures `Keepr-Staging` in elizaOS UI to mirror runtime behavior in:

- `frontend/server/agent/eliza/index.ts`
- `frontend/server/agent/eliza/character.ts`

Target environment for this runbook is app-domain first: `https://app.4626.fun/api`.

## 1) Create staging agent (no production edits)

1. Open elizaOS UI and create a new agent.
2. Set agent name to `Keepr-Staging`.
3. Add a clear staging label in description (for example, `staging mirror of Keepr production runtime`).
4. Confirm this is a new staging agent, not the production agent.

## 2) Load character config from source of truth

Use the copy-paste pack in `frontend/docs/elizaos-ui-staging-assets.md`:

- Character name
- Description
- System prompt
- Bio
- Topics
- Style
- Model preference

Important: paste the system prompt exactly as provided so behavior stays aligned with runtime expectations.

## 3) Import tools using OpenAPI

1. In elizaOS UI tools/actions, import OpenAPI from:
   - Primary: `https://app.4626.fun/api/v1/spec.json`
   - Fallback: `https://4626.fun/api/v1/spec.json`
2. If the import resolves a default server URL to `https://4626.fun/api`, override base URL to `https://app.4626.fun/api` for staging parity.
3. Save tool config before enabling endpoints.

## 4) Enable safe endpoint allowlist first

Enable only the read-safe, high-signal endpoints first:

- `/v1/vault/{address}/report`
- `/v1/vault/{address}/strategies`
- `/v1/auction/{address}/status`
- `/v1/lottery/global`
- `/v1/gauge/epoch`
- `/v1/agents/creators`
- `/v1/agents/feedback`
- `/v1/agents/wallet-intelligence`

Keep build/write endpoints disabled until eval suite passes.

## 5) Preserve command behavior contract

Ensure routing/instruction examples explicitly keep support for:

- `/keepr ...`, `/send ...`, `/ai ...`, `/coin ...`
- `/cre ...`
- `/lens ...`
- `/intel`, `/funder`, `/portfolio`, `/labels`
- `/reputation`, `/feedback`
- `/knowledge`, `/kb`

This aligns with command validation in plugin handlers under `frontend/server/agent/eliza/plugins`.

## 6) Apply memory and guardrail settings

Use settings from `frontend/docs/elizaos-ui-staging-assets.md`:

- Persistent memory enabled
- Thread-scoped memory keying
- 20-30 turn recency
- Summarized tool output storage
- Provider priority and failover
- Timeout/retry/backoff
- Circuit breaker
- Daily budget limits
- Per-conversation/sender rate limits

These map to runtime controls in:

- `frontend/server/agent/eliza/llm.ts`
- `frontend/server/agent/eliza/index.ts`
- `frontend/.env.example`

## 7) Run pre-promotion eval suite

Run the 10-case eval set from `frontend/docs/elizaos-ui-staging-assets.md` and require pass on:

- Command correctness
- Factuality and no financial guarantees
- Error handling for malformed input
- Safe non-command fallback behavior
- Correct default behavior for `/reputation` and `/feedback`

## 8) Promotion gate

Promote only when all are true:

1. Character/config parity is confirmed.
2. Safe endpoint allowlist is stable under eval.
3. Guardrail thresholds are active and tested.
4. CSW canonical wallet invariants are preserved.
5. Operators sign off after staged test transcripts review.

## 9) Canonical wallet invariant requirements

Do not ship any UI config that violates these invariants:

- Canonical CSW remains the primary identity/account.
- No hidden migration to Privy wallet as canonical identity.
- Privy wallet remains delegated signer only.

Reference policy sources:

- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`
- `.cursor/rules/csw-agent-lifecycle.mdc`

