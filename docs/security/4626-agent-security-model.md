---
title: 4626 Agent Security Model
sidebar_position: 1
---

# 4626 Agent Security Model

This document is the maintainer-facing source of truth for the 4626 secure-agent rollout. It freezes the repo-verified control-plane shape, names the hardened pilot flow, documents trust-zone boundaries and remote-AI egress policy, and calls out the remaining gaps that are still intentionally deferred.

## Scope

This rollout does not introduce a separate secure-agent service. The control plane stays repo-native and is built around the existing `agentControl` layer in:

- [`frontend/server/_lib/agentControl/types.ts`](../../frontend/server/_lib/agentControl/types.ts)
- [`frontend/server/_lib/agentControl/policy.ts`](../../frontend/server/_lib/agentControl/policy.ts)
- [`frontend/server/_lib/agentControl/audit.ts`](../../frontend/server/_lib/agentControl/audit.ts)
- [`frontend/server/_lib/agentControl/trustZones.ts`](../../frontend/server/_lib/agentControl/trustZones.ts)
- [`frontend/server/_lib/agentControl/redaction.ts`](../../frontend/server/_lib/agentControl/redaction.ts)
- [`frontend/server/_lib/agentControl/replay.ts`](../../frontend/server/_lib/agentControl/replay.ts)
- [`frontend/server/_lib/agentControl/remoteAi.ts`](../../frontend/server/_lib/agentControl/remoteAi.ts)
- [`frontend/server/_lib/agentControl/telegramTradeControl.ts`](../../frontend/server/_lib/agentControl/telegramTradeControl.ts)

## Repo-Verified Map

### User-facing approval surfaces

- Telegram Mini App linking and session issuance:
  - [`frontend/api/_handlers/telegram/_miniapp-session.ts`](../../frontend/api/_handlers/telegram/_miniapp-session.ts)
  - [`frontend/api/_handlers/telegram/_link-ready.ts`](../../frontend/api/_handlers/telegram/_link-ready.ts)
  - [`frontend/api/_handlers/telegram/_link-complete.ts`](../../frontend/api/_handlers/telegram/_link-complete.ts)
  - [`frontend/server/_lib/telegramTrading.ts`](../../frontend/server/_lib/telegramTrading.ts)
- Telegram callback trade and deploy flows:
  - [`frontend/api/_handlers/telegram/_webhook.runtime.ts`](../../frontend/api/_handlers/telegram/_webhook.runtime.ts)
  - [`frontend/api/_handlers/telegram/webhook`](../../frontend/api/_handlers/telegram/webhook)
- Workspace approval surfaces:
  - [`frontend/api/_handlers/v1/workspace/_actions.ts`](../../frontend/api/_handlers/v1/workspace/_actions.ts)
  - [`frontend/server/_lib/workspace/repository.ts`](../../frontend/server/_lib/workspace/repository.ts)

### Replay, TTL, and audit storage

- Telegram callback tokens, replay nonces, and legacy action audit:
  - [`frontend/server/_lib/telegramTrading.ts`](../../frontend/server/_lib/telegramTrading.ts)
- CRE runtime authentication plus idempotent decision storage:
  - [`frontend/server/_lib/cre/runtimeBridge.ts`](../../frontend/server/_lib/cre/runtimeBridge.ts)
- Control-plane audit stream:
  - [`frontend/server/_lib/agentControl/audit.ts`](../../frontend/server/_lib/agentControl/audit.ts)

### Automation, scheduling, and execution

- Local CRE runner:
  - [`cre/runner.ts`](../../cre/runner.ts)
- Main workflow:
  - [`cre/workflows/4626.workflow.ts`](../../cre/workflows/4626.workflow.ts)
- Additional workflow packages:
  - [`cre/cre-workflows`](../../cre/cre-workflows)
- Keepr queue APIs:
  - [`frontend/api/_handlers/keepr/actions/_enqueue.ts`](../../frontend/api/_handlers/keepr/actions/_enqueue.ts)
  - [`frontend/api/_handlers/keepr/actions/_pending.ts`](../../frontend/api/_handlers/keepr/actions/_pending.ts)
  - [`frontend/api/_handlers/keepr/actions/_execute.ts`](../../frontend/api/_handlers/keepr/actions/_execute.ts)
  - [`frontend/api/_handlers/keepr/actions/_updateStatus.ts`](../../frontend/api/_handlers/keepr/actions/_updateStatus.ts)
- Queue executor:
  - [`frontend/server/keepr/xmtpQueueExecutor.ts`](../../frontend/server/keepr/xmtpQueueExecutor.ts)

### Signing, deploy, bridge, payout, and config-changing paths

- Privy and CSW signing:
  - [`frontend/server/_lib/privyWalletApi.ts`](../../frontend/server/_lib/privyWalletApi.ts)
  - [`frontend/server/_lib/privyCoinbaseSmartWallet.ts`](../../frontend/server/_lib/privyCoinbaseSmartWallet.ts)
- Deploy session orchestration:
  - [`frontend/api/_handlers/deploy/session/_create.ts`](../../frontend/api/_handlers/deploy/session/_create.ts)
  - [`frontend/api/_handlers/deploy/session/_status.ts`](../../frontend/api/_handlers/deploy/session/_status.ts)
  - [`frontend/api/_handlers/deploy/session/_continue.ts`](../../frontend/api/_handlers/deploy/session/_continue.ts)
  - [`frontend/api/_handlers/deploy/session/_sessionAccess.ts`](../../frontend/api/_handlers/deploy/session/_sessionAccess.ts)
  - [`frontend/server/_lib/deploySessions.ts`](../../frontend/server/_lib/deploySessions.ts)
- Paymaster policy:
  - [`frontend/api/_handlers/_paymaster.ts`](../../frontend/api/_handlers/_paymaster.ts)
- Solana route and token registration:
  - [`frontend/api/_handlers/deploy/_registerSolanaBridgeToken.ts`](../../frontend/api/_handlers/deploy/_registerSolanaBridgeToken.ts)
  - [`frontend/server/solana-provisioner/index.ts`](../../frontend/server/solana-provisioner/index.ts)
- Payout processor:
  - [`cre/actions/payout-router-processor.action.ts`](../../cre/actions/payout-router-processor.action.ts)

### Outbound remote-AI call sites

- Multi-provider chat completions:
  - [`frontend/server/agent/eliza/llm.ts`](../../frontend/server/agent/eliza/llm.ts)
- Embeddings:
  - [`frontend/server/agent/eliza/embeddings.ts`](../../frontend/server/agent/eliza/embeddings.ts)
- OpenAI image generation and evaluation:
  - [`frontend/server/_lib/openaiImage.ts`](../../frontend/server/_lib/openaiImage.ts)
- CRE keeper AI assessment:
  - [`frontend/api/_handlers/cre/keeper/_aiAssess.ts`](../../frontend/api/_handlers/cre/keeper/_aiAssess.ts)

### Environment, secrets, and machine auth

- Shared env loading:
  - [`frontend/server/_lib/serverEnv.ts`](../../frontend/server/_lib/serverEnv.ts)
- Shared machine auth:
  - [`frontend/packages/server-core/src/machine-auth.ts`](../../frontend/packages/server-core/src/machine-auth.ts)

## Control Plane

The canonical execution path is:

1. Create a typed capability with explicit actor binding, scope, limits, and confirmation class.
2. Create a typed proposal with correlation ID and structured intent.
3. Evaluate once through [`evaluatePolicy()`](../../frontend/server/_lib/agentControl/policy.ts).
4. Execute only with validated structured inputs.
5. Emit control-plane audit events to `agent_control_audit_events`.
6. Preserve legacy local audit tables when the surface already depends on them.

Current hardening invariants:

- Deny by default.
- No natural-language direct writes.
- Human-sensitive flows require explicit confirmation support.
- Replay checks are normalized through [`frontend/server/_lib/agentControl/replay.ts`](../../frontend/server/_lib/agentControl/replay.ts).
- Outbound remote-AI requests use a shared egress helper in [`frontend/server/_lib/agentControl/remoteAi.ts`](../../frontend/server/_lib/agentControl/remoteAi.ts).

## First Real Pilot: Telegram Callback Trade Flow

The first production rollout path is the Telegram callback trade flow in [`frontend/api/_handlers/telegram/_webhook.runtime.ts`](../../frontend/api/_handlers/telegram/_webhook.runtime.ts), not the Telegram account-link path.

### Hardened path

1. Consume the Telegram callback token from `telegram_action_tokens`.
2. Build the shared trade-control bundle through [`buildTelegramTradeControlBundle()`](../../frontend/server/_lib/agentControl/telegramTradeControl.ts).
3. Emit `proposal.created` and `confirmation.accepted` control-audit events.
4. Apply chat-scope checks, membership checks, canonical wallet checks, and shared policy evaluation.
5. Execute only the validated deterministic command or CSW user operation.
6. Emit allow/deny/success/failure control-audit events.
7. Write the legacy `telegram_action_audit` row with the same `correlation_id` so the two audit surfaces can be joined.

### What changed in this rollout

- The trade callback bundle is now built in one shared helper instead of being open-coded inside the webhook handler.
- The capability now binds both `telegram_user_id` and `chat_id`.
- The proposal carries a structured, correlation-linked intent instead of raw callback-only metadata.
- Previously missing deny branches now emit control-audit events:
  - `buy_sell_disabled`
  - `bid_disabled`
  - `membership_required`
  - `canonical_wallet_missing`
  - shared policy denies
  - malformed bid payloads via `proposal.denied` / `invalid_bid_payload`
- `telegram_action_audit` now stores `correlation_id` so maintainers can pivot between local Telegram history and the shared control-plane audit stream.

## Trust Zones

Trust zones are resolved through [`frontend/server/_lib/agentControl/trustZones.ts`](../../frontend/server/_lib/agentControl/trustZones.ts).

For keepr enqueue, execute, and queue execution, the effective action type is derived through `resolveKeeprEffectiveActionType()`, which prefers `action.action` over a misleading raw `actionType` field before the zone is resolved. This prevents automation callers from downgrading a financial action into a lower-privilege zone by spoofing the top-level string.

### Zones

- `financial_execution`
  - Strategy changes, payouts, bridges, vault actions, trading writes.
- `market_maintenance`
  - Monitoring and maintenance actions that should not inherit financial write power.
- `queue_messaging_monitoring`
  - XMTP group membership, messaging, notifications, and queue-facing operations.

### Auth layering

- `KEEPR_API_KEY`
  - Coarse machine auth for backward compatibility.
- `KEEPR_ZONE_KEY_FINANCIAL_EXECUTION`
- `KEEPR_ZONE_KEY_MARKET_MAINTENANCE`
- `KEEPR_ZONE_KEY_QUEUE_MESSAGING_MONITORING`

When a zone-specific key is configured, the corresponding request must also supply `x-keepr-zone-key`.

### Kill switches

- `KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION`
- `KEEPR_ZONE_DISABLE_MARKET_MAINTENANCE`
- `KEEPR_ZONE_DISABLE_QUEUE_MESSAGING_MONITORING`

Kill switches are enforced at:

- [`frontend/api/_handlers/keepr/actions/_enqueue.ts`](../../frontend/api/_handlers/keepr/actions/_enqueue.ts)
- [`frontend/api/_handlers/keepr/actions/_execute.ts`](../../frontend/api/_handlers/keepr/actions/_execute.ts)
- [`frontend/server/keepr/xmtpQueueExecutor.ts`](../../frontend/server/keepr/xmtpQueueExecutor.ts)

Operational meaning:

- Disabling a zone blocks new writes for that zone.
- Shared orchestration can still continue for other zones.
- Queue status updates and read surfaces remain available so operators can observe or unwind state safely.

## Remote-AI Egress Policy

Remote-AI egress is intentionally centralized around [`frontend/server/_lib/agentControl/remoteAi.ts`](../../frontend/server/_lib/agentControl/remoteAi.ts).

### Allowed providers

- `api.openai.com`
- `api.anthropic.com`
- `api.groq.com`
- `openrouter.ai`

### Rules

- Only HTTPS endpoints on the provider allowlist are accepted.
- Free-form text is redacted before egress.
- Structured JSON payloads must be allowlisted at the top level.
- Secret-shaped fields remain blocked by default through [`redaction.ts`](../../frontend/server/_lib/agentControl/redaction.ts).
- Address masking stays enabled by default to preserve prior prompt-size and privacy behavior.

### Current call sites using the shared wrapper

- [`frontend/server/agent/eliza/llm.ts`](../../frontend/server/agent/eliza/llm.ts)
- [`frontend/server/agent/eliza/embeddings.ts`](../../frontend/server/agent/eliza/embeddings.ts)
- [`frontend/server/_lib/openaiImage.ts`](../../frontend/server/_lib/openaiImage.ts)
- [`frontend/api/_handlers/cre/keeper/_aiAssess.ts`](../../frontend/api/_handlers/cre/keeper/_aiAssess.ts)

## Verified Assumptions

- Verified: the repo already had partial capability, proposal, policy, audit, trust-zone, and redaction primitives in `agentControl`.
- Verified: the Telegram callback trade flow was already the closest real production candidate for `proposal -> confirm -> execute -> audit`.
- Verified: keepr routes already supported per-zone optional header secrets.
- Verified: real outbound remote-AI integrations exist and now share the same egress helper.

## Unverified Assumptions

- Unverified: every external worker or cron caller has already been updated to send zone-specific keys when operators enable them.
- Unverified: maintainers have an external dashboard that joins `agent_control_audit_events` and `telegram_action_audit`.
- Unverified: workspace approvals and deploy session flows are ready for full proposal-first migration; they are mapped, but not converted in this rollout.

## Expected Missing Pieces

- There is still no standalone secure-agent service.
- There is still no unified audit query surface across Telegram, keepr, CRE, and deploy operations.
- There is still no shared capability store outside the local integrations that create capabilities on demand.

These are known follow-ups, not accidental omissions.

## Migration Notes

### Safe rollout order

1. Deploy code with the shared helpers and correlation ID support.
2. Leave `KEEPR_API_KEY` in place during the transition.
3. Configure zone-specific keys per automation boundary.
4. Turn on zone kill switches only when operators understand the execution impact for that zone.

### Backward compatibility

- Existing coarse `KEEPR_API_KEY` auth still works unless operators configure a stricter zone key.
- Existing Telegram callback tokens and audit tables are preserved.
- Existing remote-AI call sites keep their provider behavior while now sharing a consistent egress gate.

## Rollback and Kill-Switch Guidance

- To stop financial writes immediately:
  - Set `KEEPR_ZONE_DISABLE_FINANCIAL_EXECUTION=true`
- To stop messaging and queue-side writes:
  - Set `KEEPR_ZONE_DISABLE_QUEUE_MESSAGING_MONITORING=true`
- To remove extra per-zone auth during a staged rollback:
  - Unset the corresponding `KEEPR_ZONE_KEY_*` variable
- If remote-AI egress causes unexpected behavior:
  - disable the specific provider API key at the environment layer
  - keep the shared egress wrapper in place rather than bypassing redaction ad hoc

## Verification

Verified with focused tests:

- [`frontend/server/_lib/agentControl/__tests__/remoteAi.test.ts`](../../frontend/server/_lib/agentControl/__tests__/remoteAi.test.ts)
- [`frontend/server/_lib/agentControl/__tests__/replay.test.ts`](../../frontend/server/_lib/agentControl/__tests__/replay.test.ts)
- [`frontend/server/_lib/agentControl/__tests__/trustZones.test.ts`](../../frontend/server/_lib/agentControl/__tests__/trustZones.test.ts)
- [`frontend/server/_lib/agentControl/__tests__/telegramTradeControl.test.ts`](../../frontend/server/_lib/agentControl/__tests__/telegramTradeControl.test.ts)
- [`frontend/api/__tests__/keeprActionsEnqueue.test.ts`](../../frontend/api/__tests__/keeprActionsEnqueue.test.ts)
- [`frontend/api/__tests__/keeprActionsExecute.test.ts`](../../frontend/api/__tests__/keeprActionsExecute.test.ts)
- [`frontend/api/__tests__/telegramWebhook.test.ts`](../../frontend/api/__tests__/telegramWebhook.test.ts)

## Known Follow-Ups

- Add a unified audit query or operator dashboard keyed by `correlation_id`.
- Decide whether workspace approvals and deploy/session writes should adopt the same proposal-first pattern next.
- Extend trust-zone kill-switch telemetry so disable events surface in operator dashboards, not just API responses.
