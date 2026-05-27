import { describe, expect, it } from 'vitest'

import {
  expandCreatorFeatureKeys,
  getAlacarteDeployPurchaseBlockedMessage,
  listEntitlementLookupKeys,
} from './bundleEntitlements'

describe('expandCreatorFeatureKeys', () => {
  it('expands vault_full_deploy into all bundled entitlements', () => {
    const expanded = expandCreatorFeatureKeys(['vault_full_deploy'])
    expect(expanded.has('vault_full_deploy')).toBe(true)
    expect(expanded.has('charm_active_lp')).toBe(true)
    expect(expanded.has('ajna_sleeve')).toBe(true)
    expect(expanded.has('solana_ovault_mesh')).toBe(true)
    expect(expanded.has('solana_meteora_alpha_vault')).toBe(true)
  })

  it('keeps legacy individual keys', () => {
    const expanded = expandCreatorFeatureKeys(['charm_active_lp'])
    expect(expanded.has('charm_active_lp')).toBe(true)
    expect(expanded.has('ajna_sleeve')).toBe(false)
  })
})

describe('listEntitlementLookupKeys', () => {
  it('checks bundle row for sub-feature lookups', () => {
    expect(listEntitlementLookupKeys('charm_active_lp')).toEqual([
      'charm_active_lp',
      'vault_full_deploy',
    ])
  })
})

describe('getAlacarteDeployPurchaseBlockedMessage', () => {
  it('blocks individual deploy SKUs', () => {
    expect(getAlacarteDeployPurchaseBlockedMessage('charm_active_lp')).toContain('$499')
    expect(getAlacarteDeployPurchaseBlockedMessage('vault_full_deploy')).toBeNull()
  })
})
