import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getAlfaClubHoldingsMock, getAlfaClubPublicClientMock } = vi.hoisted(() => ({
  getAlfaClubHoldingsMock: vi.fn(),
  getAlfaClubPublicClientMock: vi.fn(),
}))

vi.mock('../../server/_lib/wallet/alfaclub.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/wallet/alfaclub.ts')>(
    '../../server/_lib/wallet/alfaclub.ts',
  )
  return {
    ...actual,
    getAlfaClubHoldings: getAlfaClubHoldingsMock,
    getAlfaClubPublicClient: getAlfaClubPublicClientMock,
  }
})

vi.mock('../../server/_lib/wallet/walletIntelligenceCache.js', () => ({
  getCachedEntityLabels: vi.fn(async () => null),
  cacheEntityLabels: vi.fn(async () => undefined),
}))

import { getWalletLabelsForAddress } from '../../server/_lib/wallet/walletLabels.ts'

const KEY_HOLDER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const CREATOR = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const UNKNOWN = '0xcccccccccccccccccccccccccccccccccccccccc'
const FRIEND_KEY = '0xaf0bf8593dc6ca973df2132731b0f9b5f974fa9f'
const FRIEND_STAKE = '0x53bdefb3e2faeb90b766b459af96f3e357d3c3f9'
const FRIEND_POOL = '0xa1bf9bb17c283cf17f01516f78f3127d2c84c79d'

// Ensure no external APIs get hit by accident.
const originalFetch = globalThis.fetch
beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ETHERSCAN_API_KEY
  delete process.env.WALLET_LABELS_API_KEY
  globalThis.fetch = (async () => {
    throw new Error('network disabled in this test')
  }) as typeof fetch
  getAlfaClubPublicClientMock.mockResolvedValue({
    getLogs: vi.fn(async () => []),
    readContract: vi.fn(async () => 0n),
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('walletLabels: AlfaClub known-address entries', () => {
  it('tags the FriendKey proxy as AlfaClub Keys via the known-address source', async () => {
    getAlfaClubHoldingsMock.mockResolvedValue({
      address: FRIEND_KEY,
      holdings: [],
      isCreator: false,
      isHolder: false,
    })
    const result = await getWalletLabelsForAddress(FRIEND_KEY, 8453)
    expect(result.isKnownEntity).toBe(true)
    expect(result.labels).toHaveLength(1)
    expect(result.labels[0]).toMatchObject({
      name: 'AlfaClub Keys (FriendKey)',
      category: 'social',
      subcategory: 'alfaclub',
      source: 'known-address',
    })
  })

  it('tags the FriendStake beacon as AlfaClub Stake Beacon', async () => {
    const result = await getWalletLabelsForAddress(FRIEND_STAKE, 8453)
    expect(result.labels[0]?.name).toBe('AlfaClub Stake Beacon (FriendStake)')
    expect(result.labels[0]?.source).toBe('known-address')
  })

  it('tags the FriendPool as AlfaClub Pool', async () => {
    const result = await getWalletLabelsForAddress(FRIEND_POOL, 8453)
    expect(result.labels[0]?.name).toBe('AlfaClub Pool (FriendPool)')
  })
})

describe('walletLabels: AlfaClub on-chain detector', () => {
  it('labels a keyholder via the alfaclub source when onchain holdings exist', async () => {
    getAlfaClubHoldingsMock.mockResolvedValue({
      address: KEY_HOLDER,
      holdings: [
        { tokenId: 10n, balance: 2n, creator: CREATOR as `0x${string}` },
        { tokenId: 25n, balance: 1n, creator: CREATOR as `0x${string}` },
      ],
      isCreator: false,
      isHolder: true,
    })

    const result = await getWalletLabelsForAddress(KEY_HOLDER, 8453)
    expect(result.isKnownEntity).toBe(true)
    expect(result.labels).toHaveLength(1)
    expect(result.labels[0]).toMatchObject({
      name: 'AlfaClub keyholder (2 rooms)',
      category: 'social',
      subcategory: 'alfaclub',
      source: 'alfaclub',
    })
  })

  it('labels a creator differently from a plain keyholder', async () => {
    getAlfaClubHoldingsMock.mockResolvedValue({
      address: CREATOR,
      holdings: [{ tokenId: 7n, balance: 1n, creator: CREATOR as `0x${string}` }],
      isCreator: true,
      isHolder: true,
    })

    const result = await getWalletLabelsForAddress(CREATOR, 8453)
    expect(result.labels[0]?.name).toBe('AlfaClub creator (1 room)')
    expect(result.labels[0]?.source).toBe('alfaclub')
  })

  it('returns no labels for addresses with no AlfaClub activity', async () => {
    getAlfaClubHoldingsMock.mockResolvedValue({
      address: UNKNOWN,
      holdings: [],
      isCreator: false,
      isHolder: false,
    })

    const result = await getWalletLabelsForAddress(UNKNOWN, 8453)
    expect(result.isKnownEntity).toBe(false)
    expect(result.labels).toEqual([])
  })

  it('skips the detector on non-Base chains and returns unknown', async () => {
    const result = await getWalletLabelsForAddress(UNKNOWN, 1)
    expect(result.isKnownEntity).toBe(false)
    expect(getAlfaClubHoldingsMock).not.toHaveBeenCalled()
  })

  it('fails open when the detector throws — does not surface an error to callers', async () => {
    getAlfaClubHoldingsMock.mockRejectedValue(new Error('rpc timeout'))

    const result = await getWalletLabelsForAddress(UNKNOWN, 8453)
    expect(result.isKnownEntity).toBe(false)
    expect(result.labels).toEqual([])
  })

  it('does not run the detector for the three core AlfaClub contracts', async () => {
    await getWalletLabelsForAddress(FRIEND_KEY, 8453)
    // Known-address hit returns before the detector is reached.
    expect(getAlfaClubHoldingsMock).not.toHaveBeenCalled()
  })
})
