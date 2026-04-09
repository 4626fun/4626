import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'
import { getApiHandler } from '../_handlers/_routes.ts'

import { getAddress } from 'viem'

const TOKEN = '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd'

const mocks = vi.hoisted(() => ({
  readContractMock: vi.fn(),
  blobHeadOrNullMock: vi.fn(),
  fetchBytesMock: vi.fn(),
}))

vi.mock('../../server/_lib/blob.js', () => ({
  blobHeadOrNull: mocks.blobHeadOrNullMock,
  fetchBytes: mocks.fetchBytesMock,
  blobPutBytes: vi.fn(),
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContractMock,
    })),
  }
})

describe('managed tokenlist endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.blobHeadOrNullMock.mockResolvedValue(null)

    mocks.readContractMock.mockImplementation(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'name') return 'Akita Share'
      if (functionName === 'symbol') return 'AKITA'
      if (functionName === 'decimals') return 18n
      throw new Error(`unexpected_function:${functionName}`)
    })
    process.env.MANAGED_TOKENLIST_SHAREOFTS_JSON = JSON.stringify({ shareOfts: [TOKEN] })
  })

  it('returns a TokenLists-compatible multi-token payload with canonical logoURI shapes', async () => {
    const handler = await getApiHandler('tokenlist')
    expect(handler).toBeTypeOf('function')

    const handlerJson = await getApiHandler('tokenlist.json')
    expect(handlerJson).toBeNull()

    const legacySingleTokenListAlias = await getApiHandler('token/tokenlist')
    expect(legacySingleTokenListAlias).toBeNull()

    const req = createMockReq({
      method: 'GET',
      query: { chain: '8453' },
      headers: { host: 'api.4626.fun' },
    })
    const res = createMockRes()

    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.tokens).toBeTruthy()
    expect(res.body?.version).toMatchObject({ major: 1, minor: 0, patch: 0 })

    const token = res.body?.tokens?.[0]
    expect(token).toMatchObject({
      chainId: 8453,
      address: getAddress(TOKEN),
      decimals: 18,
      name: 'Akita Share',
      symbol: 'AKITA',
    })
    expect(token.logoURI).toContain(`/v1/token/${TOKEN.toLowerCase()}/logo.png?chain=8453`)
    expect(token.extensions?.logoSVG).toContain(`/v1/token/${TOKEN.toLowerCase()}/logo.svg?chain=8453`)
    expect(String(token.logoURI).startsWith('https://')).toBe(true)
  })
})
