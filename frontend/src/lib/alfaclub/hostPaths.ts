import { ALFACLUB_ORIGIN } from '@/lib/env/host'

/** Canonical hub and retained alias paths on alfaclub.4626.fun. */
export const ALFACLUB_ROOMS_PATH = '/rooms'
export const ALFACLUB_INVERSE_AKITA_PATH = '/inverseakita'
export const ALFACLUB_SAFETY_PATH = '/safety'
export const ALFACLUB_POOLS_PATH = '/pools'

type AlfaClubRedirectTarget = {
  pathname: string
  forcedTab?: 'safety' | 'liquidity'
}

const LEGACY_TO_CANONICAL: Record<string, AlfaClubRedirectTarget> = {
  '/alfaclub': { pathname: ALFACLUB_ROOMS_PATH },
  '/alfaclub/trading-rooms': { pathname: ALFACLUB_ROOMS_PATH },
  '/trading-rooms': { pathname: ALFACLUB_ROOMS_PATH },
  '/safety': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'safety' },
  '/alfaclub/key-safety': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'safety' },
  '/key-safety': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'safety' },
  '/pools': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'liquidity' },
  '/alfaclub/liquidity': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'liquidity' },
  '/alfaclub/liquidity-pools': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'liquidity' },
  '/liquidity': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'liquidity' },
  '/liquidity-pools': { pathname: ALFACLUB_ROOMS_PATH, forcedTab: 'liquidity' },
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

/** Map legacy AlfaClub pathnames to canonical short paths (same-host). */
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
  const query = search.toString()
  return `${pathname}${query ? `?${query}` : ''}${input.hash ?? ''}`
}

/** Absolute URL on the AlfaClub product host, preserving query/hash. */
export function buildAlfaClubAbsoluteUrl(input: {
  pathname: string
  search?: string
  hash?: string
  origin?: string
}): string {
  const origin = (input.origin ?? ALFACLUB_ORIGIN).replace(/\/+$/, '')
  return `${origin}${buildAlfaClubRedirectLocation(input)}`
}
