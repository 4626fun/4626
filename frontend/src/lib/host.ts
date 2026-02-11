export type HostMode = 'app' | 'marketing'

/** Canonical marketing/waitlist domain origin. */
export const MARKETING_ORIGIN =
  (import.meta.env.VITE_MARKETING_ORIGIN as string)?.trim() || 'https://4626.fun'

/** Canonical app domain origin (post-acceptance). */
export const APP_ORIGIN =
  (import.meta.env.VITE_APP_ORIGIN as string)?.trim() || 'https://app.4626.fun'

const MARKETING_HOSTNAMES = ['4626.fun', 'www.4626.fun']

function isMarketingHost(hostname: string): boolean {
  const h = hostname?.toLowerCase().trim() ?? ''
  return MARKETING_HOSTNAMES.some((m) => h === m)
}

/**
 * Host mode detection.
 *
 * - 4626.fun (or www.4626.fun) = marketing (waitlist landing)
 * - app.4626.fun (or localhost) = app
 */
export function getHostMode(): HostMode {
  if (typeof window === 'undefined') return 'app'
  const hostname = window.location.hostname ?? ''
  return isMarketingHost(hostname) ? 'marketing' : 'app'
}

/**
 * Base URL for the app (explore, deploy, vault, admin).
 *
 * When on marketing domain, returns app.4626.fun so links point to the app.
 * When on app domain, returns current origin.
 */
export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return APP_ORIGIN
  const mode = getHostMode()
  return mode === 'app' ? window.location.origin : APP_ORIGIN
}

/**
 * Base URL for the marketing/waitlist site.
 *
 * When on marketing domain, returns current origin.
 * When on app domain, returns 4626.fun.
 */
export function getMarketingBaseUrl(): string {
  if (typeof window === 'undefined') return MARKETING_ORIGIN
  const mode = getHostMode()
  return mode === 'marketing' ? window.location.origin : MARKETING_ORIGIN
}
