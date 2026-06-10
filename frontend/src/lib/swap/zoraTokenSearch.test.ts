import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getAddress } from 'viem'

import { AKITA_DEFAULTS } from '@/config/contracts.defaults'

const {
  fetchZoraCoinMock,
  fetchZoraProfileMock,
  fetchZoraProfileCoinsMock,
} = vi.hoisted(() => ({
  fetchZoraCoinMock: vi.fn(),
  fetchZoraProfileMock: vi.fn(),
  fetchZoraProfileCoinsMock: vi.fn(),
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraCoin: fetchZoraCoinMock,
  fetchZoraProfile: fetchZoraProfileMock,
  fetchZoraProfileCoins: fetchZoraProfileCoinsMock,
}))

import {
  normalizeSwapTokenSearchQuery,
  searchZoraCreatorCoinsForSwap,
  shouldRunZoraSwapTokenSearch,
  zoraCoinToSwapTokenOption,
  zoraCoinsToSwapTokenOptions,
} from './zoraTokenSearch'

describe('zoraTokenSearch', () => {
  beforeEach(() => {
    fetchZoraCoinMock.mockReset()
    fetchZoraProfileMock.mockReset()
    fetchZoraProfileCoinsMock.mockReset()
  })

  it('strips $ and @ from swap search queries', () => {
    expect(normalizeSwapTokenSearchQuery('$akita')).toBe('akita')
    expect(normalizeSwapTokenSearchQuery('@jesse.base.eth')).toBe('jesse.base.eth')
  })

  it('requires at least two characters for non-address zora search', () => {
    expect(shouldRunZoraSwapTokenSearch('a')).toBe(false)
    expect(shouldRunZoraSwapTokenSearch('$akita')).toBe(true)
    expect(shouldRunZoraSwapTokenSearch(AKITA_DEFAULTS.token)).toBe(true)
  })

  it('resolves creator coins from zora profile handles', async () => {
    fetchZoraProfileMock.mockImplementation(async (identifier: string) => {
      if (identifier === 'akita' || identifier === 'akita.base.eth') {
        return {
          creatorCoin: { address: AKITA_DEFAULTS.token },
          createdCoins: { edges: [] },
        }
      }
      return null
    })
    fetchZoraCoinMock.mockResolvedValue({
      address: AKITA_DEFAULTS.token,
      symbol: 'AKITA',
      name: 'AKITA',
      coinType: 'CREATOR',
    })

    const coins = await searchZoraCreatorCoinsForSwap('$akita')
    expect(coins).toHaveLength(1)
    expect(coins[0]?.address?.toLowerCase()).toBe(AKITA_DEFAULTS.token.toLowerCase())
    expect(fetchZoraProfileMock).toHaveBeenCalled()
    expect(fetchZoraCoinMock).toHaveBeenCalledWith(AKITA_DEFAULTS.token, 8453)
  })

  it('maps zora coins into verified swap token options', () => {
    const option = zoraCoinToSwapTokenOption({
      address: AKITA_DEFAULTS.token,
      symbol: 'AKITA',
      name: 'AKITA',
      coinType: 'CREATOR',
      mediaContent: { previewImage: { medium: 'https://example.com/akita.png' } },
    })
    expect(option).toMatchObject({
      address: getAddress(AKITA_DEFAULTS.token),
      symbol: 'AKITA',
      name: 'AKITA',
      group: 'creator',
      verified: true,
      logoUrl: 'https://example.com/akita.png',
    })
    expect(zoraCoinsToSwapTokenOptions([{ address: AKITA_DEFAULTS.token, symbol: 'AKITA' }])).toHaveLength(1)
  })

  it('does not surface opaque zora ids as token symbols', () => {
    const option = zoraCoinToSwapTokenOption({
      address: AKITA_DEFAULTS.token,
      symbol: 'ed6fbda34f2614536df5cec08dff2266',
      name: 'ed6fbda34f2614536df5cec08dff2266',
      coinType: 'CREATOR',
      creatorProfile: { handle: 'akita' },
    })
    expect(option?.symbol).toBe('Akita')
    expect(option?.name).toBe('Creator coin')
  })
})
