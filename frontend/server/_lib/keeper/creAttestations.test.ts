import { describe, expect, it } from 'vitest'

import {
  buildAttestationDedupeKey,
  deriveCreReportId,
  evaluateVaultStrategyHealthGate,
  normalizeAddress,
  normalizeReportIdHex,
} from './creAttestations.js'

describe('creAttestations helpers', () => {
  it('normalizes addresses and report ids', () => {
    expect(normalizeAddress('0xAbCdEF0000000000000000000000000000000000')).toBe(
      '0xabcdef0000000000000000000000000000000000',
    )
    expect(normalizeAddress('bad')).toBeNull()
    expect(normalizeReportIdHex(`0x${'a'.repeat(64)}`)).toBe(`0x${'a'.repeat(64)}`)
    expect(normalizeReportIdHex('0x1234')).toBeNull()
  })

  it('derives deterministic report ids and dedupe keys', () => {
    const idA = deriveCreReportId(['a', 1, 'x'])
    const idB = deriveCreReportId(['a', 1, 'x'])
    const idC = deriveCreReportId(['a', 2, 'x'])
    expect(idA).toBe(idB)
    expect(idA).not.toBe(idC)

    const key = buildAttestationDedupeKey({
      attestationKind: 'solana_nav',
      primaryAddress: '0xabc',
      reportId: idA,
    })
    expect(key).toContain('solana_nav')
    expect(key).toContain(idA.toLowerCase())
  })

  it('blocks on stale/degraded strategy statuses', () => {
    const now = Date.now()
    const healthy = {
      vaultAddress: '0xv',
      strategyAddress: '0xs',
      status: 'healthy' as const,
      confidenceBps: 9000,
      reportTimestamp: new Date(now).toISOString(),
      source: 'test',
      attestationDigest: null,
      metadata: {},
    }
    const ok = evaluateVaultStrategyHealthGate({
      statuses: [healthy],
      nowMs: now,
      maxAgeMs: 60_000,
      minConfidenceBps: 7000,
    })
    expect(ok.blocked).toBe(false)

    const stale = evaluateVaultStrategyHealthGate({
      statuses: [{ ...healthy, reportTimestamp: new Date(now - 120_000).toISOString() }],
      nowMs: now,
      maxAgeMs: 60_000,
      minConfidenceBps: 7000,
    })
    expect(stale.blocked).toBe(true)
    expect(stale.reason).toBe('strategy_health_stale')

    const degraded = evaluateVaultStrategyHealthGate({
      statuses: [{ ...healthy, status: 'degraded' }],
      nowMs: now,
      maxAgeMs: 60_000,
      minConfidenceBps: 7000,
    })
    expect(degraded.blocked).toBe(true)
    expect(degraded.reason).toBe('strategy_health_degraded')
  })
})
