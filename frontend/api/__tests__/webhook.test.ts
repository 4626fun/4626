import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWebhookEvent } from '@farcaster/miniapp-node'

import handler from '../_handlers/_webhook.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

vi.mock('@farcaster/miniapp-node', () => ({
  parseWebhookEvent: vi.fn(),
  verifyAppKeyWithNeynar: vi.fn(),
}))

describe('webhook handler security', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 503 when NEYNAR_API_KEY is missing', async () => {
    restoreEnv = applyEnv({ NEYNAR_API_KEY: undefined })

    const req = createMockReq({
      method: 'POST',
      body: {
        fid: 1,
        appFid: 1,
        event: {
          event: 'notifications_enabled',
          notificationDetails: { url: 'https://evil.test', token: 'super-secret-token' },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.success).toBe(false)
    expect((parseWebhookEvent as any).mock.calls.length).toBe(0)
    expect(JSON.stringify(res.body)).not.toContain('super-secret-token')
  })

  it('returns 401 when signature verification fails', async () => {
    restoreEnv = applyEnv({ NEYNAR_API_KEY: 'test-key' })
    ;(parseWebhookEvent as any).mockRejectedValueOnce(new Error('invalid_signature'))

    const req = createMockReq({
      method: 'POST',
      body: {
        fid: 1,
        appFid: 1,
        event: {
          event: 'notifications_enabled',
          notificationDetails: { url: 'https://evil.test', token: 'secret-token' },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'Invalid webhook signature' })
  })

  it('accepts a valid signed payload path', async () => {
    restoreEnv = applyEnv({ NEYNAR_API_KEY: 'test-key' })
    ;(parseWebhookEvent as any).mockResolvedValueOnce({
      fid: 123,
      appFid: 456,
      event: { event: 'health_ping' },
    })

    const req = createMockReq({ method: 'POST', body: { any: 'payload' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ok).toBe(true)
  })

  it('does not log raw payload values on verification failures', async () => {
    restoreEnv = applyEnv({ NEYNAR_API_KEY: 'test-key' })
    ;(parseWebhookEvent as any).mockRejectedValueOnce(new Error('bad_sig'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const req = createMockReq({
      method: 'POST',
      body: {
        fid: 1,
        appFid: 1,
        event: {
          event: 'notifications_enabled',
          notificationDetails: { url: 'https://evil.test', token: 'super-secret-token' },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('super-secret-token')
    errorSpy.mockRestore()
  })
})
