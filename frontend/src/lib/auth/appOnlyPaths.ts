/** App-only paths that should always run on app.4626.fun. */
export const APP_ONLY_PATHS = [
  '/explore',
  '/swap',
  '/telegram',
  '/deploy',
  '/vault',
  '/vote',
  '/auction',
  '/admin',
  '/agents',
  '/alfaclub',
  '/coin',
  '/creator',
  '/complete-auction',
] as const

const APP_ONLY_PATH_PREFIXES = APP_ONLY_PATHS.map((p) => `${p}/`)

export function isAppOnlyPath(pathname: string): boolean {
  for (let i = 0; i < APP_ONLY_PATHS.length; i += 1) {
    if (pathname === APP_ONLY_PATHS[i] || pathname.startsWith(APP_ONLY_PATH_PREFIXES[i]!)) {
      return true
    }
  }
  return false
}
