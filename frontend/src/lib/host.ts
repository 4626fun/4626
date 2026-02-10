export type HostMode = 'app' | 'marketing'

/**
 * Host mode detection.
 *
 * After the domain merge (4626.fun + app.4626.fun → single origin),
 * this always returns 'app'. Kept for backward compat so call sites
 * don't need to be rewritten in one shot.
 */
export function getHostMode(): HostMode {
  return 'app'
}

/**
 * Base URL for the app.
 *
 * After the domain merge this is simply the current origin.
 * SSR/build-time fallback returns the canonical production URL.
 */
export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://4626.fun'
  return window.location.origin
}
