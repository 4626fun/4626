import { isLocalDevOrigin } from '@/lib/flags/flags'

import {
  CONFIGURED_MARKETING_ORIGIN,
  resolveAuthRedirectOrigin,
} from './host'

/**
 * Privy validates OAuth return URLs exactly. Waitlist cross-app (Zora) must
 * redirect back to `/waitlist` on the browser origin the user is actually on.
 * On loopback, always pin to `window.location.origin` so a stale
 * VITE_APP_ORIGIN port (5173 vs 5174) cannot break oauth/link.
 */
export function resolveWaitlistPrivyOAuthRedirectUrl(currentOrigin: string): string {
  const origin = isLocalDevOrigin(currentOrigin)
    ? currentOrigin
    : resolveAuthRedirectOrigin({
        configuredOrigin: CONFIGURED_MARKETING_ORIGIN,
        currentOrigin,
      })
  try {
    return new URL('/waitlist', origin).toString()
  } catch {
    return `${currentOrigin.replace(/\/+$/, '')}/waitlist`
  }
}
