import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAlfaClubPublicClient = vi.fn()
const mockResolveStakingPoolAddress = vi.fn()
const mockReadUserStakedKeys = vi.fn()

vi.mock('../wallet/alfaclub.js', () => ({
  getAlfaClubPublicClient: () => mockGetAlfaClubPublicClient(),
}))

vi.mock('./alfaclubStakeReads.js', () => ({
  resolveStakingPoolAddress: (...args: unknown[]) => mockResolveStakingPoolAddress(...args),
  readUserStakedKeys: (...args: unknown[]) => mockReadUserStakedKeys(...args),
}))

import {
  INVERSE_AKITA_ROOM_ID,
  canPilotInverseAkita,
  formatInverseAkitaStakerPilotGateReply,
  isInverseAkitaPilotRoom,
  resolveInverseAkitaStakerPilotAccess,
} from './inverseAkitaStakerPilot.js'

describe('inverseAkitaStakerPilot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAlfaClubPublicClient.mockResolvedValue({})
    mockResolveStakingPoolAddress.mockResolvedValue('0x00000000000000000000000000000000000000aa')
    mockReadUserStakedKeys.mockResolvedValue(0)
  })

  it('recognizes room 1659 as the pilot room', () => {
    expect(isInverseAkitaPilotRoom('1659')).toBe(true)
    expect(isInverseAkitaPilotRoom('1660')).toBe(false)
    expect(isInverseAkitaPilotRoom(null)).toBe(false)
  })

  it('grants operator bypass without stake read', async () => {
    const access = await resolveInverseAkitaStakerPilotAccess({
      senderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      roomId: INVERSE_AKITA_ROOM_ID,
      isTrustedOperator: true,
    })
    expect(access).toEqual({ eligible: true, stakedKeys: null, reason: 'operator' })
    expect(mockReadUserStakedKeys).not.toHaveBeenCalled()
  })

  it('grants staker pilot when stakedKeys >= 1', async () => {
    mockReadUserStakedKeys.mockResolvedValue(2)
    const access = await resolveInverseAkitaStakerPilotAccess({
      senderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      roomId: INVERSE_AKITA_ROOM_ID,
      isTrustedOperator: false,
    })
    expect(access).toEqual({ eligible: true, stakedKeys: 2, reason: 'staker' })
  })

  it('denies when stakedKeys are zero', async () => {
    mockReadUserStakedKeys.mockResolvedValue(0)
    const access = await resolveInverseAkitaStakerPilotAccess({
      senderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      roomId: INVERSE_AKITA_ROOM_ID,
      isTrustedOperator: false,
    })
    expect(access).toEqual({ eligible: false, stakedKeys: 0, reason: 'insufficient_stake' })
  })

  it('combines pilot access for room 1659 only', () => {
    expect(
      canPilotInverseAkita({
        roomId: INVERSE_AKITA_ROOM_ID,
        isTrustedOperator: false,
        pilotAccess: { eligible: true, stakedKeys: 1, reason: 'staker' },
      }),
    ).toBe(true)
    expect(
      canPilotInverseAkita({
        roomId: '2000',
        isTrustedOperator: true,
        pilotAccess: null,
      }),
    ).toBe(true)
    expect(
      canPilotInverseAkita({
        roomId: '2000',
        isTrustedOperator: false,
        pilotAccess: { eligible: true, stakedKeys: 1, reason: 'staker' },
      }),
    ).toBe(false)
    expect(
      canPilotInverseAkita({
        roomId: INVERSE_AKITA_ROOM_ID,
        isTrustedOperator: true,
        pilotAccess: null,
      }),
    ).toBe(true)
  })

  it('mentions retired mirror flow in gate copy', () => {
    expect(formatInverseAkitaStakerPilotGateReply()).toContain('Mirrored counter-trading is retired')
    expect(formatInverseAkitaStakerPilotGateReply()).toContain('/h arena long')
  })
})
