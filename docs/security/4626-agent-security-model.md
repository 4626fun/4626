# 4626 Agent Security Model

## Purpose

4626 treats LLMs, bots, and automation workers as **untrusted planners**.  
Natural-language intent is never a write authority by itself.

This model introduces a repo-native control plane with deterministic policy checks, structured confirmation, narrow execution, and auditable outcomes.

## Security Goals

- Enforce a shared capability firewall for sensitive actions.
- Require proposal -> confirmation -> policy -> execution -> audit for user-triggered writes.
- Split keeper automation into trust zones without breaking existing `KEEPR_API_KEY` flows.
- Redact outbound AI payloads by default.
- Preserve existing CSW/Privy authority boundaries and Telegram token replay protections.

## Control Plane Components

### 1) Capability and proposal schemas

Defined in `frontend/server/_lib/agentControl/types.ts`.

- `ControlCapability` includes:
  - `capability_id`, `actor_type`, `actor_id`, `subsystem`, `action`
  - `scope`, `limits`, `confirmation_class`
  - `issued_at`, `expires_at`, `issued_by`, `metadata`
- `ActionProposal` includes:
  - `proposal_id`, `capability_id`, `subsystem`, `action`
  - `intent`, `bounds`, `rationale`, `correlation_id`, `created_at`

### 2) Deterministic policy engine

Defined in `frontend/server/_lib/agentControl/policy.ts`.

`evaluatePolicy()` and `assertPolicy()` enforce deny-by-default checks:

- capability/proposal presence and binding
- actor binding and action/subsystem parity
- scope bounds
- confirmation class satisfaction
- TTL validity
- replay guard hooks

Explicit deny codes include:

- `actor_mismatch`
- `scope_mismatch`
- `action_mismatch`
- `confirmation_missing`
- `capability_expired`
- `proposal_expired`
- `replay_detected`
- others in `PolicyDenyCode`

### 3) Audit event schema and emitter

Defined in `frontend/server/_lib/agentControl/audit.ts`.

Audit table:

- `agent_control_audit_events`

Event types:

- `proposal.created`
- `proposal.denied`
- `confirmation.accepted`
- `confirmation.rejected`
- `policy.denied`
- `execution.started`
- `execution.succeeded`
- `execution.failed`

Existing Telegram audit (`telegram_action_audit`) remains intact and is not replaced.

### 4) User-facing integration (Telegram trade confirmations)

Integrated in `frontend/api/_handlers/telegram/_webhook.runtime.ts` (`handleTelegramTradeCallback`).

Flow:

1. consume one-time Telegram action token
2. construct capability + proposal
3. append proposal/confirmation audit events
4. run `evaluatePolicy()`
5. if allowed, execute existing deterministic command or bid userOp path
6. append execution success/failure event

This keeps existing command execution codepaths while introducing deterministic control-plane gates.

### 5) Keeper trust zones

Resolver in `frontend/server/_lib/agentControl/trustZones.ts`:

- `financial_execution`
- `market_maintenance`
- `queue_messaging_monitoring`

Enforcement:

- baseline auth: `KEEPR_API_KEY`
- optional zone auth: `x-keepr-zone-key` checked against zone-specific env vars

Enabled in:

- `frontend/api/_handlers/keepr/actions/_enqueue.ts`
- `frontend/api/_handlers/keepr/actions/_execute.ts`
- `frontend/api/_handlers/keepr/actions/_pending.ts` (when zone query is requested)
- `frontend/api/_handlers/keepr/actions/_updateStatus.ts`

CRE worker (`cre/actions/keepr-queue-executor.action.ts`) now sends zone headers for execute/status calls.

### 6) Outbound AI redaction middleware

Defined in `frontend/server/_lib/agentControl/redaction.ts`.

Wired into:

- `frontend/server/agent/eliza/llm.ts`
- `frontend/server/agent/eliza/embeddings.ts`
- `frontend/server/_lib/openaiImage.ts`
- `frontend/api/_handlers/cre/keeper/_aiAssess.ts`

Default behavior:

- strips secret-like fields (`privateKey`, `signature`, `secret`, `webhook`, incident traces)
- pseudonymizes selected identity fields
- masks addresses when enabled
- truncates/minimizes long payloads

## Trust Boundaries

- **Canonical CSW remains root account authority.**
- No private key extraction or ownership model changes were introduced.
- Existing replay and one-time token controls in Telegram flow remain active.
- Keeper zone keys only narrow authority; they do not widen permissions.

## Expected Failure Behavior

- Policy denials return safe user-facing failures and emit `policy.denied`.
- Missing/invalid zone key returns `401` when that zone key is configured.
- Redaction never blocks local execution paths; it only sanitizes remote-AI payloads.

## Test Coverage Added

- `frontend/server/_lib/agentControl/__tests__/policy.test.ts`
- `frontend/server/_lib/agentControl/__tests__/redaction.test.ts`
- trust-zone auth assertions in:
  - `frontend/api/__tests__/keeprActionsEnqueue.test.ts`
  - `frontend/api/__tests__/keeprActionsExecute.test.ts`
- zone header assertions in:
  - `cre/tests/keepr-queue-executor.test.ts`
