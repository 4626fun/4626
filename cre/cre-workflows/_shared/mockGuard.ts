// Production fail-closed guard for mock-data branches in CRE workflows.
//
// History
// -------
// H-02 / M-05 (audit 2026-04-25). Three runtime workflows
//   cre/cre-workflows/runtime-indexer-data-fetch/main.ts
//   cre/cre-workflows/runtime-orchestrator/main.ts
//   cre/cre-workflows/runtime-reference-feeds/main.ts
// honor `mockGraphData` / `mockMatchedTransactions` / `mockResults` config
// fields whenever they are set, with no in-code guard against those fields
// reaching staging or production. The audit recommended an explicit refusal
// so that a misconfigured production config cannot silently make decisions
// from mock data.
//
// Strategy
// --------
// We treat the workflow name as the system-of-record for environment. By
// convention (see each workflow's `workflow.yaml`), the deployed workflow
// name is suffixed with `-local-simulation`, `-staging`, or `-production`.
// This file rejects mock-data fields outside `local-simulation` unless the
// operator explicitly opts in by setting `allowMockData: true` in the config
// AND the workflow name is also `-local-simulation`. The opt-in guard is
// belt-and-braces — even with the flag, a mistakenly-named production
// workflow still fails closed.
//
// CI lint complement
// ------------------
// `cre/scripts/check-no-mock-in-non-local-config.mjs` greps every
// `config.staging.json` / `config.production.json` for any `mock*` field and
// fails CI if one is found. The runtime guard catches missed lint coverage;
// the lint catches missed runtime coverage. Both layers are intentional.

export type MockGuardConfig = {
  workflowName?: string
  /**
   * Explicit operator opt-in. Even with this flag set, the runtime still
   * rejects mock data when `workflowName` is not a `-local-simulation`
   * variant. This makes the guard fail-closed for misconfigured production
   * deploys that accidentally include `allowMockData: true`.
   */
  allowMockData?: boolean
}

const LOCAL_SIM_SUFFIX = "-local-simulation"

export function isLocalSimulationName(workflowName: string | undefined): boolean {
  if (!workflowName) return false
  return workflowName.endsWith(LOCAL_SIM_SUFFIX) || workflowName === "local-simulation"
}

export function isMockDataAllowed(config: MockGuardConfig): boolean {
  // Two-key gate: operator must opt in AND the workflow name must announce
  // the local-simulation environment. This means a copy-pasted config that
  // retains `allowMockData: true` cannot accidentally enable mocks in a
  // staging/production deploy whose workflow name will not match.
  return Boolean(config.allowMockData) && isLocalSimulationName(config.workflowName)
}

/**
 * Throws `Error('mock_data_not_permitted')` when any of the supplied mock
 * fields is set and the runtime is not authorized to honor them. Intended
 * to be called inside a workflow before any mock-using branch.
 *
 * The workflow stays decision-deterministic: either the guard passes silently
 * (and the workflow may proceed to honor mocks) or it throws (and the entire
 * trigger run fails fast with no partial side-effects).
 */
export function assertMockDataAllowed(
  config: MockGuardConfig,
  detectedFields: Record<string, unknown>,
): void {
  const presentFields = Object.entries(detectedFields).filter(([, value]) => value !== undefined)
  if (presentFields.length === 0) return
  if (isMockDataAllowed(config)) return
  const labels = presentFields.map(([key]) => key).join(",")
  throw new Error(`mock_data_not_permitted:${labels}`)
}
