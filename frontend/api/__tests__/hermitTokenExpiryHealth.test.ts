import { describe, expect, it, vi } from 'vitest'

import {
  applyTokenExpiryHealthMetadata,
  createTokenExpiryHealthRefresher,
} from '../../server/agents/hermit/tokenExpiryHealth.js'

describe('Hermit token-expiry health metadata', () => {
  it('single-flights concurrent probes and caches repeated probes within the TTL', async () => {
    let resolveChat!: (value: {
      hasToken: boolean
      updatedAt: string
      expiresAt: string
      updatedBy: string
      isExpired: boolean
    }) => void
    const chatMeta = {
      hasToken: true,
      updatedAt: '2026-07-14T20:00:00.000Z',
      expiresAt: '2026-07-14T20:50:00.000Z',
      updatedBy: 'hermit',
      isExpired: false,
    }
    const readChatMeta = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveChat = resolve
      }))
      .mockResolvedValue(chatMeta)
    const readAccessMeta = vi.fn(async () => ({
      hasToken: true,
      updatedAt: '2026-07-14T20:00:01.000Z',
      expiresAt: '2026-07-14T20:55:00.000Z',
      updatedBy: 'hermit',
      isExpired: false,
    }))
    let nowMs = 1_000
    const refresh = createTokenExpiryHealthRefresher({
      readChatMeta,
      readAccessMeta,
      ttlMs: 5_000,
      now: () => nowMs,
    })

    const first = refresh()
    const concurrent = refresh()
    expect(readChatMeta).toHaveBeenCalledTimes(1)
    expect(readAccessMeta).toHaveBeenCalledTimes(1)

    resolveChat(chatMeta)
    await expect(Promise.all([first, concurrent])).resolves.toEqual([
      {
        chatJwtExpiresAt: '2026-07-14T20:50:00.000Z',
        accessTokenExpiresAt: '2026-07-14T20:55:00.000Z',
        lastSuccessfulTokenRefreshAt: '2026-07-14T20:00:00.000Z',
      },
      {
        chatJwtExpiresAt: '2026-07-14T20:50:00.000Z',
        accessTokenExpiresAt: '2026-07-14T20:55:00.000Z',
        lastSuccessfulTokenRefreshAt: '2026-07-14T20:00:00.000Z',
      },
    ])

    nowMs = 5_999
    await refresh()
    expect(readChatMeta).toHaveBeenCalledTimes(1)
    expect(readAccessMeta).toHaveBeenCalledTimes(1)

    nowMs = 6_000
    await refresh()
    expect(readChatMeta).toHaveBeenCalledTimes(2)
    expect(readAccessMeta).toHaveBeenCalledTimes(2)
  })

  it('applies metadata to the values returned in Hermit health JSON', () => {
    const healthState = {
      chatJwtExpiresAt: null as string | null,
      accessTokenExpiresAt: null as string | null,
      lastSuccessfulTokenRefreshAt: null as string | null,
    }

    applyTokenExpiryHealthMetadata(healthState, {
      chatJwtExpiresAt: '2026-07-14T20:50:00.000Z',
      accessTokenExpiresAt: '2026-07-14T20:55:00.000Z',
      lastSuccessfulTokenRefreshAt: '2026-07-14T20:00:00.000Z',
    })

    expect(JSON.parse(JSON.stringify(healthState))).toEqual({
      chatJwtExpiresAt: '2026-07-14T20:50:00.000Z',
      accessTokenExpiresAt: '2026-07-14T20:55:00.000Z',
      lastSuccessfulTokenRefreshAt: '2026-07-14T20:00:00.000Z',
    })
  })
})
