import { describe, expect, it } from 'vitest'

import { deriveBadges, type HealthResponse } from './InfraReadinessBadges'

function baseHealth(overrides: Partial<HealthResponse>): HealthResponse {
  return {
    ok: true,
    time: '2026-04-14T12:00:00.000Z',
    paymaster: { endpointConfigured: true, ok: true, error: null },
    db: { configured: true, ok: true, latencyMs: 12, error: null },
    siwe: { authSessionSecretConfigured: true, ok: true, error: null },
    ...overrides,
  }
}

describe('deriveBadges', () => {
  it('returns loading state when no health payload is available', () => {
    const badges = deriveBadges(null)
    expect(badges.paymaster.state).toBe('loading')
    expect(badges.db.state).toBe('loading')
    expect(badges.siwe.state).toBe('loading')
  })

  it('returns error state when the health fetch failed', () => {
    const badges = deriveBadges(null, true)
    expect(badges.paymaster.state).toBe('error')
    expect(badges.db.state).toBe('error')
    expect(badges.siwe.state).toBe('error')
    expect(badges.paymaster.note).toMatch(/Health check failed/)
  })

  it('maps a fully healthy response to all-ok badges', () => {
    const badges = deriveBadges(baseHealth({}))
    expect(badges.paymaster.state).toBe('ok')
    expect(badges.paymaster.note).toBe('Reachable')
    expect(badges.db.state).toBe('ok')
    expect(badges.db.note).toBe('12ms')
    expect(badges.siwe.state).toBe('ok')
  })

  it('maps an unreachable paymaster to offline', () => {
    const badges = deriveBadges(
      baseHealth({ paymaster: { endpointConfigured: true, ok: false, error: 'timeout' } }),
    )
    expect(badges.paymaster.state).toBe('offline')
    expect(badges.paymaster.note).toBe('Unreachable')
  })

  it('maps a missing paymaster endpoint to degraded (informational)', () => {
    const badges = deriveBadges(
      baseHealth({ paymaster: { endpointConfigured: false, ok: false, error: null } }),
    )
    expect(badges.paymaster.state).toBe('degraded')
    expect(badges.paymaster.note).toBe('Not configured')
  })

  it('reports db "Reachable" when ok but latency is null', () => {
    const badges = deriveBadges(
      baseHealth({ db: { configured: true, ok: true, latencyMs: null, error: null } }),
    )
    expect(badges.db.state).toBe('ok')
    expect(badges.db.note).toBe('Reachable')
  })

  it('maps missing siwe secret to degraded with a hint', () => {
    const badges = deriveBadges(
      baseHealth({ siwe: { authSessionSecretConfigured: false, ok: false, error: null } }),
    )
    expect(badges.siwe.state).toBe('degraded')
    expect(badges.siwe.note).toBe('Missing secret')
  })
})
