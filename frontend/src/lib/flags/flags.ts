/**
 * Backward-compatible re-exports from the new feature flag registry.
 *
 * Consumers that already import from `@/lib/flags` continue to work unchanged.
 * New code should import directly from `@/lib/featureFlags`.
 */

export {
  isLocalDevOrigin,
  canUsePrivyEmbeddedWallets,
  isPrivyHostModeAllowed,
  resolvePrivyAppId as getPrivyAppId,
  resolvePrivyClientId as getPrivyClientId,
  resolvePrivyApiUrl as getPrivyApiUrl,
} from '@/lib/flags/featureFlags'

import {
  privyEnabledFlag,
  publicSiteModeFlag,
  lensGroveFlag,
} from '@/lib/flags/featureFlags'

export function isPublicSiteMode(): boolean {
  return publicSiteModeFlag()
}

export function isPrivyClientEnabled(): boolean {
  return privyEnabledFlag()
}

export function isLensGroveEnabled(): boolean {
  return lensGroveFlag()
}
