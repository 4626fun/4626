import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const TOKEN = '0x1111111111111111111111111111111111111111'

const mocks = vi.hoisted(() => ({
  buildShareTokenMetadataMock: vi.fn(),
}))

vi.mock('../../server/_lib/shareTokenMetadata.js', () => ({
  buildShareTokenMetadata: mocks.buildShareTokenMetadataMock,
}))

describe('token tokenlist endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildShareTokenMetadataMock.mockResolvedValue({
      name: 'Akita Share',
      symbol: 'AKITA',
      decimals: 18,
    })
  })

  it('returns a token-list-compatible payload with absolute logoURI aliases', async () => {
    const { getApiHandler } = await import('../_handlers/_routes.ts')
    const handler = await getApiHandler(`v1/token/${TOKEN}/tokenlist`)
    expect(handler).toBeTypeOf('function')

    const req = createMockReq({
      method: 'GET',
      query: { chain: '8453' },
      headers: { host: 'api.4626.fun' },
    })
    const res = createMockRes()

    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      name: expect.any(String),
      timestamp: expect.any(String),
      version: { major: 1, minor: 0, patch: 0 },
      tokens: expect.any(Array),
    })

    const token = res.body?.tokens?.[0]
    expect(token).toMatchObject({
      chainId: 8453,
      address: TOKEN.toLowerCase(),
      decimals: 18,
      name: 'Akita Share',
      symbol: 'AKITA',
    })
    expect(String(token?.logoURI ?? '')).toContain(`/v1/token/${TOKEN.toLowerCase()}/logo.png`)
    expect(String(token?.logoURI ?? '').startsWith('https://')).toBe(true)
    expect(String(token?.extensions?.logoSVG ?? '')).toContain(`/v1/token/${TOKEN.toLowerCase()}/logo.svg`)
  })
})
