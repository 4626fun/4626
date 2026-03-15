import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const SHARE_OFT = '0x7000000000000000000000000000000000000007'
const VAULT = '0x3000000000000000000000000000000000000003'

const ONE_BY_ONE_PNG = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQhW0tMAAAAASUVORK5CYII=',
    'base64',
  ),
)

const mocks = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setPublicCorsMock: vi.fn(),
  getStringQueryMock: vi.fn(),
  getNumberQueryMock: vi.fn(),
  requireServerKeyMock: vi.fn(() => ''),
  createPublicClientMock: vi.fn(),
  getCompletedImageProjectForVaultMock: vi.fn(),
  fetchBytesMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  DEFAULT_CHAIN_ID: 8453,
  handleOptions: mocks.handleOptionsMock,
  setPublicCors: mocks.setPublicCorsMock,
  requireServerKey: mocks.requireServerKeyMock,
  getStringQuery: mocks.getStringQueryMock,
  getNumberQuery: mocks.getNumberQueryMock,
}))

vi.mock('../../server/_lib/blob.js', () => ({
  blobHeadOrNull: vi.fn(),
  blobPutBytes: vi.fn(),
  fetchBytes: mocks.fetchBytesMock,
  sha256Hex: vi.fn(),
}))

vi.mock('../../server/_lib/imageProjects.js', () => ({
  getCompletedImageProjectForVault: mocks.getCompletedImageProjectForVaultMock,
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: mocks.createPublicClientMock,
  }
})

describe('token image AI override lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStringQueryMock.mockImplementation((_req: any, key: string) => {
      if (key === 'address') return SHARE_OFT
      if (key === 'format') return 'svg'
      return null
    })
    mocks.getNumberQueryMock.mockReturnValue(null)
    mocks.createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'symbol') return '■JESSE'
        if (functionName === 'vault') return VAULT
        throw new Error(`unexpected_function:${functionName}`)
      }),
    })
  })

  it('resolves generated override by vault address (not shareOFT address)', async () => {
    mocks.getCompletedImageProjectForVaultMock.mockResolvedValue({
      projectId: 'imgproj_jesse',
      outputBlobUrl: 'https://blob.local/jesse.png',
    })
    mocks.fetchBytesMock.mockResolvedValue({
      bytes: ONE_BY_ONE_PNG,
      contentType: 'image/png',
    })

    const mod = await import('../_handlers/token/_image.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { address: SHARE_OFT, format: 'svg' },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(mocks.getCompletedImageProjectForVaultMock).toHaveBeenCalledWith(VAULT.toLowerCase())
    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type') ?? '')).toBe('image/svg+xml')
    expect(String(res.body ?? '')).toContain('data:image/png;base64,')
  })
})
