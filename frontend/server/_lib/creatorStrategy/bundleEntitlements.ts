import type { CreatorStrategyFeatureKey } from './catalog.js'
import {
  FULL_VAULT_DEPLOY_FEATURE_KEY,
  FULL_DEPLOY_BUNDLE_GRANTED_KEYS,
  isAlacarteDeployFeatureKey,
} from './catalog.js'

export { FULL_VAULT_DEPLOY_FEATURE_KEY, FULL_DEPLOY_BUNDLE_GRANTED_KEYS }

const GRANTED_KEY_SET = new Set<string>(FULL_DEPLOY_BUNDLE_GRANTED_KEYS)

/**
 * Expand stored activation keys into effective deploy entitlements.
 * A paid `vault_full_deploy` row satisfies every bundled sub-feature.
 */
export function expandCreatorFeatureKeys(
  keys: Iterable<CreatorStrategyFeatureKey | string>,
): Set<CreatorStrategyFeatureKey> {
  const out = new Set<CreatorStrategyFeatureKey>()
  for (const raw of keys) {
    const key = String(raw ?? '').trim()
    if (!key) continue
    if (key === FULL_VAULT_DEPLOY_FEATURE_KEY) {
      out.add(FULL_VAULT_DEPLOY_FEATURE_KEY)
      for (const granted of FULL_DEPLOY_BUNDLE_GRANTED_KEYS) {
        out.add(granted)
      }
      continue
    }
    if (GRANTED_KEY_SET.has(key) || key.startsWith('deploy_vanity_')) {
      out.add(key as CreatorStrategyFeatureKey)
    }
  }
  return out
}

/** Feature keys to match in SQL when checking live entitlement for a sub-feature. */
export function listEntitlementLookupKeys(featureKey: string): string[] {
  const normalized = String(featureKey ?? '').trim()
  if (!normalized) return []
  if (GRANTED_KEY_SET.has(normalized)) {
    return [normalized, FULL_VAULT_DEPLOY_FEATURE_KEY]
  }
  return [normalized]
}

export function isFeatureGrantedByKeys(
  featureKey: string,
  activeKeys: Iterable<CreatorStrategyFeatureKey | string>,
): boolean {
  return expandCreatorFeatureKeys(activeKeys).has(featureKey as CreatorStrategyFeatureKey)
}

export function getAlacarteDeployPurchaseBlockedMessage(featureKey: string): string | null {
  if (!isAlacarteDeployFeatureKey(featureKey)) return null
  return (
    'Individual strategy purchases were replaced by the $499 full vault deploy package. ' +
    `Activate vault_full_deploy at /creator/strategy/features instead of "${featureKey}".`
  )
}
