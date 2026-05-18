import { afterEach, describe, expect, it } from 'vitest'
import { loadControlPlanePolicy } from './policy.js'

const ORIGINAL_POLICY = process.env.CONTROL_PLANE_POLICY_JSON

afterEach(() => {
  if (ORIGINAL_POLICY === undefined) delete process.env.CONTROL_PLANE_POLICY_JSON
  else process.env.CONTROL_PLANE_POLICY_JSON = ORIGINAL_POLICY
})

describe('loadControlPlanePolicy', () => {
  it('loads defaults and returns stable version format', () => {
    delete process.env.CONTROL_PLANE_POLICY_JSON
    const loaded = loadControlPlanePolicy()
    expect(loaded.policy.degradation.getVaultLifecycleStatus).toBe('allow_stale_read')
    expect(loaded.policyVersion.startsWith('cpol_')).toBe(true)
  })

  it('ignores expired exceptions and emits critical warning', () => {
    process.env.CONTROL_PLANE_POLICY_JSON = JSON.stringify({
      exceptions: [
        {
          id: 'legacy_override',
          owner: 'ops',
          reason: 'legacy',
          removalCondition: 'upgrade',
          expiresAt: '2000-01-01T00:00:00.000Z',
        },
      ],
    })
    const loaded = loadControlPlanePolicy()
    expect(loaded.policy.exceptions).toHaveLength(0)
    expect(loaded.criticalWarnings).toContain('expired_exception_ignored:legacy_override')
  })
})

