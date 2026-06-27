import { describe, expect, it, vi } from 'vitest'

import { readPrivyAccessTokenWithRetries } from './waitlistPrivyToken'

describe('readPrivyAccessTokenWithRetries', () => {
  it('returns token after transient empty reads', async () => {
    const read = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('   ')
      .mockResolvedValueOnce('privy-token')

    const token = await readPrivyAccessTokenWithRetries({
      read,
      attempts: 5,
      retryDelayMs: 0,
      timeoutMs: 250,
    })

    expect(token).toBe('privy-token')
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('returns empty string when reader remains empty', async () => {
    const read = vi.fn<() => Promise<string | null>>().mockResolvedValue('')

    const token = await readPrivyAccessTokenWithRetries({
      read,
      attempts: 3,
      retryDelayMs: 0,
      timeoutMs: 250,
    })

    expect(token).toBe('')
    expect(read).toHaveBeenCalledTimes(3)
  })
  it('times out on a hung getAccessToken without blocking', async () => {
    const read = vi.fn(() => new Promise<string>(() => {}))
    const token = await readPrivyAccessTokenWithRetries({
      read,
      attempts: 2,
      retryDelayMs: 0,
      timeoutMs: 50,
    })
    expect(token).toBe('')
    expect(read).toHaveBeenCalledTimes(2)
  })

})
