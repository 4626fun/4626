import { describe, expect, it } from 'vitest'

import { shouldResumeDeploySession } from '@/lib/deploy/shouldResumeDeploySession'

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
