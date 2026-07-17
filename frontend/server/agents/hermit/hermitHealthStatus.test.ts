import { describe, expect, it } from 'vitest'

import { resolveHermitProbeStatus } from './hermitHealthStatus.js'

describe('resolveHermitProbeStatus', () => {
  it('keeps liveness healthy when dependencies are not ready', () => {
    expect(resolveHermitProbeStatus({
      probe: '/healthz',
      bridgeStarted: false,
      counterTradeRunnerEnabled: true,
      counterTradeEffective: false,
    })).toBe(200)
  })

  it('fails readiness when the bridge is not started', () => {
    expect(resolveHermitProbeStatus({
      probe: '/readyz',
      bridgeStarted: false,
      counterTradeRunnerEnabled: false,
      counterTradeEffective: false,
    })).toBe(503)
  })

  it('fails readiness when an enabled counter-trade runner is ineffective', () => {
    expect(resolveHermitProbeStatus({
      probe: '/readyz',
      bridgeStarted: true,
      counterTradeRunnerEnabled: true,
      counterTradeEffective: false,
    })).toBe(503)
  })

  it('does not require counter-trade effectiveness when the runner is disabled', () => {
    expect(resolveHermitProbeStatus({
      probe: '/readyz',
      bridgeStarted: true,
      counterTradeRunnerEnabled: false,
      counterTradeEffective: false,
    })).toBe(200)
  })

  it('passes readiness when the bridge and enabled runner are effective', () => {
    expect(resolveHermitProbeStatus({
      probe: '/readyz',
      bridgeStarted: true,
      counterTradeRunnerEnabled: true,
      counterTradeEffective: true,
    })).toBe(200)
  })
})
