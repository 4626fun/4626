import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/zora/_profileCoins.ts'
import { createMockReq, createMockRes } from './helpers'

const { getProfileCoinsMock, setApiKeyMock } = vi.hoisted(() => ({
  getProfileCoinsMock: vi.fn(),
  setApiKeyMock: vi.fn(),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  getProfileCoins: getProfileCoinsMock,
  setApiKey: setApiKeyMock,
}))

vi.mock('../../server/zora/_shared.js', () => ({
  DEFAULT_CHAIN_ID: 8453,
  getNumberQuery: vi.fn((req: any, key: string) => {
    const value = req.query?.[key]
    return value == null ? null : Number(value)
  }),
  getStringQuery: vi.fn((req: any, key: string) => req.query?.[key] ?? null),
  handleOptions: vi.fn(() => false),
  requireServerKey: vi.fn(() => 'test-zora-key'),
  setCache: vi.fn(),
  setCors: vi.fn(),
}))

function makeCoins(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    node: {
      id: `coin-${start + index}`,
      address: `0x${String(start + index).padStart(40, '0')}`,
      name: `Coin ${start + index}`,
      symbol: `C${start + index}`,
      coinType: 'CONTENT',
    },
    cursor: `cursor-${start + index}`,
  }))
}

describe('GET /api/zora/profileCoins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProfileCoinsMock
      .mockResolvedValueOnce({
        data: {
          profile: {
            handle: 'akita',
            createdCoins: {
              edges: makeCoins(1, 50),
              pageInfo: { hasNextPage: true, endCursor: 'cursor-50' },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          profile: {
            handle: 'akita',
            createdCoins: {
              edges: makeCoins(51, 50),
              pageInfo: { hasNextPage: true, endCursor: 'cursor-100' },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          profile: {
            handle: 'akita',
            createdCoins: {
              edges: makeCoins(101, 20),
              pageInfo: { hasNextPage: false, endCursor: 'cursor-120' },
            },
          },
        },
      })
  })

  it('accumulates profile coins across multiple cursor pages up to the requested count', async () => {
    const req = createMockReq({
      method: 'GET',
      query: {
        identifier: 'akita',
        count: '120',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.createdCoins?.edges).toHaveLength(120)
    expect(res.body?.data?.createdCoins?.pageInfo).toEqual({
      hasNextPage: false,
      endCursor: 'cursor-120',
    })
    expect(getProfileCoinsMock).toHaveBeenCalledTimes(3)
    expect(getProfileCoinsMock).toHaveBeenNthCalledWith(1, {
      identifier: 'akita',
      count: 50,
      after: undefined,
      chainIds: [8453],
    })
    expect(getProfileCoinsMock).toHaveBeenNthCalledWith(2, {
      identifier: 'akita',
      count: 50,
      after: 'cursor-50',
      chainIds: [8453],
    })
  })
})
