// Shared manual-HTTP-trigger auth gate for CRE workflows.
//
// History: 4626-300 / SEV-001 / SEV-010 (audit 2026-04-22). The workflows at
//   cre/cre-workflows/charm-rebalance-manager/main.ts
//   cre/cre-workflows/runtime-orchestrator/main.ts
// both expose an `HTTPCapability` trigger that could enqueue rebalance /
// orchestrator actions. The audit finding was that the fix existed in docs
// but not in code; the fix shipped in PR #318 (commit 847fee0) directly
// inside each workflow's `onHttpTrigger`. Factoring the shared check here
// makes it unit-testable without pulling in the whole workflow graph.
//
// Behavior: rejects with `Error('unauthorized_manual_trigger')` when the
// payload token is missing, empty, or does not match the configured secret.

export const UNAUTHORIZED_MANUAL_TRIGGER = "unauthorized_manual_trigger"

export type AuthTokenCarrier = { authToken?: string }

export function assertManualTriggerAuthorized(
  providedToken: string | undefined,
  configuredSecret: string,
): void {
  if (!providedToken || providedToken !== configuredSecret) {
    throw new Error(UNAUTHORIZED_MANUAL_TRIGGER)
  }
}
