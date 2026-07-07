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
  INVERSE_AKITA_PILOT_RULES_MAX_CHARS,
  canPilotInverseAkita,
  formatInverseAkitaPilotRules,
  formatInverseAkitaStakerPilotGateReply,
  isInverseAkitaPilotRoom,
  resolveInverseAkitaStakerPilotAccess,
} from './inverseAkitaStakerPilot.js'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'

function makeRulesRuntime(): CounterTradeRuntimeConfig {
  return {
    enabled: true,
    exitEnabled: true,
    defenseEnabled: true,
    defendLiqDistancePct: 12,
    defendReduceFraction: 0.25,
    harvestTriggerRoiPct: 50,
    harvestFraction: 0.25,
    minReduceNotionalUsd: 15,
    minBufferRatio: 0.2,
    maxDefenseActionsPerTick: 2,
    spotSweepEnabled: true,
    spotSweepMinUsd: 1,
    userSiloDefenseEnabled: false,
    userSiloHlAgentPrivateKey: null,
    userSiloMasterAddress: null,
    roomId: '1659',
    chatPostEnabled: true,
    chatPostRoomId: '1659',
    minUserNotionalUsd: 25,
    cooldownMs: 120_000,
    hourlyActionCap: 12,
    dailyNotionalCapUsd: 7_500,
    maxCounterNotionalCeilingPctOfFund: 25,
    maxCounterNotionalPctOfFund: 10,
    minOrderNotionalUsd: 10,
    globalMaxLeverage: 12,
    favoredMultiplier: 1.35,
    neutralMultiplier: 1,
    unfavoredMultiplier: 0.75,
    favoredNotionalRatio: 0.6,
    neutralNotionalRatio: 0.45,
    unfavoredNotionalRatio: 0.3,
    neutralBiasLeverageCap: 8,
    favoredBiasLeverageCap: 10,
    unfavoredBiasLeverageCap: 6,
    liquidationMinDistancePct: 8,
    eventLookbackMs: 45 * 60_000,
    runLimitPerIdentity: 20,
    subaccountsEnabled: false,
    subaccounts: { trend: null, meanRevert: null, event: null },
    riskProfile: {
      riskPerTradeBps: 100,
      dailyLossCapBps: 300,
      maxDrawdownPauseBps: 1000,
      stopDistancePctByStrategy: { trend: 2.5, meanRevert: 1.5, event: 4 },
    },
    inverseRebalanceScalePct: 100,
    dipDrawdownFullSizePct: 40,
    dipDrawdownCurveAlpha: 1.5,
    maxDipAddsPerLeg: 3,
    dipPreAddLiqSafetyMarginPct: 2,
  }
}

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
    expect(formatInverseAkitaStakerPilotGateReply()).toContain('stake **≥1** FriendKey')
    expect(formatInverseAkitaStakerPilotGateReply()).toContain('/h rules')
  })

  it('formats concise /h rules with access, commands, and playbook', () => {
    const runtime = makeRulesRuntime()
    const stakerText = formatInverseAkitaPilotRules({
      pilotAccess: { eligible: true, stakedKeys: 3, reason: 'staker' },
      runtime,
      globalBias: 'bullish',
    })
    expect(stakerText).toContain('**InverseAKITA**')
    expect(stakerText).toContain('pilot access on')
    expect(stakerText).toContain('**3**')
    expect(stakerText).toContain('/h arena long|short|close')
    expect(stakerText).toContain('does the **opposite**')
    expect(stakerText).toContain('Playbook: **bullish** bias')
    expect(stakerText).not.toContain('Autonomous lane')
    expect(stakerText.length).toBeLessThanOrEqual(INVERSE_AKITA_PILOT_RULES_MAX_CHARS)

    const lockedText = formatInverseAkitaPilotRules({
      pilotAccess: { eligible: false, stakedKeys: 0, reason: 'insufficient_stake' },
      runtime,
    })
    expect(lockedText).toContain('locked')
  })
})
