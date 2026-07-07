import { describe, expect, it } from 'vitest'

import { shouldRetryWaitlistJoin, waitlistChatStatusMessage } from './waitlistChatCopy'

describe('waitlistChatCopy', () => {
  it('describes executed state as a sync step', () => {
    expect(waitlistChatStatusMessage('executed')).toContain('Pulling')
  })

  it('only retries join from safe states', () => {
    expect(shouldRetryWaitlistJoin('awaiting_messaging')).toBe(true)
    expect(shouldRetryWaitlistJoin('executed')).toBe(false)
    expect(shouldRetryWaitlistJoin('pending')).toBe(false)
  })
})
