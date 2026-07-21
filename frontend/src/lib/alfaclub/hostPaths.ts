import { APP_ORIGIN } from '@/lib/env/host'

/** Canonical AlfaClub key surfaces live on app.4626.fun. */
export const ALFACLUB_KEYS_PATH = '/keys'
export const ALFACLUB_EXPLORE_KEYS_PATH = '/explore/keys'
/** @deprecated Internal compatibility aliases; public URLs are keys, never rooms. */
export const ALFACLUB_ROOMS_PATH = ALFACLUB_KEYS_PATH
export const ALFACLUB_EXPLORE_ROOMS_PATH = ALFACLUB_EXPLORE_KEYS_PATH
export const ALFACLUB_EXPLORE_POOLS_PATH = '/explore/pools'
export const ALFACLUB_INVERSE_AKITA_PATH = '/inverseakita'
export const ALFACLUB_ARENA_PATH = '/arena'
export const ALFACLUB_SAFETY_PATH = '/safety'
export const ALFACLUB_POOLS_PATH = '/pools'

type AlfaClubRedirectTarget = {
  pathname: string
  forcedTab?: 'safety' | 'liquidity'
}

const LEGACY_TO_CANONICAL: Record<string, AlfaClubRedirectTarget> = {
  '/rooms': { pathname: ALFACLUB_KEYS_PATH },
  '/explore/rooms': { pathname: ALFACLUB_EXPLORE_KEYS_PATH },
  [ALFACLUB_KEYS_PATH]: { pathname: ALFACLUB_KEYS_PATH },
  [ALFACLUB_EXPLORE_KEYS_PATH]: { pathname: ALFACLUB_EXPLORE_KEYS_PATH },
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

/** Map old room pathnames to canonical key paths. */
export function resolveAlfaClubCanonicalPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname)
  return LEGACY_TO_CANONICAL[normalized]?.pathname ?? null
}

export function buildAlfaClubRedirectLocation(input: {
  pathname: string
  search?: string
  hash?: string
}): string {
  const normalized = normalizePathname(input.pathname)
  const target = LEGACY_TO_CANONICAL[normalized]
  const pathname = target?.pathname ?? normalized
  const search = new URLSearchParams(input.search ?? '')
  if (target?.forcedTab) search.set('tab', target.forcedTab)
  if (pathname === ALFACLUB_KEYS_PATH && search.has('roomId') && !search.has('keyId')) {
    search.set('keyId', search.get('roomId') ?? '')
    search.delete('roomId')
  }
  const query = search.toString()
  return `${pathname}${query ? `?${query}` : ''}${input.hash ?? ''}`
}

/** Absolute canonical URL on the app host, preserving query/hash. */
export function buildAlfaClubAbsoluteUrl(input: {
  pathname: string
  search?: string
  hash?: string
  origin?: string
}): string {
  const origin = (input.origin ?? APP_ORIGIN).replace(/\/+$/, '')
  return `${origin}${buildAlfaClubRedirectLocation(input)}`
}
