export type CanonicalSignerMode = 'privy-embedded' | 'connected-owner'
export type RouteMode = 'classic-only' | 'classic+uniswapx'

const SIGNER_STORAGE_KEY = 'cv.swap.canonicalSignerMode'
const ROUTES_STORAGE_KEY = 'cv.swap.routes'

const DEFAULT_SIGNER_MODE: CanonicalSignerMode = 'privy-embedded'
const DEFAULT_ROUTE_MODE: RouteMode = 'classic+uniswapx'

export function readPreferredCanonicalSignerMode(): CanonicalSignerMode {
  if (typeof window === 'undefined') return DEFAULT_SIGNER_MODE
  try {
    const raw = window.localStorage.getItem(SIGNER_STORAGE_KEY)
    return raw === 'connected-owner' ? 'connected-owner' : DEFAULT_SIGNER_MODE
  } catch {
    return DEFAULT_SIGNER_MODE
  }
}

export function writePreferredCanonicalSignerMode(mode: CanonicalSignerMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIGNER_STORAGE_KEY, mode)
  } catch {
    // Ignore localStorage errors in private mode/webviews.
  }
}

export function readPreferredRouteMode(): RouteMode {
  if (typeof window === 'undefined') return DEFAULT_ROUTE_MODE
  try {
    const raw = window.localStorage.getItem(ROUTES_STORAGE_KEY)
    return raw === 'classic-only' ? 'classic-only' : DEFAULT_ROUTE_MODE
  } catch {
    return DEFAULT_ROUTE_MODE
  }
}

export function writePreferredRouteMode(mode: RouteMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ROUTES_STORAGE_KEY, mode)
  } catch {
    // Ignore localStorage errors in private mode/webviews.
  }
}

