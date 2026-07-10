import { describe, expect, it } from 'vitest'

import { buildVirtualsPublicHealth, resolveVirtualsProbe } from './publicHealth.js'

describe('buildVirtualsPublicHealth', () => {
  it('returns only a minimal boolean for healthy and unhealthy states', () => {
    expect(buildVirtualsPublicHealth(true)).toEqual({ ok: true })
    expect(buildVirtualsPublicHealth(false)).toEqual({ ok: false })
    expect(Object.keys(buildVirtualsPublicHealth(true))).toEqual(['ok'])
  })

  it('cannot expose sessions, job identifiers, or errors', () => {
    const json = JSON.stringify(buildVirtualsPublicHealth(true))
    expect(json).not.toMatch(/session|job|error/i)
  })
})

describe('resolveVirtualsProbe', () => {
  it('keeps liveness healthy even before the ACP transport is ready', () => {
    expect(resolveVirtualsProbe('/healthz', false)).toEqual({
      status: 200,
      body: { ok: true },
    })
  })

  it('gates readiness on tracked ACP transport readiness', () => {
    expect(resolveVirtualsProbe('/readyz', false)).toEqual({
      status: 503,
      body: { ok: false },
    })
    expect(resolveVirtualsProbe('/readyz', true)).toEqual({
      status: 200,
      body: { ok: true },
    })
  })

  it('returns 404 without a health payload for other routes', () => {
    expect(resolveVirtualsProbe('/status', true)).toEqual({ status: 404, body: null })
  })
})
