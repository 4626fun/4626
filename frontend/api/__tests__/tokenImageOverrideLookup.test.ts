import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

import { createMockReq, createMockRes } from './helpers'

const SHARE_OFT = '0x7000000000000000000000000000000000000007'
const VAULT = '0x3000000000000000000000000000000000000003'

async function createSourcePng(): Promise<Uint8Array> {
  const bytes = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 4,
      background: { r: 85, g: 170, b: 238, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
  return new Uint8Array(bytes)
}

const mocks = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setPublicCorsMock: vi.fn(),
  getStringQueryMock: vi.fn(),
  getNumberQueryMock: vi.fn(),
  requireServerKeyMock: vi.fn(() => ''),
  createPublicClientMock: vi.fn(),
  getCompletedImageProjectForVaultMock: vi.fn(),
  blobHeadOrNullMock: vi.fn(),
  blobPutBytesMock: vi.fn(),
  sha256HexMock: vi.fn(),
  fetchBytesMock: vi.fn(),
  sdkSetApiKeyMock: vi.fn(),
  sdkGetCoinMock: vi.fn(),
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
  blobHeadOrNull: mocks.blobHeadOrNullMock,
  blobPutBytes: mocks.blobPutBytesMock,
  fetchBytes: mocks.fetchBytesMock,
  sha256Hex: mocks.sha256HexMock,
}))

vi.mock('../../server/_lib/image/imageProjects.js', () => ({
  getCompletedImageProjectForVault: mocks.getCompletedImageProjectForVaultMock,
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: mocks.sdkSetApiKeyMock,
  getCoin: mocks.sdkGetCoinMock,
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
    mocks.requireServerKeyMock.mockReturnValue('')
    mocks.sdkSetApiKeyMock.mockReset()
    mocks.sdkGetCoinMock.mockReset()
    mocks.blobHeadOrNullMock.mockResolvedValue(null)
    mocks.blobPutBytesMock.mockResolvedValue({ url: 'https://blob.local/token.png' })
    mocks.sha256HexMock.mockImplementation((value: unknown) =>
      typeof value === 'string' && value.length > 0 ? `hash-${value.length}` : 'hash',
    )
  })

  it('resolves generated override by vault address (not shareOFT address)', async () => {
    const sourcePng = await createSourcePng()
    mocks.getCompletedImageProjectForVaultMock.mockResolvedValue({
      projectId: 'imgproj_jesse',
      outputBlobUrl: 'https://blob.local/jesse.png',
    })
    mocks.fetchBytesMock.mockResolvedValue({
      bytes: sourcePng,
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
  }, 30_000)

  it('skips vault-scoped AI override for creator-coin image lookups', async () => {
    const sourcePng = await createSourcePng()
    mocks.getStringQueryMock.mockImplementation((_req: any, key: string) => {
      if (key === 'address') return SHARE_OFT
      if (key === 'format') return 'svg'
      if (key === 'tokenKind') return 'creator'
      return null
    })
    mocks.requireServerKeyMock.mockReturnValue('zora_test_key')
    mocks.sdkGetCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          symbol: 'AKITA',
          mediaContent: { originalUri: 'https://cdn.example/akita.png' },
          creatorProfile: { handle: 'akita' },
        },
      },
    })
    mocks.fetchBytesMock.mockResolvedValue({
      bytes: sourcePng,
      contentType: 'image/png',
    })

    const mod = await import('../_handlers/token/_image.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { address: SHARE_OFT, format: 'svg', tokenKind: 'creator' },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(mocks.getCompletedImageProjectForVaultMock).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type') ?? '')).toBe('image/svg+xml')
  }, 30_000)

  it('serves creator lookups from Zora artwork without writing framed blob cache', async () => {
    const sourcePng = await createSourcePng()
    mocks.getStringQueryMock.mockImplementation((_req: any, key: string) => {
      if (key === 'address') return SHARE_OFT
      if (key === 'tokenKind') return 'creator'
      return null
    })
    mocks.requireServerKeyMock.mockReturnValue('zora_test_key')
    mocks.sdkGetCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          symbol: 'AKITA',
          mediaContent: { originalUri: 'https://cdn.example/akita.png' },
          creatorProfile: { handle: 'akita' },
        },
      },
    })
    mocks.fetchBytesMock.mockResolvedValue({
      bytes: sourcePng,
      contentType: 'image/png',
    })

    const mod = await import('../_handlers/token/_image.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { address: SHARE_OFT, tokenKind: 'creator' },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.getHeader('content-type') ?? '')).toBe('image/png')
    expect(mocks.blobPutBytesMock).not.toHaveBeenCalled()
    expect(mocks.getCompletedImageProjectForVaultMock).not.toHaveBeenCalled()
  }, 30_000)
})
