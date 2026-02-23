export const CANONICAL_SWAP_ROUTE = '/swap'
export const CANONICAL_EXPLORE_ROUTE = '/explore/creators'

const LEGACY_REDIRECTS: Record<string, string> = {
  '/home': CANONICAL_SWAP_ROUTE,
  '/trade': CANONICAL_SWAP_ROUTE,
  '/dashboard': CANONICAL_EXPLORE_ROUTE,
}

export function resolveLegacyRedirect(pathname: string): string | null {
  return LEGACY_REDIRECTS[pathname] ?? null
}

