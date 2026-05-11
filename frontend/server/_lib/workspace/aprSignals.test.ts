import { describe, expect, it } from 'vitest'

import { deriveStrategyAprSignal } from './aprSignals.js'

describe('deriveStrategyAprSignal', () => {
  it('returns placeholder APR for active known strategies', () => {
    expect(deriveStrategyAprSignal({ kind: 'charm', isActive: true })).toEqual({
      expectedAprBps: 1_200,
      confidence: 'low',
      source: 'p0_placeholder',
    })
    expect(deriveStrategyAprSignal({ kind: 'ajna', isActive: true })).toEqual({
      expectedAprBps: 900,
      confidence: 'low',
      source: 'p0_placeholder',
    })
  })

  it('returns fallback schema for inactive or unknown strategy rows', () => {
    expect(deriveStrategyAprSignal({ kind: 'solana', isActive: false })).toEqual({
      expectedAprBps: null,
      confidence: 'unknown',
      source: 'none',
    })
    expect(deriveStrategyAprSignal({ kind: 'unknown', isActive: true })).toEqual({
      expectedAprBps: null,
      confidence: 'unknown',
      source: 'none',
    })
  })

  it('prefers keeper activity APR metrics when available', () => {
    expect(
      deriveStrategyAprSignal({
        kind: 'charm',
        isActive: true,
        strategyAddress: '0x3333333333333333333333333333333333333333',
        nowIso: '2026-05-11T13:00:00.000Z',
        activityEvents: [
          {
            eventType: 'strategy.report.completed',
            createdAt: '2026-05-11T12:30:00.000Z',
            payload: {
              strategyAddress: '0x3333333333333333333333333333333333333333',
              expectedAprBps: 987,
            },
          },
        ],
      }),
    ).toEqual({
      expectedAprBps: 987,
      confidence: 'medium',
      source: 'keeper_report',
    })
  })

  it('derives charm APR from fresh keeper report snapshot context', () => {
    const signal = deriveStrategyAprSignal({
      kind: 'charm',
      isActive: true,
      nowIso: '2026-05-11T13:00:00.000Z',
      monitoringSnapshots: [
        {
          createdAt: '2026-05-11T12:00:00.000Z',
          payload: {
            context: {
              v3TwapUsdPerCreator: '1.00',
              v3SpotUsdPerCreator: '1.05',
            },
          },
        },
      ],
    })

    expect(signal.source).toBe('keeper_report')
    expect(signal.confidence).toBe('medium')
    expect(signal.expectedAprBps).not.toBeNull()
  })
})
