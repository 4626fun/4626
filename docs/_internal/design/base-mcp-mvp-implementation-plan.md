# Base MCP MVP Implementation Plan for 4626

Status: draft execution plan · Date: 2026-05-26

## 1) Scope

This plan operationalizes a two-week MVP to make 4626 Base MCP-native while preserving current account/auth/execution invariants in `docs/_internal/ACCOUNT_MODEL.md` and `frontend/docs/account-auth-invariants.md`.

Primary objective: enable agent-mediated, user-approved transaction flows for a narrow safe subset (portfolio reads, transfers, swaps) with explicit policy gating and execution-track correctness.

## 2) Non-negotiable invariants

1. Verified email remains canonical 4626 identity.
2. `linked` is not equivalent to `execution-ready`.
3. User-initiated action routing must respect explicit execution track (`canonical` vs `eoa`).
4. No hidden signing / auto-send behavior; user approval is mandatory before value movement.
5. Hard-fail on policy or readiness violations; no silent fallback.

## 3) Week-by-week delivery

## Week 1 — foundation and safe action subset

### Day 1–2: Action contract + schemas

Define action contract for:
- `getBalances`
- `getPortfolioSummary`
- `prepareTransfer`
- `prepareSwap`

Deliverable:
- shared TypeScript schema module under `frontend/server/_lib/agents/base-mcp/schemas.ts`.
- request/response validation via zod.

### Day 2–3: Policy engine

Implement server-side policy engine under `frontend/server/_lib/agents/base-mcp/policy.ts`.

Initial checks:
- chain allowlist (Base-only for MVP)
- token allowlist (stablecoins + core assets configured by env)
- required token-specific notional caps per action (never share one base-unit cap across 6- and 18-decimal assets)
- slippage cap (swap)
- recipient safety checks (transfer)
- expiry / replay window guard

Behavior:
- return typed blocked outcome with explicit machine reason code
- never auto-fallback from canonical path to unsafe direct sends

### Day 3–4: Execution-track mapper

Implement `frontend/server/_lib/agents/base-mcp/executionRoute.ts`:
- inspect account state for the requested user/profile
- resolve `executionMode` and sender lane from that account state, never from process-wide sender defaults
- return `blocked_not_execution_ready` when preconditions are not met for requested action

### Day 4–5: Approval-link adapter + status flow

Implement `frontend/server/_lib/agents/base-mcp/approvalFlow.ts`:
- persist pending request metadata in a durable store shared across API instances
- generate approval URL payload
- poll status transitions (`pending`, `approved`, `rejected`, `expired`)
- require trusted webhook or wallet/user proof before accepting `approved` / `rejected` transitions
- emit deterministic webhook/event for agent continuation

### Day 5: tests and prompt fixtures

Add tests:
- `frontend/server/_lib/agents/base-mcp/__tests__/policy.test.ts`
- `frontend/server/_lib/agents/base-mcp/__tests__/executionRoute.test.ts`
- `frontend/server/_lib/agents/base-mcp/__tests__/approvalFlow.test.ts`

Add prompt fixtures for QA:
- `frontend/docs/agent-prompts/base-mcp-smoke-prompts.md`

## Week 2 — plugin surface + hardening

### Day 6–8: Plugin surface

Implement minimal plugin endpoints in static route map:
- read actions
- transfer/swap prepare actions

No additional protocol skills until stable baseline metrics are healthy.

### Day 7–8: UX and status taxonomy

Add state language used by both chat responses and app surfaces:
- `linked`
- `execution_ready`
- `awaiting_user_approval`
- `policy_blocked`
- `approval_expired`

### Day 8–9: security review gate

Create checklist at `docs/audits/base-mcp-security-checklist.md` including:
- no private key handling in MCP layer
- server-auth enforcement for mutating internal paths
- request logging and tamper-evident metadata
- replay resistance / expiry checks

### Day 9–10: telemetry and staged rollout

Implement funnel metrics:
`prompt_received -> action_prepared -> approval_opened -> approved|rejected -> submitted -> confirmed|failed`

Rollout plan:
1. internal-only flag
2. power-user cohort
3. broad enablement

Rollback triggers:
- abnormal policy bypass attempts
- elevated revert rate after approval
- approval mismatch incidents

## 4) Action schemas (MVP)

```ts
// PrepareSwapRequest
{
  action: 'prepareSwap',
  userId: string,
  chainId: 8453,
  sellToken: `0x${string}`,
  buyToken: `0x${string}`,
  sellAmount: string, // base units
  maxSlippageBps: number,
  quoteTtlSeconds: number,
  clientRequestId: string,
}

// PrepareSwapResponse (success)
{
  status: 'ok',
  executionMode: 'canonical' | 'eoa',
  sender: `0x${string}`,
  approval: {
    requestId: string,
    approvalUrl: string,
    expiresAt: string,
  },
  simulation: {
    expectedAssetDeltas: Array<{
      token: `0x${string}`,
      amount: string,
      direction: 'in' | 'out',
    }>,
    warnings: string[],
  },
}

// PrepareSwapResponse (blocked)
{
  status: 'blocked',
  reasonCode:
    | 'not_execution_ready'
    | 'policy_token_not_allowed'
    | 'policy_slippage_too_high'
    | 'policy_notional_too_high'
    | 'policy_chain_not_allowed'
    | 'policy_recipient_not_allowed',
  message: string,
}
```

## 5) Policy table (red/green)

| Scenario | Decision | Reason code |
|---|---|---|
| Base chain, allowlisted tokens, amount within cap, slippage <= cap | Allow | n/a |
| Non-Base chain | Block | `policy_chain_not_allowed` |
| Token not allowlisted | Block | `policy_token_not_allowed` |
| Notional above cap | Block | `policy_notional_too_high` |
| Slippage above cap | Block | `policy_slippage_too_high` |
| Account linked but not execution-ready on requested track | Block | `not_execution_ready` |
| Recipient flagged/disallowed | Block | `policy_recipient_not_allowed` |

## 6) File ownership and implementation map

- API handlers and route map:
  - `frontend/api/_handlers/...`
  - `frontend/api/[...path].ts`
- Core server modules:
  - `frontend/server/_lib/agents/base-mcp/*`
- Documentation and runbook:
  - `docs/base-mcp-mvp-implementation-plan.md`
  - `docs/audits/base-mcp-security-checklist.md`
  - `frontend/docs/agent-prompts/base-mcp-smoke-prompts.md`

## 7) Acceptance criteria

1. Agent can request balance/portfolio reads for Base accounts.
2. Agent can prepare transfer/swap actions and return approval links.
3. No action can progress to onchain submission without explicit user approval.
4. All blocked decisions are typed and observable.
5. Execution-track routing never violates canonical/eoa invariants.
