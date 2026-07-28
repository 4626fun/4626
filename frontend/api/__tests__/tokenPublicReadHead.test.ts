import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const TOKEN = '0x1111111111111111111111111111111111111111'

const mocks = vi.hoisted(() => ({
  buildShareTokenMetadataMock: vi.fn(),
}))

vi.mock('../../server/_lib/infra/shareTokenMetadata.js', () => ({
  buildShareTokenMetadata: mocks.buildShareTokenMetadataMock,
}))

describe('token public read HEAD support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildShareTokenMetadataMock.mockResolvedValue({
      name: 'Akita Share Token',
      symbol: '■AKITA',
      decimals: 18,
      image: 'https://api.4626.fun/v1/token/0x1111111111111111111111111111111111111111/image?format=png',
    })
  })

  it('allows HEAD on metadata without a response body', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    const handler = await getV1ApiHandler(`token/${TOKEN}/metadata`)
    expect(handler).toBeTypeOf('function')

    const req = createMockReq({
      method: 'HEAD',
      query: { chain: '8453' },
      headers: { host: 'api.4626.fun' },
    })
    const res = createMockRes()
    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
    expect(String(res.getHeader('access-control-allow-methods') ?? '')).toContain('HEAD')
    expect(String(res.getHeader('content-type') ?? '')).toContain('application/json')
    expect(Number(res.getHeader('content-length'))).toBeGreaterThan(0)
  })

  it('allows HEAD on tokenlist without a response body', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    const handler = await getV1ApiHandler(`token/${TOKEN}/tokenlist`)
    expect(handler).toBeTypeOf('function')

    const req = createMockReq({
      method: 'HEAD',
      query: { chain: '8453' },
      headers: { host: 'api.4626.fun' },
    })
    const res = createMockRes()
    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
    expect(String(res.getHeader('access-control-allow-methods') ?? '')).toContain('HEAD')
    expect(Number(res.getHeader('content-length'))).toBeGreaterThan(0)
  })

  it('rejects POST on metadata with 405', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')
    const handler = await getV1ApiHandler(`token/${TOKEN}/metadata`)
    const req = createMockReq({ method: 'POST', query: { chain: '8453' } })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(405)
  })
})

describe('sendPublicRead helpers', () => {
  it('omits body for HEAD and includes Content-Length', async () => {
    const { sendPublicReadBody, sendPublicReadJson, setPublicCors } = await import(
      '../../server/zora/_shared.ts'
    )
    const req = createMockReq({ method: 'HEAD' })
    const res = createMockRes()
    setPublicCors(res)
    sendPublicReadBody(req, res, 200, Buffer.from('png-bytes'))
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
    expect(String(res.getHeader('content-length'))).toBe(String(Buffer.byteLength('png-bytes')))
    expect(String(res.getHeader('access-control-allow-methods'))).toContain('HEAD')

    const reqJson = createMockReq({ method: 'HEAD' })
    const resJson = createMockRes()
    sendPublicReadJson(reqJson, resJson, 200, { ok: true })
    expect(resJson.statusCode).toBe(200)
    expect(resJson.body).toBeUndefined()
    expect(String(resJson.getHeader('content-type'))).toContain('application/json')
  })
})
