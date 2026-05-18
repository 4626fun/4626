import { afterEach, describe, expect, it } from 'vitest'
import {
  enforceMutatingDegradation,
  evaluateFreshness,
  getStaleThresholdMinutes,
} from '../../server/_lib/controlPlane/policyDegradation.js'

const ORIGINAL_STALE = process.env.CONTROL_PLANE_STALE_MINUTES

afterEach(() => {
  if (ORIGINAL_STALE === undefined) delete process.env.CONTROL_PLANE_STALE_MINUTES
  else process.env.CONTROL_PLANE_STALE_MINUTES = ORIGINAL_STALE
})

describe('policyDegradation', () => {
  it('marks lifecycle data stale after threshold', () => {
    process.env.CONTROL_PLANE_STALE_MINUTES = '10'
    expect(getStaleThresholdMinutes()).toBe(10)
    const staleAt = new Date(Date.now() - 11 * 60_000).toISOString()
    expect(evaluateFreshness(staleAt).freshness).toBe('stale')
    const freshAt = new Date(Date.now() - 2 * 60_000).toISOString()
    expect(evaluateFreshness(freshAt).freshness).toBe('fresh')
  })

  it('blocks fail_closed mutating verbs without keepr vault registry row', () => {
    expect(
      enforceMutatingDegradation({
        verb: 'runMaintenanceCycle',
        context: { hasKeeprVault: false },
      }).blocked,
    ).toBe(true)
    expect(
      enforceMutatingDegradation({
        verb: 'queueOperatorAction',
        context: { hasKeeprVault: false },
      }).message,
    ).toBe('vault_not_found_in_keepr_registry')
  })

  it('blocks block_until_operator overrides for any mutating verb', () => {
    const original = process.env.CONTROL_PLANE_POLICY_JSON
    process.env.CONTROL_PLANE_POLICY_JSON = JSON.stringify({
      degradation: { runMaintenanceCycle: 'block_until_operator' },
    })
    expect(
      enforceMutatingDegradation({
        verb: 'runMaintenanceCycle',
        context: { hasKeeprVault: true },
      }),
    ).toMatchObject({ blocked: true, mode: 'block_until_operator' })
    if (original === undefined) delete process.env.CONTROL_PLANE_POLICY_JSON
    else process.env.CONTROL_PLANE_POLICY_JSON = original
  })
})
