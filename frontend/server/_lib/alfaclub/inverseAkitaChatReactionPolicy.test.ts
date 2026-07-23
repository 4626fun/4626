import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAlfaClubPublicClient,
  mockResolveStakingPoolAddress,
  mockReadUserStakedKeys,
} = vi.hoisted(() => ({
  mockGetAlfaClubPublicClient: vi.fn(),
  mockResolveStakingPoolAddress: vi.fn(),
  mockReadUserStakedKeys: vi.fn(),
}))

vi.mock('../wallet/alfaclub.js', async () => {
  const actual = await vi.importActual<typeof import('../wallet/alfaclub.js')>(
    '../wallet/alfaclub.js',
  )
  return {
    ...actual,
    getAlfaClubPublicClient: mockGetAlfaClubPublicClient,
  }
})

vi.mock('./alfaclubStakeReads.js', () => ({
  resolveStakingPoolAddress: mockResolveStakingPoolAddress,
  readUserStakedKeys: mockReadUserStakedKeys,
}))

import {
  INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS,
  isInverseAkitaChatReactionRoom,
  readInverseAkitaChatReactionRoomIds,
  resolveInverseAkitaChatAuthorAccess,
  setInverseAkitaRuntimeReactionRoomIds,
} from './inverseAkitaChatReactionPolicy.js'

const STAKER = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const POOL = '0x3333333333333333333333333333333333333333'

describe('inverseAkitaChatReactionPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv(
      'ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS',
      '1484,1660,2,1043,1659',
    )
    mockGetAlfaClubPublicClient.mockResolvedValue({})
    mockResolveStakingPoolAddress.mockResolvedValue(POOL)
    mockReadUserStakedKeys.mockResolvedValue(0)
  })

  afterEach(() => {
    setInverseAkitaRuntimeReactionRoomIds([])
    vi.unstubAllEnvs()
  })

  it('defaults to room 1659 and accepts explicit numeric room ids', () => {
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '')
    expect(readInverseAkitaChatReactionRoomIds()).toEqual(['1659'])

    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '1484,9999,1659,1484')
    expect(readInverseAkitaChatReactionRoomIds()).toEqual(['1484', '9999', '1659'])
    expect(isInverseAkitaChatReactionRoom('9999')).toBe(true)
  })

  it.each(INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS)(
    'allows a ≥1 staker in reaction room %s',
    async (roomId) => {
      mockReadUserStakedKeys.mockResolvedValueOnce(1)
      await expect(
        resolveInverseAkitaChatAuthorAccess({ roomId, senderAddress: STAKER }),
      ).resolves.toEqual({
        eligible: true,
        reason: 'staker',
        stakedKeys: 1,
        stakeRoomId: roomId,
      })
      expect(mockResolveStakingPoolAddress).toHaveBeenCalledWith({}, BigInt(roomId))
    },
  )

  it('requires stake in the message room, not another configured room', async () => {
    mockReadUserStakedKeys.mockResolvedValueOnce(0)

    await expect(
      resolveInverseAkitaChatAuthorAccess({
        roomId: '1484',
        senderAddress: STAKER,
      }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'insufficient_stake',
      stakedKeys: 0,
    })
  })

  it('rejects when the sender has no stake in any configured reaction room', async () => {
    mockReadUserStakedKeys.mockResolvedValue(0)
    await expect(
      resolveInverseAkitaChatAuthorAccess({
        roomId: '1484',
        senderAddress: OTHER,
      }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'insufficient_stake',
      stakedKeys: 0,
    })
  })

  it('fails closed when every stake read fails', async () => {
    mockReadUserStakedKeys.mockResolvedValue(null)
    await expect(
      resolveInverseAkitaChatAuthorAccess({ roomId: '1484', senderAddress: STAKER }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'stake_read_failed',
      stakedKeys: null,
    })
  })

  it('requires stake in room 1659 with no owner bypass', async () => {
    mockReadUserStakedKeys.mockResolvedValue(0)
    await expect(
      resolveInverseAkitaChatAuthorAccess({ roomId: '1659', senderAddress: STAKER }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'insufficient_stake',
      stakedKeys: 0,
    })
    expect(mockResolveStakingPoolAddress).toHaveBeenCalled()
  })

  it('treats auto-discovered rooms as listen-only unless allowlisted for trade', async () => {
    vi.stubEnv('ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS', '1659')
    setInverseAkitaRuntimeReactionRoomIds(['7777'])

    await expect(
      resolveInverseAkitaChatAuthorAccess({
        roomId: '7777',
        senderAddress: STAKER,
        configuredRoomIds: readInverseAkitaChatReactionRoomIds(),
      }),
    ).resolves.toEqual({
      eligible: false,
      reason: 'room_listen_only',
      stakedKeys: null,
    })
  })
})
