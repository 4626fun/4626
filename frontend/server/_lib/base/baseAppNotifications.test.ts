import { describe, expect, it, vi } from 'vitest'

import {
  isBaseAppNotificationsConfigured,
  listBaseAppNotificationUsers,
  resolveBaseAppNotificationsAppUrl,
  sendBaseAppNotifications,
} from './baseAppNotifications.js'

describe('baseAppNotifications', () => {
  it('reads BASE_APP_API_KEY and defaults app url to app.4626.fun', () => {
    expect(
      isBaseAppNotificationsConfigured({ BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>),
    ).toBe(true)
    expect(resolveBaseAppNotificationsAppUrl({} as Record<string, string | undefined>)).toBe('https://app.4626.fun')
  })

  it('lists notification-enabled users with pagination', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            users: [{ address: '0xA11ce00000000000000000000000000000000000', notificationsEnabled: true }],
            nextCursor: 'page-2',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            users: [{ address: '0xB0B0000000000000000000000000000000000000', notificationsEnabled: true }],
          }),
          { status: 200 },
        ),
      )

    const result = await listBaseAppNotificationUsers({
      notificationEnabled: true,
      env: { BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.users).toHaveLength(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('notification_enabled=true')
  })

  it('sends notifications with title/message bounds', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          sentCount: 1,
          failedCount: 0,
          results: [{ walletAddress: '0xA11ce00000000000000000000000000000000000', sent: true }],
        }),
        { status: 200 },
      ),
    )

    const badTitle = await sendBaseAppNotifications({
      walletAddresses: ['0xA11ce00000000000000000000000000000000000'],
      title: 'x'.repeat(31),
      message: 'ok',
      env: { BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(badTitle.ok).toBe(false)

    const ok = await sendBaseAppNotifications({
      walletAddresses: ['0xA11ce00000000000000000000000000000000000'],
      title: 'Daily quest open',
      message: 'Claim today’s AMOE check-in for credits.',
      targetPath: '/',
      env: { BASE_APP_API_KEY: 'test-key' } as Record<string, string | undefined>,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.data.sentCount).toBe(1)
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? '{}')) as {
      app_url: string
      target_path: string
    }
    expect(body.app_url).toBe('https://app.4626.fun')
    expect(body.target_path).toBe('/')
  })
})
