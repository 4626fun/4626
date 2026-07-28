import { describe, expect, it, vi } from 'vitest'

import { runAmoeDailyQuestReminder } from './amoeDailyQuestReminder.js'

describe('runAmoeDailyQuestReminder', () => {
  it('intersects Base opted-in wallets with engaged unpaid check-ins', async () => {
    const listUsers = vi.fn(async () => ({
      ok: true as const,
      users: [
        { address: '0x1111111111111111111111111111111111111111' as const, notificationsEnabled: true },
        { address: '0x2222222222222222222222222222222222222222' as const, notificationsEnabled: true },
        { address: '0x3333333333333333333333333333333333333333' as const, notificationsEnabled: true },
      ],
    }))
    const listEngaged = vi.fn(async () => ({
      engaged: [
        '0x1111111111111111111111111111111111111111' as const,
        '0x2222222222222222222222222222222222222222' as const,
        '0x4444444444444444444444444444444444444444' as const,
      ],
      alreadyClaimedToday: new Set(['0x2222222222222222222222222222222222222222']),
    }))
    const send = vi.fn(async () => ({
      ok: true as const,
      data: {
        success: true,
        sentCount: 1,
        failedCount: 0,
        results: [{ walletAddress: '0x1111111111111111111111111111111111111111', sent: true }],
      },
    }))

    const result = await runAmoeDailyQuestReminder({
      nowMs: Date.parse('2026-07-28T16:00:00.000Z'),
      env: { BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>,
      listUsers,
      listEngaged,
      send,
    })

    expect(result.ok).toBe(true)
    expect(result.dayKey).toBe('2026-07-28')
    expect(result.candidateCount).toBe(1)
    expect(result.sentCount).toBe(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddresses: ['0x1111111111111111111111111111111111111111'],
        title: 'Daily quest open',
        targetPath: '/',
      }),
    )
  })

  it('returns dry_run without sending', async () => {
    const send = vi.fn()
    const result = await runAmoeDailyQuestReminder({
      dryRun: true,
      env: { BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>,
      listUsers: async () => ({
        ok: true,
        users: [{ address: '0x1111111111111111111111111111111111111111', notificationsEnabled: true }],
      }),
      listEngaged: async () => ({
        engaged: ['0x1111111111111111111111111111111111111111'],
        alreadyClaimedToday: new Set(),
      }),
      send,
    })

    expect(result.ok).toBe(true)
    expect(result.reason).toBe('dry_run')
    expect(result.candidateCount).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })

  it('fails closed when API key missing', async () => {
    const result = await runAmoeDailyQuestReminder({
      env: {} as Record<string, string | undefined>,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('BASE_APP_API_KEY')
  })
})
