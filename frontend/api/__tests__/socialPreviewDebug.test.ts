import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/social/_socialPreviewDebug.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  createPublicClientMock,
  httpMock,
  sdkSetApiKeyMock,
  sdkGetCoinMock,
} = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  httpMock: vi.fn(() => ({})),
  sdkSetApiKeyMock: vi.fn(),
  sdkGetCoinMock: vi.fn(),
}))

vi.mock('viem', () => ({
  createPublicClient: createPublicClientMock,
  http: httpMock,
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: sdkSetApiKeyMock,
  getCoin: sdkGetCoinMock,
}))

describe('GET /api/social-preview-debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SOCIAL_PREVIEW_DEBUG_ENABLED', 'true')
    vi.stubEnv('ZORA_SERVER_API_KEY', 'test-zora-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns rewrite + resolved payload for matched bot path', async () => {
    sdkGetCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          name: 'AKITA Creator Coin',
          symbol: 'AKITA',
          description: 'Creator coin for AKITA community.',
        },
      },
    })

    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
        'x-forwarded-proto': 'https',
      },
      query: {
        path: '/explore/creators/base/0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59',
        userAgent: 'Twitterbot/1.0',
      },
      url: '/api/social-preview-debug',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.matched).toBe(true)
    expect(res.body?.rewrite?.id).toBe('explore-creator-detail')
    expect(res.body?.rewrite?.destPath).toContain('/api/social-preview?kind=creator')
    expect(res.body?.payload?.title).toContain('AKITA Creator Coin')
    expect(String(res.getHeader('cache-control'))).toBe('no-store')
  })

  it('returns matched=false when UA is not a social bot', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
      },
      query: {
        path: '/explore/trends',
        userAgent: 'Mozilla/5.0',
      },
      url: '/api/social-preview-debug',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.matched).toBe(false)
  })

  it('returns 400 when path is missing', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'app.4626.fun',
      },
      query: {},
      url: '/api/social-preview-debug',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })
})
