import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/chat/_telemetry.ts'
import { createMockReq, createMockRes } from './helpers'

const { trackChatCommandCenterEventMock } = vi.hoisted(() => ({
  trackChatCommandCenterEventMock: vi.fn(),
}))
const { checkRateLimitMock, getClientIpMock, rateLimitKeyMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 179, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/_lib/messaging/chatCommandCenterTelemetry.js', () => ({
  trackChatCommandCenterEvent: trackChatCommandCenterEventMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    chatTelemetry: { windowMs: 60_000, maxRequests: 180 },
  },
}))

describe('POST /api/v1/chat/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 179, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 when telemetry rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'chat_command_sent',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(trackChatCommandCenterEventMock).not.toHaveBeenCalled()
  })

  it('rejects payloads with missing event name', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(trackChatCommandCenterEventMock).not.toHaveBeenCalled()
  })

  it('rejects payloads with invalid event format', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'chat command sent',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(trackChatCommandCenterEventMock).not.toHaveBeenCalled()
  })

  it('accepts telemetry payload and forwards structured fields', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'chat_command_sent',
        conversationId: 'group-1',
        conversationType: 'group',
        commandId: 'keeper-status',
        source: 'command',
        extra: 'value',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(trackChatCommandCenterEventMock).toHaveBeenCalledWith({
      event: 'chat_command_sent',
      conversationId: 'group-1',
      conversationType: 'group',
      commandId: 'keeper-status',
      source: 'command',
      payload: { extra: 'value' },
    })
  })

  it('passes through userop telemetry payload fields', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'xmtp_userop_submission_batch',
        source: 'coinbaseErc4337',
        sampleCount: 8,
        p95Ms: 2134,
        timeoutCount: 1,
        paymasterUsage: {
          sponsored: 6,
          selfFunded: 1,
          fallbackToSelfFunded: 1,
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(trackChatCommandCenterEventMock).toHaveBeenCalledWith({
      event: 'xmtp_userop_submission_batch',
      conversationId: null,
      conversationType: null,
      commandId: null,
      source: 'coinbaseErc4337',
      payload: {
        sampleCount: 8,
        p95Ms: 2134,
        timeoutCount: 1,
        paymasterUsage: {
          sponsored: 6,
          selfFunded: 1,
          fallbackToSelfFunded: 1,
        },
      },
    })
  })

  it('sanitizes oversized telemetry metadata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        event: 'chat_command_sent',
        conversationId: 'c'.repeat(256),
        source: 's'.repeat(128),
        items: Array.from({ length: 25 }, (_, i) => i),
        nested: {
          child: {
            grandchild: {
              depth4: {
                depth5: 'too-deep',
              },
            },
          },
        },
        veryLong: 'x'.repeat(1024),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(trackChatCommandCenterEventMock).toHaveBeenCalledWith({
      event: 'chat_command_sent',
      conversationId: 'c'.repeat(128),
      conversationType: null,
      commandId: null,
      source: 's'.repeat(64),
      payload: expect.objectContaining({
        items: expect.any(Array),
        nested: {
          child: {
            grandchild: {
              depth4: '[max-depth]',
            },
          },
        },
        veryLong: 'x'.repeat(512),
      }),
    })
    const tracked = trackChatCommandCenterEventMock.mock.calls[0]?.[0] as { payload?: Record<string, unknown> } | undefined
    expect(Array.isArray(tracked?.payload?.items)).toBe(true)
    expect((tracked?.payload?.items as unknown[]).length).toBe(20)
  })
})
