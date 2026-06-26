# 4626 Control Plane Operator Cheat Sheet

This is the day-to-day mental model and action map for operating the 4626 control plane.

## Core Mental Model

- `provisionVaultEconomy(request)` sets up launch-ready economics and chain wiring.
- `getVaultLifecycleStatus(vaultId)` is the canonical status read across all phases.
- `runMaintenanceCycle(vaultId)` executes recurring upkeep and reconciliation loops.
- `queueOperatorAction(action)` enqueues explicit interventions and remediations.
- `settleVault(vaultId)` is the only authoritative settlement writer.

Think in lifecycle, not scripts:

`provision -> launch -> maintain -> intervene -> settle`

---

## If X Then Y (Operator Actions)

- **Need to launch or complete setup for a new vault**
  - Call `provisionVaultEconomy`.
  - Confirm outcome with `getVaultLifecycleStatus`.

- **Vault is live and needs routine upkeep**
  - Call `runMaintenanceCycle`.
  - Re-check with `getVaultLifecycleStatus`.

- **A one-off fix is required (reconcile/retry/manual remediation)**
  - Call `queueOperatorAction` with action type + idempotency key.
  - Track progress via `getVaultLifecycleStatus`.

- **Lifecycle reached settlement conditions**
  - Call `settleVault`.
  - Validate `settlementStage` and `settledAt` via status.

- **Unclear state or suspected race condition**
  - Stop direct scripting.
  - Use `getVaultLifecycleStatus` first, then route through one control-plane verb.

---

## Phase-by-Phase Playbook

## 1) Provisioning

- Primary verb: `provisionVaultEconomy`
- Includes:
  - deploy/session orchestration
  - strategy wiring
  - Solana bridge token registration intents
  - route/provisioner prerequisites

## 2) Launch Validation

- Primary verb: `getVaultLifecycleStatus`
- Confirm:
  - lifecycle transition moved as expected
  - no unresolved blockers
  - chain-side references are present

## 3) Post-Launch Maintenance

- Primary verb: `runMaintenanceCycle`
- Includes:
  - keeper loops
  - bridge integrity checks
  - reconciliation / maintenance-safe transitions

## 4) Manual/Exceptional Operations

- Primary verb: `queueOperatorAction`
- Use for:
  - backfills
  - replay-safe remediations
  - controlled retries
  - action classes with explicit retry policy

## 5) Settlement and Closure

- Primary verb: `settleVault`
- Rule:
  - no competing settlement writers
  - adapters may request settlement, but authority is centralized here

---

## Solana + Meteora + Alpha Vault Flow (Operator View)

1. Ingress intent through adapter (`registerSolanaBridgeToken`, `provision-solana-route`, `meteora-ixs`).
2. Normalize to control-plane request and attach idempotency context.
3. Resolve policy/config:
   - creator/bridge token mapping
   - Meteora config source
   - quote-mint/strict mode checks
4. Run gates:
   - provisioner liveness
   - adapter ownership/authority checks
   - fallback policy (remote/local)
5. Execute:
   - route provisioning
   - bridge token registration
   - Meteora ix payload dispatch
   - Alpha Vault create/update
6. Reconcile in maintenance cycle and publish status.

---

## Payment Rails and Activation Mapping

This control plane is not deploy-only; it includes paid feature activation and post-launch operation.

- Stripe path:
  - checkout creation -> webhook verification -> activation pending -> provisioning dispatch
- x402 path:
  - 402 requirements -> signed authorization -> relayer settlement -> activation pending -> provisioning dispatch
- Legacy USDC tx-hash:
  - verify transfer -> activation pending -> provisioning dispatch

Operational rule:

- payment rail is transport
- activation/provisioning lifecycle is control-plane governed

---

## Failure/Retry Quick Rules

- Retryable (transient): queue with replay policy and bounded attempts.
- Terminal (invalid transition/config): fail fast and require operator action.
- Invariant failure: block progression, record explicit reason, do not silently continue.
- Duplicate requests: rely on idempotency keys and canonical status reads.

## Degradation Matrix (Verb Defaults)

- `provisionVaultEconomy`: `fail_closed`
- `getVaultLifecycleStatus`: `allow_stale_read`
- `runMaintenanceCycle`: `queue_for_retry`
- `queueOperatorAction`: `fail_closed`
- `settleVault`: `fail_closed`

Stale status responses are explicit and include:

- `freshness: "stale"`
- `degradationMode: "allow_stale_read"`
- `warning` with operator next action

---

## What Not To Do

- Do not write new one-off public routes for lifecycle mutations.
- Do not let scripts write settlement state directly.
- Do not add chain/creator/vault special cases as ad hoc branches in handlers.
- Do not bypass status checks when debugging; always read canonical lifecycle first.

---

## Suggested Dashboard Cards (Operator UI)

- Lifecycle phase + blocker reason
- Last maintenance cycle result
- Pending operator actions + retryability class
- Settlement authority status (requested/applied/error)
- Solana provisioning lane health (provisioner, Meteora, Alpha Vault)
- Payment activation lane health (Stripe/x402/manual)

---

## Verification Companion

- Use [`docs/operations/control-plane-verification.md`](./control-plane-verification.md) for PR-level lifecycle proof checks and integration validation.
- Use [`docs/runbooks/control-plane-triage.md`](../runbooks/control-plane-triage.md) for stuck-operation and manual_review triage.

