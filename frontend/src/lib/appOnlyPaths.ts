/** App-only paths that should always run on v1.4626.fun. */
export const APP_ONLY_PATHS = [
  '/explore',
  '/swap',
  '/telegram',
  '/positions',
  '/portfolio',
  '/deploy',
  '/vault',
  '/vote',
  '/auction',
  '/admin',
  '/agents',
  '/coin',
  '/creator',
  '/complete-auction',
]

export function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
