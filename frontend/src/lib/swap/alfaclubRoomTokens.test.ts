import { describe, expect, it } from 'vitest'

import { ALFACLUB } from '@/lib/alfaclub/contracts'
import type { AlfaClubRoomDirectoryItem } from '@/lib/alfaclub/roomDirectory'

import { resolveAlfaClubKeys } from './alfaclubRoomTokens'

function key(overrides: Partial<AlfaClubRoomDirectoryItem> & Pick<AlfaClubRoomDirectoryItem, 'roomId' | 'roomName'>): AlfaClubRoomDirectoryItem {
  return {
    displayLabel: overrides.roomName, creatorHandle: null, roomType: 'trading', tier: 'club', keySupply: 10,
    roomPoints: 100, keyPriceUsdc: 1, buyPriceUsdc: 1, sellPriceUsdc: 1, volumeUsdc: 100,
    feesGeneratedUsdc: 1, tradingFundUsdc: 10, pnlUsdc: 0, pnlPct7d: 0, pnlPct30d: 0,
    pnlPctAllTime: 0, imageUrl: null, description: null, featured: false, uniqueHolders: 3,
    ingestedAt: '2026-07-19T00:00:00.000Z', ...overrides,
  }
}

describe('resolveAlfaClubKeys', () => {
  it('uses the FriendKey ERC-1155 contract and token id, never a creator coin', () => {
    const [resolved] = resolveAlfaClubKeys({ rooms: [key({ roomId: '1659', roomName: 'AKITA' })] })
    expect(resolved).toMatchObject({
      assetKind: 'erc1155-key', contractAddress: ALFACLUB.friendKey, keyId: '1659', label: 'AKITA',
    })
  })

  it('keeps #1659 available before the directory loads', () => {
    const fallback = resolveAlfaClubKeys({ rooms: [] })[0]
    expect(fallback).toBeDefined()
    if (!fallback) throw new Error('expected_alfaclub_key_fallback')
    expect(fallback).toMatchObject({
      assetKind: 'erc1155-key', keyId: '1659', label: 'AKITA',
    })
    expect(fallback.imageUrl).toBeTruthy()
  })
})
