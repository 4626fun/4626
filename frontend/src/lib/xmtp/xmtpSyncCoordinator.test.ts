import { afterEach, describe, expect, it, vi } from 'vitest'

import { isXmtpRateLimitError } from './xmtpHelpers'
import {
  coordinatedConversationSync,
  resetXmtpSyncCoordinatorForTests,
  xmtpSyncBlockedRemainingMs,
} from './xmtpSyncCoordinator'

describe('isXmtpRateLimitError', () => {
  it('matches QueryWelcomeMessages rate-limit payloads', () => {
    expect(
      isXmtpRateLimitError(
        "api client error api client at endpoint \"/xmtp.mls.api.v1.MlsApi/QueryWelcomeMessages\" has error status: 'Some resource has been exhausted', self: \"1 exceeds rate limit R23.240.54.118DEF\"",
      ),
    ).toBe(true)
  })
})

describe('coordinatedConversationSync', () => {
  afterEach(() => {
    resetXmtpSyncCoordinatorForTests()
    vi.useRealTimers()
  })

  it('dedupes concurrent sync requests', async () => {
    let syncCalls = 0
    const api = {
      sync: vi.fn(async () => {
        syncCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
      }),
    }

    await Promise.all([
      coordinatedConversationSync(api, { lightweight: true }),
      coordinatedConversationSync(api, { lightweight: true }),
    ])

    expect(syncCalls).toBe(1)
  })

  it('enters cooldown after a rate-limit error', async () => {
    const api = {
      sync: vi.fn(async () => {
        throw new Error('1 exceeds rate limit')
      }),
    }

    await expect(coordinatedConversationSync(api, { force: true, lightweight: true })).rejects.toThrow(
      /rate limit/i,
    )
    expect(xmtpSyncBlockedRemainingMs()).toBeGreaterThan(0)

    const skipped = await coordinatedConversationSync(api, { lightweight: true })
    expect(skipped).toBe('skipped_cooldown')
    expect(api.sync).toHaveBeenCalledTimes(1)
  })
})
