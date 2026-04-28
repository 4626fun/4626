import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAlfaClubPublicClientMock, getAlfaClubHoldingsMock } = vi.hoisted(() => {
  type AlfaClubHoldingMock = { tokenId: bigint }
  type AlfaClubHoldingsMockResult = {
    holdings: AlfaClubHoldingMock[]
    isHolder: boolean
    isCreator: boolean
  }

  return {
    getAlfaClubPublicClientMock: vi.fn(async () => ({})),
    getAlfaClubHoldingsMock: vi.fn(async (): Promise<AlfaClubHoldingsMockResult> => ({
      holdings: [],
      isHolder: false,
      isCreator: false,
    })),
  }
})

vi.mock('../wallet/alfaclub.js', () => ({
  getAlfaClubPublicClient: getAlfaClubPublicClientMock,
  getAlfaClubHoldings: getAlfaClubHoldingsMock,
}))

import { _resetHermitRoomOwnerCacheForTests, isHermitRoomAllowedForOwner } from './policy'

describe('isHermitRoomAllowedForOwner', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.HERMIT_ALLOWED_ROOM_IDS
    _resetHermitRoomOwnerCacheForTests()
  })

  it('uses explicit room allowlist when configured', async () => {
    process.env.HERMIT_ALLOWED_ROOM_IDS = '1043,2048'

    const allowed = await isHermitRoomAllowedForOwner({
      roomId: '1043',
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    const denied = await isHermitRoomAllowedForOwner({
      roomId: '9999',
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(allowed).toBe(true)
    expect(denied).toBe(false)
    expect(getAlfaClubHoldingsMock).not.toHaveBeenCalled()
  })

  it('allows room when owner holds that room key token id', async () => {
    getAlfaClubHoldingsMock.mockResolvedValueOnce({
      holdings: [{ tokenId: 1043n }, { tokenId: 7n }],
      isHolder: true,
      isCreator: false,
    })

    const allowed = await isHermitRoomAllowedForOwner({
      roomId: '1043',
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(allowed).toBe(true)
    expect(getAlfaClubPublicClientMock).toHaveBeenCalledTimes(1)
    expect(getAlfaClubHoldingsMock).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expect.anything(),
    )
  })

  it('denies room when owner does not hold that token id', async () => {
    getAlfaClubHoldingsMock.mockResolvedValueOnce({
      holdings: [{ tokenId: 55n }],
      isHolder: true,
      isCreator: false,
    })

    const allowed = await isHermitRoomAllowedForOwner({
      roomId: '1043',
      ownerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(allowed).toBe(false)
  })
})
