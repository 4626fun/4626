/** App-only paths that should always run on app.4626.fun. */
export const APP_ONLY_PATHS = [
  '/arena',
  '/acp',
  '/explore',
  '/swap',
  '/telegram',
  '/deploy',
  '/vault',
  '/vote',
  '/auction',
  '/admin',
  '/agents',
  // Legacy AlfaClub prefixes remain app-only so marketing host handoff still
  // fires before the hard cross-host redirect to alfaclub.4626.fun.
  '/alfaclub',
  '/coin',
  '/creator',
  '/complete-auction',
] as const

const APP_ONLY_PATH_PREFIXES = APP_ONLY_PATHS.map((p) => `${p}/`)

/**
 * Former marketing-host exception for key-safety. Kept empty after the
 * alfaclub.4626.fun cutover — `/alfaclub/key-safety` hard-redirects to
 * `alfaclub.4626.fun/safety`.
 */
const MARKETING_OVERRIDES = new Set<string>([])

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

export function isAppOnlyPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname)
  if (MARKETING_OVERRIDES.has(normalized)) return false
  for (let i = 0; i < APP_ONLY_PATHS.length; i += 1) {
    if (normalized === APP_ONLY_PATHS[i] || normalized.startsWith(APP_ONLY_PATH_PREFIXES[i]!)) {
      return true
    }
  }
  return false
}
