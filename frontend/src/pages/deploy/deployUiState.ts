/**
 * Presentation-layer deploy state machine.
 *
 * Derives a single discriminated union from the existing loosely coupled
 * state variables in `DeployVaultBatcher`. The existing state vars remain the
 * source of truth — this never feeds back into deploy logic, gating, or
 * submission; it only drives the cockpit UI (overview card, action bar, badges).
 */

export type DeployRunPhase = 'phase1' | 'phase2' | 'phase3' | 'phase4'

export type DeployUiState =
  | { kind: 'checking' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'failed'; error: string }
  | { kind: 'dryRunning' }
  | { kind: 'deploying'; phase: DeployRunPhase | null }
  | { kind: 'complete' }
  | { kind: 'dryRunPassed' }
  | { kind: 'approvalRequired' }
  | { kind: 'ready' }
  | { kind: 'idle' }

export interface DeployUiStateInputs {
  /** Live deploy submission in flight. */
  busy: boolean
  /** Legacy phase union from `DeployVaultBatcher`. */
  phase: 'idle' | DeployRunPhase | 'done'
  /** Dry-run request in flight. */
  dryRunBusy: boolean
  /** Last dry-run outcome (null until a dry-run completes). */
  dryRunOk: boolean | null
  /** Submission/runtime error message, if any. */
  error: string | null
  /** Reason the 1-click CTA is disabled (from `disabledReason`). */
  disabledReason: string | null
  /** Whether infra/vanity/expected-address queries are still loading. */
  planLoading: boolean
  /** Whether an ERC-4337 signer lane exists (`hasDeploySignerPath`). */
  hasSignerPath: boolean
}

export function deriveDeployUiState(inputs: DeployUiStateInputs): DeployUiState {
  if (inputs.busy) {
    if (inputs.phase === 'done') return { kind: 'complete' }
    return { kind: 'deploying', phase: inputs.phase === 'idle' ? null : inputs.phase }
  }
  if (inputs.phase === 'done') return { kind: 'complete' }
  if (inputs.dryRunBusy) return { kind: 'dryRunning' }
  if (inputs.error) return { kind: 'failed', error: inputs.error }
  // A deploy attempt that ended mid-phase without an error message still
  // reads as deploying-state context for the timeline; treat as failed-safe idle.
  if (inputs.phase !== 'idle') return { kind: 'deploying', phase: inputs.phase }
  if (inputs.planLoading) return { kind: 'checking' }
  if (inputs.disabledReason) return { kind: 'blocked', reason: inputs.disabledReason }
  if (!inputs.hasSignerPath) return { kind: 'approvalRequired' }
  if (inputs.dryRunOk === true) return { kind: 'dryRunPassed' }
  return { kind: 'ready' }
}

/** Calm, precise status copy for the overview card / action bar. */
export function deployUiStateLabel(state: DeployUiState): string {
  switch (state.kind) {
    case 'idle':
      return 'Waiting for deploy start'
    case 'checking':
      return 'Checking readiness'
    case 'blocked':
      return 'Blocked'
    case 'failed':
      return 'Deploy failed'
    case 'dryRunning':
      return 'Dry run in progress'
    case 'dryRunPassed':
      return 'Dry run passed — ready to deploy'
    case 'approvalRequired':
      return 'Setup approval required'
    case 'ready':
      return 'Ready to deploy'
    case 'deploying':
      switch (state.phase) {
        case 'phase1':
          return 'Deploying — Phase 1 of 4'
        case 'phase2':
          return 'Deploying — Phase 2 of 4'
        case 'phase3':
          return 'Deploying — Phase 3 of 4'
        case 'phase4':
          return 'Deploying — Phase 4 of 4'
        case null:
          return 'Deploying'
        default: {
          const exhaustive: never = state.phase
          return exhaustive
        }
      }
    case 'complete':
      return 'Deployment complete'
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/** Number of phases completed for the N/4 progress indicator. */
export function deployPhasesCompleted(phase: 'idle' | DeployRunPhase | 'done'): number {
  switch (phase) {
    case 'idle':
      return 0
    case 'phase1':
      return 0
    case 'phase2':
      return 1
    case 'phase3':
      return 2
    case 'phase4':
      return 3
    case 'done':
      return 4
    default: {
      const exhaustive: never = phase
      return exhaustive
    }
  }
}
