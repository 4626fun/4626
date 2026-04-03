import { describe, expect, it } from 'vitest'

import { createStaticReplayGuard, normalizeReplayKeys } from '../replay.js'

describe('agent control replay helpers', () => {
  it('normalizes and deduplicates replay keys', () => {
    expect(
      normalizeReplayKeys([
        ' token-1 ',
        '',
        null,
        undefined,
        'token-1',
        'token-2',
      ]),
    ).toEqual(['token-1', 'token-2'])
  })

  it('checks replay membership against a static guard', () => {
    const guard = createStaticReplayGuard(['token-1', 'token-2'])

    expect(guard.isReplay('token-1')).toBe(true)
    expect(guard.isReplay('token-3')).toBe(false)
  })
})
