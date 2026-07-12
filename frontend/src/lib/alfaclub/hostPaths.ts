import { ALFACLUB_ORIGIN } from '@/lib/env/host'

/** Canonical short paths on alfaclub.4626.fun */
export const ALFACLUB_ROOMS_PATH = '/rooms'
export const ALFACLUB_SAFETY_PATH = '/safety'
export const ALFACLUB_POOLS_PATH = '/pools'

const LEGACY_TO_CANONICAL: Record<string, string> = {
  '/alfaclub': ALFACLUB_ROOMS_PATH,
  '/alfaclub/trading-rooms': ALFACLUB_ROOMS_PATH,
  '/trading-rooms': ALFACLUB_ROOMS_PATH,
  '/alfaclub/key-safety': ALFACLUB_SAFETY_PATH,
  '/key-safety': ALFACLUB_SAFETY_PATH,
  '/alfaclub/liquidity': ALFACLUB_POOLS_PATH,
  '/alfaclub/liquidity-pools': ALFACLUB_POOLS_PATH,
  '/liquidity': ALFACLUB_POOLS_PATH,
  '/liquidity-pools': ALFACLUB_POOLS_PATH,
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname || '/'
}

/** Map legacy AlfaClub pathnames to canonical short paths (same-host). */
export function resolveAlfaClubCanonicalPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname)
  return LEGACY_TO_CANONICAL[normalized] ?? null
}

/** Absolute URL on the AlfaClub product host, preserving query/hash. */
export function buildAlfaClubAbsoluteUrl(input: {
  pathname: string
  search?: string
  hash?: string
  origin?: string
}): string {
  const canonical = resolveAlfaClubCanonicalPath(input.pathname) ?? normalizePathname(input.pathname)
  const origin = (input.origin ?? ALFACLUB_ORIGIN).replace(/\/+$/, '')
  const search = input.search ?? ''
  const hash = input.hash ?? ''
  return `${origin}${canonical}${search}${hash}`
}
