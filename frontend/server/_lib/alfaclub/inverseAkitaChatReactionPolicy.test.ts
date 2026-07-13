import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAlfaClubPublicClient, mockReadContract, mockResolveStakerAccess } = vi.hoisted(
  () => ({
    mockGetAlfaClubPublicClient: vi.fn(),
    mockReadContract: vi.fn(),
    mockResolveStakerAccess: vi.fn(),
  }),
)

vi.mock('../wallet/alfaclub.js', async () => {
  const actual = await vi.importActual<typeof import('../wallet/alfaclub.js')>(
    '../wallet/alfaclub.js',
  )
  return {
    ...actual,
    getAlfaClubPublicClient: mockGetAlfaClubPublicClient,
  }
})

vi.mock('./inverseAkitaStakerPilot.js', () => ({
  resolveInverseAkitaStakerPilotAccess: mockResolveStakerAccess,
}))

import {
  INVERSE_AKITA_OWNER_ONLY_ROOM_IDS,
  isInverseAkitaChatReactionRoom,
  readInverseAkitaChatReactionRoomIds,
  resolveInverseAkitaChatAuthorAccess,
} from './inverseAkitaChatReactionPolicy.js'

const OWNER = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'

describe('inverseAkitaChatReactionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS',
      '1484,1660,2,1043,1659',
    )
    mockGetAlfaClubPublicClient.mockResolvedValue({ readContract: mockReadContract })
    mockReadContract.mockResolvedValue(OWNER)
    mockResolveStakerAccess.mockResolvedValue({
      eligible: true,
      stakedKeys: 1,
      reason: 'staker',
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to room 1659 and drops unsupported configured room ids', () => {
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '')
    expect(readInverseAkitaChatReactionRoomIds()).toEqual(['1659'])

    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '1484,9999,1659,1484')
    expect(readInverseAkitaChatReactionRoomIds()).toEqual(['1484', '1659'])
    expect(isInverseAkitaChatReactionRoom('9999')).toBe(false)
  })

  it.each(INVERSE_AKITA_OWNER_ONLY_ROOM_IDS)(
    'allows only the on-chain creator in owner-only room %s',
    async (roomId) => {
      await expect(
        resolveInverseAkitaChatAuthorAccess({ roomId, senderAddress: OWNER }),
      ).resolves.toEqual({ eligible: true, reason: 'owner', stakedKeys: null })
      await expect(
        resolveInverseAkitaChatAuthorAccess({ roomId, senderAddress: OTHER }),
      ).resolves.toEqual({
        eligible: false,
        reason: 'not_room_owner',
        stakedKeys: null,
      })
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'creatorByTokenId',
          args: [BigInt(roomId)],
        }),
      )
    },
  )

  it('fails closed when the room owner read fails', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('rpc unavailable'))
    await expect(
      resolveInverseAkitaChatAuthorAccess({ roomId: '1484', senderAddress: OWNER }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'owner_read_failed',
      stakedKeys: null,
    })
  })

  it('requires stake from the room-1659 owner with no owner bypass', async () => {
    mockResolveStakerAccess.mockResolvedValueOnce({
      eligible: false,
      stakedKeys: 0,
      reason: 'insufficient_stake',
    })
    await expect(
      resolveInverseAkitaChatAuthorAccess({ roomId: '1659', senderAddress: OWNER }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'insufficient_stake',
      stakedKeys: 0,
    })
    expect(mockResolveStakerAccess).toHaveBeenCalledWith({
      senderAddress: OWNER,
      roomId: '1659',
      isTrustedOperator: false,
    })
    expect(mockReadContract).not.toHaveBeenCalled()
  })
})
