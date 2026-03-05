import { describe, expect, it } from 'vitest'

import { getHealthProbeStatusCode } from './_healthStatus.js'

describe('getHealthProbeStatusCode', () => {
  it('keeps liveness healthy while booting', () => {
    const statusCode = getHealthProbeStatusCode({
      probe: '/healthz',
      ready: false,
      agentBooted: false,
      agentCount: 0,
      xmtpReady: false,
    })

    expect(statusCode).toBe(200)
  })

  it('keeps liveness healthy when no agents are active yet', () => {
    const statusCode = getHealthProbeStatusCode({
      probe: '/healthz',
      ready: false,
      agentBooted: true,
      agentCount: 0,
      xmtpReady: true,
    })

    expect(statusCode).toBe(200)
  })

  it('returns liveness failure only when started agents are not running', () => {
    const statusCode = getHealthProbeStatusCode({
      probe: '/healthz',
      ready: false,
      agentBooted: true,
      agentCount: 1,
      xmtpReady: false,
    })

    expect(statusCode).toBe(503)
  })

  it('keeps readiness strict', () => {
    const statusCode = getHealthProbeStatusCode({
      probe: '/readyz',
      ready: false,
      agentBooted: true,
      agentCount: 1,
      xmtpReady: true,
    })

    expect(statusCode).toBe(503)
  })
})
