import { describe, expect, it, vi } from 'vitest'

import { readPrivyAccessTokenOrNull, readPrivyAccessTokenWithRetries } from '@/lib/privy/accessToken'

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

describe('readPrivyAccessTokenOrNull', () => {
  it('returns null when no token is available', async () => {
    const token = await readPrivyAccessTokenOrNull({
      read: async () => '',
      attempts: 1,
      retryDelayMs: 0,
      timeoutMs: 50,
    })
    expect(token).toBeNull()
  })

  it('skips tokens that fail validation', async () => {
    const read = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('live-token')

    const token = await readPrivyAccessTokenOrNull({
      read,
      attempts: 3,
      retryDelayMs: 0,
      timeoutMs: null,
      validate: (value) => value === 'live-token',
    })

    expect(token).toBe('live-token')
    expect(read).toHaveBeenCalledTimes(2)
  })
})
