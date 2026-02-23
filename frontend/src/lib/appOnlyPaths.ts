/** App-only paths that should always run on app.4626.fun. */
export const APP_ONLY_PATHS = [
  '/explore',
  '/home',
  '/trade',
  '/swap',
  '/positions',
  '/portfolio',
  '/account',
  '/settings',
  '/deploy',
  '/launch',
  '/vault',
  '/vote',
  '/auction',
  '/admin',
  '/miniapp',
  '/agents',
  '/coin',
  '/creator',
  '/activate-akita',
  '/dashboard',
  '/complete-auction',
]

export function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
