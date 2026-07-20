import { describe, expect, it } from 'vitest'

import { AKITA_DEFAULTS } from '@/config/contracts.defaults'
import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'

import { resolveAlfaClubRoomTokens } from './alfaclubRoomTokens'

function creatorOption(
  overrides: Partial<SwapTokenOption> & Pick<SwapTokenOption, 'address' | 'symbol'>,
): SwapTokenOption {
  return {
    name: overrides.symbol,
    group: 'creator',
    sectionTag: 'creator',
    verified: true,
    chainId: 8453,
    ...overrides,
  }
}

function room(
  overrides: Partial<AlfaClubRoomDirectoryItem> & Pick<AlfaClubRoomDirectoryItem, 'roomId' | 'roomName'>,
): AlfaClubRoomDirectoryItem {
  return {
    displayLabel: overrides.roomName,
    creatorHandle: null,
    roomType: 'trading',
    tier: 'club',
    keySupply: 10,
    roomPoints: 100,
    keyPriceUsdc: 1,
    buyPriceUsdc: 1,
    sellPriceUsdc: 1,
    volumeUsdc: 100,
    feesGeneratedUsdc: 1,
    tradingFundUsdc: 10,
    pnlUsdc: 0,
    pnlPct7d: 0,
    pnlPct30d: 0,
    pnlPctAllTime: 0,
    imageUrl: null,
    description: null,
    featured: false,
    uniqueHolders: 3,
    ingestedAt: '2026-07-19T00:00:00.000Z',
    ...overrides,
  }
}

describe('resolveAlfaClubRoomTokens', () => {
  it('always surfaces the curated Room 1659 AKITA pin', () => {
    const resolved = resolveAlfaClubRoomTokens({ tokenOptions: [] })
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.address.toLowerCase()).toBe(AKITA_DEFAULTS.token.toLowerCase())
    expect(resolved[0]?.alfaclubRoomId).toBe('1659')
    expect(resolved[0]?.symbol).toBe('AKITA')
  })

  it('prefers matching token-option metadata and enriches from room directory', () => {
    const akita = creatorOption({
      address: AKITA_DEFAULTS.token,
      symbol: 'AKITA',
      name: 'Akita Inu',
      logoUrl: 'https://example.com/akita.png',
    })
    const resolved = resolveAlfaClubRoomTokens({
      tokenOptions: [akita],
      rooms: [
        room({
          roomId: '1659',
          roomName: 'AKITA',
          imageUrl: 'https://example.com/room.gif',
          featured: true,
          volumeUsdc: 5000,
        }),
      ],
    })

    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.name).toContain('AKITA')
    expect(resolved[0]?.logoUrl).toBe('https://example.com/room.gif')
    expect(resolved[0]?.alfaclubRoomId).toBe('1659')
  })

  it('matches additional featured rooms to creator coins by room name', () => {
    const flip = creatorOption({
      address: '0x1111111111111111111111111111111111111111',
      symbol: 'FLIP',
      name: 'FLIP creator coin',
    })
    const resolved = resolveAlfaClubRoomTokens({
      tokenOptions: [flip],
      rooms: [
        room({
          roomId: '42',
          roomName: 'FLIP',
          featured: true,
          volumeUsdc: 9000,
        }),
        room({
          roomId: '7',
          roomName: 'NOMATCH',
          featured: true,
          volumeUsdc: 8000,
        }),
      ],
    })

    expect(resolved.map((option) => option.symbol)).toEqual(['AKITA', 'FLIP'])
    expect(resolved[1]?.alfaclubRoomId).toBe('42')
  })
})
