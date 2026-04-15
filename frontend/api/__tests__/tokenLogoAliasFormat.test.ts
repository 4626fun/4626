import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const SHARE_OFT = '0x7000000000000000000000000000000000000007'

const mocks = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
  blobHeadOrNullMock: vi.fn(),
  blobPutBytesMock: vi.fn(),
  fetchBytesMock: vi.fn(),
  sha256HexMock: vi.fn(),
  getCompletedImageProjectForVaultMock: vi.fn(),
}))

vi.mock('../../server/_lib/blob.js', () => ({
  blobHeadOrNull: mocks.blobHeadOrNullMock,
  blobPutBytes: mocks.blobPutBytesMock,
  fetchBytes: mocks.fetchBytesMock,
  sha256Hex: mocks.sha256HexMock,
}))

vi.mock('../../server/_lib/image/imageProjects.js', () => ({
  getCompletedImageProjectForVault: mocks.getCompletedImageProjectForVaultMock,
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: mocks.createPublicClientMock,
  }
})

describe('token logo alias formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'symbol') return 'AKITA'
        if (functionName === 'vault') return null
        throw new Error(`unexpected_function:${functionName}`)
      }),
    })
    mocks.blobHeadOrNullMock.mockResolvedValue(null)
    mocks.blobPutBytesMock.mockResolvedValue({ url: 'https://blob.local/token.png' })
    mocks.sha256HexMock.mockImplementation(() => 'hash')
    mocks.getCompletedImageProjectForVaultMock.mockResolvedValue(null)
    mocks.fetchBytesMock.mockResolvedValue({
      bytes: new Uint8Array(),
      contentType: 'image/png',
    })
  })

  it('serves v1 logo.png alias as a 64x64 PNG by default', async () => {
    const handler = (await import('../_handlers/token/_image.ts')).default
    expect(handler).toBeTypeOf('function')

    const req = createMockReq({
      method: 'GET',
      query: { address: SHARE_OFT, format: 'png', size: '64', chain: '8453' },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type') ?? '')).toBe('image/png')
    const meta = await sharp(Buffer.from(res.body)).metadata()
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(64)
  })

  it('serves v1 logo.svg alias as an SVG payload by default', async () => {
    const handler = (await import('../_handlers/token/_image.ts')).default
    expect(handler).toBeTypeOf('function')

    const req = createMockReq({
      method: 'GET',
      query: { address: SHARE_OFT, format: 'svg', size: '64', chain: '8453' },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type') ?? '')).toBe('image/svg+xml')
    expect(String(res.body ?? '')).toContain('<svg')
    expect(String(res.body ?? '')).toContain('width="64"')
    expect(String(res.body ?? '')).toContain('height="64"')
  })
})
