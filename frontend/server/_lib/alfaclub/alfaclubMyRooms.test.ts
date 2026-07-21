import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import type {
  AlfaClubHoldingsResult,
  AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { listMyAlfaClubRoomIds } from './alfaclubMyRooms.js'

const SESSION_EOA = '0x1111111111111111111111111111111111111111'
const CANONICAL_CSW = '0x2222222222222222222222222222222222222222' as Address

describe('AlfaClub My Rooms', () => {
  it('checks FriendKey balances only for the resolved canonical parent CSW', async () => {
    const client = {} as AlfaClubPublicClientLike
    const getHoldings = vi.fn(
      async (address: Address): Promise<AlfaClubHoldingsResult> => ({
        address,
        holdings: [
          { tokenId: 1659n, balance: 2n, creator: CANONICAL_CSW },
          { tokenId: 97n, balance: 1n, creator: CANONICAL_CSW },
        ],
        isCreator: true,
        isHolder: true,
      }),
    )

    const result = await listMyAlfaClubRoomIds(SESSION_EOA, {
      resolveCanonicalCsw: async () => CANONICAL_CSW,
      getPublicClient: async () => client,
      getHoldings,
    })

    expect(getHoldings).toHaveBeenCalledWith(CANONICAL_CSW, client)
    expect(getHoldings).not.toHaveBeenCalledWith(SESSION_EOA, client)
    expect(result).toEqual({
      canonicalCswAddress: CANONICAL_CSW,
      roomIds: ['1659', '97'],
      keys: [
        { tokenId: '1659', balance: '2', creator: CANONICAL_CSW },
        { tokenId: '97', balance: '1', creator: CANONICAL_CSW },
      ],
    })
  })

  it('does not fall back to a session or delegated signer when no canonical CSW exists', async () => {
    const getPublicClient = vi.fn()
    const getHoldings = vi.fn()

    await expect(
      listMyAlfaClubRoomIds(SESSION_EOA, {
        resolveCanonicalCsw: async () => null,
        getPublicClient,
        getHoldings,
      }),
    ).resolves.toEqual({ canonicalCswAddress: null, roomIds: [], keys: [] })

    expect(getPublicClient).not.toHaveBeenCalled()
    expect(getHoldings).not.toHaveBeenCalled()
  })
})
