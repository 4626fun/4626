import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_coin.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  requireServerKeyMock,
  sdkSetApiKeyMock,
  getCoinMock,
  loadMergedCreatorEthosByAddressesMock,
} = vi.hoisted(() => ({
  requireServerKeyMock: vi.fn(),
  sdkSetApiKeyMock: vi.fn(),
  getCoinMock: vi.fn(),
  loadMergedCreatorEthosByAddressesMock: vi.fn(),
}))

vi.mock('../../server/_lib/zora/creatorEthosProjection.js', () => ({
  loadMergedCreatorEthosByAddresses: loadMergedCreatorEthosByAddressesMock,
}))

vi.mock('../../server/zora/_shared.js', () => ({
  DEFAULT_CHAIN_ID: 8453,
  getNumberQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  getStringQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptions: vi.fn(() => false),
  isAddressLike: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
  requireServerKey: requireServerKeyMock,
  setCache: vi.fn(),
  setCors: vi.fn(),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  setApiKey: sdkSetApiKeyMock,
  getCoin: getCoinMock,
}))

describe('zora coin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireServerKeyMock.mockReturnValue('test-zora-key')
    loadMergedCreatorEthosByAddressesMock.mockResolvedValue(new Map())
  })

  it('attaches projection-backed ethos fields to the coin payload', async () => {
    const creatorAddress = '0x1111111111111111111111111111111111111111'
    getCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          address: '0x2222222222222222222222222222222222222222',
          creatorAddress,
          symbol: 'TEST',
        },
      },
    })
    loadMergedCreatorEthosByAddressesMock.mockResolvedValue(
      new Map([
        [
          creatorAddress,
          {
            creatorAddress,
            score: 1842,
            level: 'reputable',
            source: 'creator_ethos_projection',
          },
        ],
      ]),
    )

    const req = createMockReq({
      query: { address: '0x2222222222222222222222222222222222222222' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ethosScore).toBe(1842)
    expect(res.body?.data?.ethosLevel).toBe('reputable')
    expect(res.body?.data?.ethosScoreSource).toBe('creator_ethos_projection')
    expect(loadMergedCreatorEthosByAddressesMock).toHaveBeenCalledWith([creatorAddress])
  })

  it('returns the coin unchanged when ethos merge has no score', async () => {
    getCoinMock.mockResolvedValue({
      data: {
        zora20Token: {
          address: '0x2222222222222222222222222222222222222222',
          creatorAddress: '0x1111111111111111111111111111111111111111',
          symbol: 'TEST',
        },
      },
    })

    const req = createMockReq({
      query: { address: '0x2222222222222222222222222222222222222222' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ethosScore).toBeUndefined()
    expect(res.body?.data?.symbol).toBe('TEST')
  })
})
