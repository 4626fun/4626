# Base MCP Security Checklist (4626)

Use before enabling Base MCP flows beyond internal flag.

## Identity and readiness

- [ ] Verified-email identity remains canonical.
- [ ] `linked` state is never treated as `execution-ready`.
- [ ] Execution-ready checks are track-specific (`canonical` vs `eoa`).

## Transaction authorization

- [ ] No private keys are stored or handled in MCP plugin/server paths.
- [ ] Every value-moving action requires explicit user approval via approval link.
- [ ] Approval links are expiry-bound and tied to request id.
- [ ] Replay attempts fail deterministically.

## Policy enforcement

- [ ] Chain allowlist enforced server-side.
- [ ] Token allowlist enforced server-side.
- [ ] Notional cap and slippage cap enforced server-side.
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
- [ ] Rollback criteria documented and monitored.
