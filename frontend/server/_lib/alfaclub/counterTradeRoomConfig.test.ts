import { describe, expect, it } from 'vitest'
import type { CounterTradeRuntimeConfig } from './counterTradeConfig.js'
import {
  formatCounterTradeConfigStatus,
  formatCounterTradeGroupStatus,
  formatCounterTradeMemberOnboarding,
  formatCounterTradeResumePreview,
  mergeCounterTradeRuntimeWithRoomOverrides,
  parseCounterTradeConfigCommand,
  parseCounterTradeConfigValue,
  remapCounterTradeTopLevelCommand,
  resolveCounterTradeConfigFieldSpec,
} from './counterTradeRoomConfig.js'

function makeRuntime(): CounterTradeRuntimeConfig {
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

describe('counterTradeRoomConfig', () => {
  it('merges room overrides over env runtime defaults', () => {
    const merged = mergeCounterTradeRuntimeWithRoomOverrides(makeRuntime(), {
      inverseRebalanceScalePct: 80,
      harvestFraction: 0.3,
    })
    expect(merged.inverseRebalanceScalePct).toBe(80)
    expect(merged.harvestFraction).toBe(0.3)
    expect(merged.defendLiqDistancePct).toBe(12)
  })

  it('remaps /h subcommands', () => {
    expect(remapCounterTradeTopLevelCommand('/h', '')).toEqual({ command: '/hermit', args: 'help' })
    expect(remapCounterTradeTopLevelCommand('/h', 'help')).toEqual({ command: '/hermit', args: 'help' })
    expect(remapCounterTradeTopLevelCommand('/h', 'arena')).toEqual({ command: '/arena', args: 'status' })
    expect(remapCounterTradeTopLevelCommand('/h', 'arena status')).toEqual({
      command: '/arena',
      args: 'status',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'positions')).toEqual({
      command: '/arena',
      args: 'positions',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'pos risk')).toEqual({
      command: '/arena',
      args: 'positions risk',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'positions 3')).toEqual({
      command: '/arena',
      args: 'positions 3',
    })
    expect(remapCounterTradeTopLevelCommand('/h', '2')).toEqual({
      command: '/arena',
      args: 'positions 2',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'join')).toEqual({ command: '/s', args: 'join' })
    expect(remapCounterTradeTopLevelCommand('/h', 'start')).toEqual({ command: '/s', args: 'join' })
    expect(remapCounterTradeTopLevelCommand('/h', 'pause')).toEqual({ command: '/s', args: 'pause' })
    expect(remapCounterTradeTopLevelCommand('/h', 'resume')).toEqual({ command: '/s', args: 'resume' })
    expect(remapCounterTradeTopLevelCommand('/h', 'stop')).toEqual({ command: '/s', args: 'pause' })
    expect(remapCounterTradeTopLevelCommand('/h', 'rules')).toEqual({ command: '/s', args: 'p' })
    expect(remapCounterTradeTopLevelCommand('/h', 'sync 80')).toEqual({ command: '/s', args: 'sync 80' })
    expect(remapCounterTradeTopLevelCommand('/h', 'mirror 80')).toEqual({ command: '/s', args: 'sync 80' })
    expect(remapCounterTradeTopLevelCommand('/h', 'bank trim 25')).toEqual({
      command: '/s',
      args: 'bank trim 25',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'profit trim 25')).toEqual({
      command: '/s',
      args: 'bank trim 25',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'safety 12')).toEqual({
      command: '/s',
      args: 'safe 12',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'risk 12')).toEqual({
      command: '/s',
      args: 'safe 12',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'size 750')).toEqual({
      command: '/s',
      args: 'size 750',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'reset sync')).toEqual({
      command: '/s',
      args: 'reset sync',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'defaults sync')).toEqual({
      command: '/s',
      args: 'reset sync',
    })
    expect(remapCounterTradeTopLevelCommand('/h', 'setup')).toEqual({ command: '/s', args: 'setup' })
  })

  it('does not remap legacy non-/h shortcuts anymore', () => {
    expect(remapCounterTradeTopLevelCommand('/in', '')).toBeNull()
    expect(remapCounterTradeTopLevelCommand('/rules', '')).toBeNull()
    expect(remapCounterTradeTopLevelCommand('/sync', '80')).toBeNull()
  })

  it('parses plain-word section commands', () => {
    expect(parseCounterTradeConfigCommand('sync 80')).toEqual({
      kind: 'set',
      field: 'inverseRebalanceScalePct',
      rawValue: '80',
      label: 'Sync strength',
    })
    expect(parseCounterTradeConfigCommand('mirror 80')).toEqual({
      kind: 'set',
      field: 'inverseRebalanceScalePct',
      rawValue: '80',
      label: 'Sync strength',
    })
    expect(parseCounterTradeConfigCommand('size 15')).toEqual({
      kind: 'set',
      field: 'maxCounterNotionalPctOfFund',
      rawValue: '15',
      label: 'Response size (% of trading fund)',
    })
    expect(parseCounterTradeConfigCommand('size max 20')).toEqual({
      kind: 'set',
      field: 'maxCounterNotionalCeilingPctOfFund',
      rawValue: '20',
      label: 'Hard max (% of trading fund)',
    })
    expect(parseCounterTradeConfigCommand('size depth 40')).toEqual({
      kind: 'set',
      field: 'dipDrawdownFullSizePct',
      rawValue: '40',
      label: 'Full dip size at this drawdown (D)',
    })
    expect(parseCounterTradeConfigCommand('size curve 1.5')).toEqual({
      kind: 'set',
      field: 'dipDrawdownCurveAlpha',
      rawValue: '1.5',
      label: 'Dip curve shape (alpha)',
    })
    expect(parseCounterTradeConfigCommand('size adds 3')).toEqual({
      kind: 'set',
      field: 'maxDipAddsPerLeg',
      rawValue: '3',
      label: 'Max dip adds per leg',
    })
    expect(parseCounterTradeConfigCommand('reset sync')).toEqual({ kind: 'reset', group: 'rebalance' })
    expect(parseCounterTradeConfigCommand('reset mirror')).toEqual({ kind: 'reset', group: 'rebalance' })
  })

  it('parses fraction-style harvest trim values', () => {
    const spec = resolveCounterTradeConfigFieldSpec('harvestFraction')
    expect(spec).not.toBeNull()
    if (!spec) return
    expect(parseCounterTradeConfigValue(spec, '25')).toBe(0.25)
  })

  it('formats grouped status with room-facing copy', () => {
    const text = formatCounterTradeGroupStatus({
      group: 'rebalance',
      runtime: mergeCounterTradeRuntimeWithRoomOverrides(makeRuntime(), {
        inverseRebalanceScalePct: 80,
      }),
      overrides: { inverseRebalanceScalePct: 80 },
      audience: 'room',
    })
    expect(text).toContain('Room playbook · Syncs when you trade')
    expect(text).toContain('Sync strength: **80%**')
    expect(text).not.toContain('Operator')
  })

  it('formats join onboarding as a 4-step room walkthrough', () => {
    const text = formatCounterTradeMemberOnboarding({
      runtime: makeRuntime(),
      preset: 'balanced',
    })
    expect(text).toContain("You're in")
    expect(text).toContain('**1 · When you resize**')
    expect(text).toContain('10%** of the trading fund')
    expect(text).toContain('Shared room rules')
    expect(text).toContain('/h setup')
  })

  it('formats resume preview with confirm step', () => {
    const text = formatCounterTradeResumePreview({
      runtime: makeRuntime(),
      preset: 'balanced',
    })
    expect(text).toContain('Resume mirrored trading?')
    expect(text).toContain('Current room playbook')
    expect(text).toContain('/h resume confirm')
    expect(text).not.toContain('**1 · When you resize**')
  })

  it('remaps resume confirm separately from resume preview', () => {
    expect(remapCounterTradeTopLevelCommand('/h', 'resume')).toEqual({ command: '/s', args: 'resume' })
    expect(remapCounterTradeTopLevelCommand('/h', 'resume confirm')).toEqual({
      command: '/s',
      args: 'resume confirm',
    })
  })

  it('formats full tune view as a room playbook', () => {
    const text = formatCounterTradeConfigStatus({
      runtime: makeRuntime(),
      overrides: {},
      group: 'all',
      audience: 'room',
    })
    expect(text).toContain('/h start')
    expect(text).toContain('Room playbook')
    expect(text).not.toContain('Operator')
  })
})
