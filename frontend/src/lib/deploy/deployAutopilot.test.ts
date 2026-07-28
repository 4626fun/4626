import { describe, expect, it } from 'vitest'

import { shouldResumeDeploySession } from '@/lib/deploy/shouldResumeDeploySession'
import {
  evaluateOwnerInstallResumeAttempt,
  shouldKeepRetryingOwnerInstallResume,
} from '@/lib/deploy/ownerInstallResumePolicy'

const ready = {
  driveContinue: true,
  now: 20_000,
  lastContinueAttemptAt: 0,
}

describe('deploy autopilot resume policy', () => {
  it('follows nextAction=resume for in-flight and intermediate workflow ticks', () => {
    expect(shouldResumeDeploySession({ ...ready, nextAction: 'resume' })).toBe(true)
  })

  it('does not resume when the server requires owner installation', () => {
    expect(
      shouldResumeDeploySession({
        ...ready,
        nextAction: 'wait_for_owner_install',
      }),
    ).toBe(false)
  })

  it('honors the no-drive and throttle controls', () => {
    expect(
      shouldResumeDeploySession({
        ...ready,
        driveContinue: false,
        nextAction: 'resume',
      }),
    ).toBe(false)
    expect(
      shouldResumeDeploySession({
        ...ready,
        now: 12_000,
        nextAction: 'resume',
      }),
    ).toBe(false)
  })
})


describe('owner-install resume retry policy', () => {
  it('accepts a successful resume that leaves wait_for_owner_install', () => {
    expect(
      evaluateOwnerInstallResumeAttempt({
        ok: true,
        status: 200,
        json: { success: true, data: { nextAction: 'resume', step: 'funding' } },
      }),
    ).toBe('ok')
  })

  it('retries transient 5xx and lease_unavailable outcomes', () => {
    expect(
      evaluateOwnerInstallResumeAttempt({
        ok: false,
        status: 503,
        json: { success: false, error: 'upstream_unavailable' },
      }),
    ).toBe('retry')
    expect(
      evaluateOwnerInstallResumeAttempt({
        ok: true,
        status: 200,
        json: {
          success: true,
          data: { nextAction: 'wait_for_owner_install', lastError: 'lease_unavailable' },
        },
      }),
    ).toBe('retry')
    expect(
      shouldKeepRetryingOwnerInstallResume({
        decision: 'retry',
        attempts: 1,
        maxAttempts: 8,
      }),
    ).toBe(true)
  })

  it('fails closed on non-retryable client errors once attempts are exhausted', () => {
    expect(
      evaluateOwnerInstallResumeAttempt({
        ok: false,
        status: 400,
        json: { success: false, error: 'invalid_session' },
      }),
    ).toBe('fail')
    expect(
      shouldKeepRetryingOwnerInstallResume({
        decision: 'retry',
        attempts: 8,
        maxAttempts: 8,
      }),
    ).toBe(false)
  })
})
