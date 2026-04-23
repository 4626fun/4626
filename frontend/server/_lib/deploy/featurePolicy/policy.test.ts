import { describe, expect, it } from 'vitest'

import {
  DEPLOY_FEATURE_POLICY_MATRIX,
  validateFeatureCompatibility,
} from './policy'

describe('deploy feature policy matrix', () => {
  it('defines deterministic entries with failure codes', () => {
    expect(DEPLOY_FEATURE_POLICY_MATRIX.length).toBeGreaterThanOrEqual(4)
    for (const entry of DEPLOY_FEATURE_POLICY_MATRIX) {
      expect(entry.key).toBeTruthy()
      expect(entry.stages.length).toBeGreaterThan(0)
      expect(entry.failureCode).toMatch(/^feature_policy:/)
    }
  })

  it('keeps ovault mesh entitlement lane aligned to bridge-compatible features', () => {
    const ovault = DEPLOY_FEATURE_POLICY_MATRIX.find((entry) => entry.key === 'solana_ovault_mesh')
    expect(ovault).toBeTruthy()
    expect(ovault?.requiresAnyOf).toEqual(
      expect.arrayContaining(['solana_bridge_strategy', 'solana_ovault_mesh', 'solana_meteora_alpha_vault']),
    )
  })
})

describe('validateFeatureCompatibility', () => {
  it('passes when no conflicting feature combination exists', () => {
    expect(validateFeatureCompatibility(['charm_active_lp'])).toEqual({ ok: true })
    expect(validateFeatureCompatibility(['solana_bridge_strategy', 'solana_meteora_alpha_vault'])).toEqual({
      ok: true,
    })
  })

  it('fails when meteora is active without solana bridge strategy', () => {
    const result = validateFeatureCompatibility(['solana_meteora_alpha_vault'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('feature_policy:meteora_requires_solana_bridge')
    }
  })
})
