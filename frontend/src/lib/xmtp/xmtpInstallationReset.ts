import {
  detectInAppEnvironment,
  isBaseAppInAppContext,
  type InAppEnvironment,
} from '@/lib/wallet/inAppBrowser'

/**
 * Whether `window.confirm` should gate XMTP installation revocation.
 *
 * Base App / wallet in-app browsers suppress native confirm dialogs (often as
 * cancel). The Reset / Free-slot button is already an explicit user action, so
 * in-app paths should proceed to the Smart Wallet signature prompt instead of
 * surfacing a false "XMTP reset cancelled."
 */
export function shouldPromptNativeConfirmForXmtpInstallationReset(
  env: InAppEnvironment | null = detectInAppEnvironment(),
): boolean {
  if (typeof window === 'undefined') return false
  if (isBaseAppInAppContext(env)) return false
  if (env?.isAnyWalletInApp) return false
  return true
}
