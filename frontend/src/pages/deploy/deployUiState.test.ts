import { describe, expect, it } from 'vitest'

import {
  deployPhasesCompleted,
  deployUiStateLabel,
  deriveDeployUiState,
  type DeployUiStateInputs,
} from './deployUiState'

const baseInputs: DeployUiStateInputs = {
  busy: false,
  phase: 'idle',
  dryRunBusy: false,
  dryRunOk: null,
  error: null,
  disabledReason: null,
  planLoading: false,
  hasSignerPath: true,
}

describe('deriveDeployUiState', () => {
  it('is ready when nothing blocks', () => {
    expect(deriveDeployUiState(baseInputs)).toEqual({ kind: 'ready' })
  })

  it('reports checking while plan queries load', () => {
    expect(deriveDeployUiState({ ...baseInputs, planLoading: true })).toEqual({ kind: 'checking' })
  })

  it('reports blocked with the disabled reason', () => {
    expect(
      deriveDeployUiState({ ...baseInputs, disabledReason: 'Loading batcher configuration…' }),
    ).toEqual({ kind: 'blocked', reason: 'Loading batcher configuration…' })
  })

  it('requires approval when no signer path exists', () => {
    expect(deriveDeployUiState({ ...baseInputs, hasSignerPath: false })).toEqual({
      kind: 'approvalRequired',
    })
  })

  it('prefers busy deploying state over everything else', () => {
    expect(
      deriveDeployUiState({
        ...baseInputs,
        busy: true,
        phase: 'phase2',
        error: 'stale error from a prior attempt',
        planLoading: true,
      }),
    ).toEqual({ kind: 'deploying', phase: 'phase2' })
  })

  it('maps busy with idle phase to a null-phase deploying state', () => {
    expect(deriveDeployUiState({ ...baseInputs, busy: true })).toEqual({
      kind: 'deploying',
      phase: null,
    })
  })

  it('is complete when phase is done regardless of busy', () => {
    expect(deriveDeployUiState({ ...baseInputs, busy: true, phase: 'done' })).toEqual({ kind: 'complete' })
    expect(deriveDeployUiState({ ...baseInputs, phase: 'done' })).toEqual({ kind: 'complete' })
  })

  it('shows dry-running while dry-run is busy', () => {
    expect(deriveDeployUiState({ ...baseInputs, dryRunBusy: true })).toEqual({ kind: 'dryRunning' })
  })

  it('shows dry-run passed after a successful dry-run', () => {
    expect(deriveDeployUiState({ ...baseInputs, dryRunOk: true })).toEqual({ kind: 'dryRunPassed' })
  })

  it('surfaces failures with the error message', () => {
    expect(deriveDeployUiState({ ...baseInputs, error: 'Vanity target not found within budget.' })).toEqual({
      kind: 'failed',
      error: 'Vanity target not found within budget.',
    })
  })

  it('keeps mid-phase context when a run stopped without an error', () => {
    expect(deriveDeployUiState({ ...baseInputs, phase: 'phase3' })).toEqual({
      kind: 'deploying',
      phase: 'phase3',
    })
  })

  it('failed dry-run does not mark ready as dry-run passed', () => {
    expect(deriveDeployUiState({ ...baseInputs, dryRunOk: false })).toEqual({ kind: 'ready' })
  })
})

describe('deployUiStateLabel', () => {
  it('labels every state with calm copy', () => {
    expect(deployUiStateLabel({ kind: 'idle' })).toBe('Waiting for deploy start')
    expect(deployUiStateLabel({ kind: 'ready' })).toBe('Ready to deploy')
    expect(deployUiStateLabel({ kind: 'dryRunPassed' })).toBe('Dry run passed — ready to deploy')
    expect(deployUiStateLabel({ kind: 'deploying', phase: 'phase4' })).toBe('Deploying — Phase 4 of 4')
    expect(deployUiStateLabel({ kind: 'deploying', phase: null })).toBe('Deploying')
    expect(deployUiStateLabel({ kind: 'complete' })).toBe('Deployment complete')
    expect(deployUiStateLabel({ kind: 'failed', error: 'x' })).toBe('Deploy failed')
    expect(deployUiStateLabel({ kind: 'blocked', reason: 'x' })).toBe('Blocked')
    expect(deployUiStateLabel({ kind: 'approvalRequired' })).toBe('Setup approval required')
    expect(deployUiStateLabel({ kind: 'checking' })).toBe('Checking readiness')
    expect(deployUiStateLabel({ kind: 'dryRunning' })).toBe('Dry run in progress')
  })
})

describe('deployPhasesCompleted', () => {
  it('counts completed phases for the progress indicator', () => {
    expect(deployPhasesCompleted('idle')).toBe(0)
    expect(deployPhasesCompleted('phase1')).toBe(0)
    expect(deployPhasesCompleted('phase2')).toBe(1)
    expect(deployPhasesCompleted('phase3')).toBe(2)
    expect(deployPhasesCompleted('phase4')).toBe(3)
    expect(deployPhasesCompleted('done')).toBe(4)
  })
})
