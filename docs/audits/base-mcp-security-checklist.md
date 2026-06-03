# Base MCP Security Checklist (4626)

Use before enabling Base MCP flows beyond internal flag.

## Identity and readiness

- [ ] Verified-email identity remains canonical.
- [ ] `linked` state is never treated as `execution-ready`.
- [ ] Execution-ready checks are track-specific (`canonical` vs `eoa`).
- [ ] Prepare routing resolves sender addresses from the requested account/profile, not process-wide sender env vars.

## Transaction authorization

- [ ] No private keys are stored or handled in MCP plugin/server paths.
- [ ] Every value-moving action requires explicit user approval via approval link.
- [ ] Approval links are expiry-bound, tied to request id, and persisted in a durable store shared across API instances; in-memory approval storage is local/test-only (`BASE_MCP_ALLOW_IN_MEMORY_APPROVAL_STORE=1`).
- [ ] Approval status updates require trusted webhook proof (`BASE_MCP_APPROVAL_WEBHOOK_SECRET`) or an equivalent wallet/user-auth proof.
- [ ] Replay attempts fail deterministically.

## Policy enforcement

- [ ] Chain allowlist enforced server-side.
- [ ] Token allowlist enforced server-side.
- [ ] Token-specific notional caps and slippage cap enforced server-side; every allowlisted value-moving token has a cap (`BASE_MCP_TOKEN_LIMITS_JSON` for token overrides).
- [ ] Disallowed recipients blocked with typed reason codes.
- [ ] Policy failure returns hard-fail blocked response (no silent fallback).

## Routing invariants

- [ ] Canonical path does not fall back to unsafe direct gas-send behavior.
- [ ] EOA path only executes through EOA lane.
- [ ] Sender and execution mode are logged for every prepared action.

## Observability and auditability

- [ ] Structured logs include `clientRequestId`, `requestId`, `reasonCode`, `executionMode`.
- [ ] Funnel metrics emitted for prepare/approve/submit/confirm states.
- [ ] Rejected/expired approvals are observable and queryable.

## Operational controls

- [ ] Feature flag defaults to off.
- [ ] Internal-only cohort tested first.
- [ ] Agent prepare calls require `BASE_MCP_AGENT_SECRET`, and any env-seeded test cohort uses `BASE_MCP_ACCOUNT_SENDERS_JSON` keyed by user id rather than shared global sender addresses.
- [ ] Rollback criteria documented and monitored.
