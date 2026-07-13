import { getMarketingBaseUrl, getWaitlistReferralBaseUrl } from '@/lib/env/host'

const CANONICAL_MARKETING_WAITLIST_PATH = '/waitlist'
const WAITLIST_REFERRAL_PATH_PREFIX = '/r'
export const WAITLIST_START_AUTH_QUERY_KEY = 'start'
export const WAITLIST_CONTINUE_QUERY_KEY = 'continue'
export const WAITLIST_RETURN_PATH_QUERY_KEY = 'returnPath'

const ALFACLUB_CONTINUE_VALUE = 'alfaclub'
const ALFACLUB_ROOMS_PATH = '/rooms'
const ALFACLUB_ROOM_TABS = new Set(['overview', 'safety', 'liquidity', 'inverse'])
const ALFACLUB_RETURN_QUERY_KEYS = new Set(['roomId', 'tab', 'pool'])

export const WAITLIST_REFERRAL_CODE_STORAGE_KEY = 'cv:waitlist:referral_code'
export const WAITLIST_REFERRAL_CLICK_SESSION_KEY = 'cv:waitlist:referral_click_session'

type WaitlistEntryLocation = {
  pathname?: string | null
}

export type WaitlistEntryOptions = {
  alfaClubReturnPath?: string | null
}

export function getCanonicalMarketingWaitlistPath(): string {
  return CANONICAL_MARKETING_WAITLIST_PATH
}

export function buildCanonicalMarketingWaitlistUrl(baseUrl: string): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${CANONICAL_MARKETING_WAITLIST_PATH}`
}

function normalizePathname(pathname: string | null | undefined): string {
  const rawPath = String(pathname ?? '').trim()
  if (rawPath.length === 0) return '/'
  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

export function normalizeWaitlistReferralCode(value: string | null | undefined): string | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)

  return normalized.length > 0 ? normalized : null
}

export function buildWaitlistReferralPath(referralCode: string | null | undefined): string {
  const normalized = normalizeWaitlistReferralCode(referralCode)
  return normalized ? `${WAITLIST_REFERRAL_PATH_PREFIX}/${normalized}` : CANONICAL_MARKETING_WAITLIST_PATH
}

export function buildWaitlistReferralUrl(baseUrl: string, referralCode: string | null | undefined): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistReferralPath(referralCode)}`
}

export function getMarketingWaitlistReferralUrl(referralCode: string | null | undefined): string {
  return buildWaitlistReferralUrl(getWaitlistReferralBaseUrl(), referralCode)
}

export function readWaitlistEntryReferralCode(location: WaitlistEntryLocation): string | null {
  const pathname = normalizePathname(location.pathname)
  if (pathname.startsWith(`${WAITLIST_REFERRAL_PATH_PREFIX}/`)) {
    const candidate = pathname.slice(`${WAITLIST_REFERRAL_PATH_PREFIX}/`.length)
    if (!candidate.includes('/')) return normalizeWaitlistReferralCode(candidate)
  }
  return null
}

export function isMarketingWaitlistEntryLocation(location: WaitlistEntryLocation): boolean {
  const pathname = normalizePathname(location.pathname)
  return pathname === CANONICAL_MARKETING_WAITLIST_PATH
}

export function buildWaitlistEntryPath(): string {
  return CANONICAL_MARKETING_WAITLIST_PATH
}

export function isWaitlistStartAuthSearchParam(value: string | null | undefined): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export function buildWaitlistStartAuthPath(): string {
  return `${CANONICAL_MARKETING_WAITLIST_PATH}?${WAITLIST_START_AUTH_QUERY_KEY}=1`
}

export function buildWaitlistStartAuthUrl(baseUrl: string): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistStartAuthPath()}`
}

export function normalizeAlfaClubWaitlistReturnPath(value: string | null | undefined): string | null {
  const candidate = String(value ?? '').trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null

  try {
    const parsed = new URL(candidate, 'https://alfaclub.4626.fun')
    if (parsed.origin !== 'https://alfaclub.4626.fun' || parsed.pathname !== ALFACLUB_ROOMS_PATH) {
      return null
    }
    if (parsed.hash || parsed.searchParams.has('cv_handoff')) return null
    if ([...parsed.searchParams.keys()].some((key) => !ALFACLUB_RETURN_QUERY_KEYS.has(key))) {
      return null
    }

    const roomId = parsed.searchParams.get('roomId')
    if (roomId !== null && !/^\d+$/.test(roomId)) return null

    const tab = parsed.searchParams.get('tab')
    if (tab !== null && !ALFACLUB_ROOM_TABS.has(tab)) return null

    const pool = parsed.searchParams.get('pool')
    if (pool !== null && !/^0x[a-fA-F0-9]{40}$/.test(pool)) return null

    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export function readWaitlistAlfaClubReturnPath(search: string | null | undefined): string | null {
  const params = new URLSearchParams(String(search ?? '').replace(/^\?/, ''))
  if (params.get(WAITLIST_CONTINUE_QUERY_KEY) !== ALFACLUB_CONTINUE_VALUE) return null
  return normalizeAlfaClubWaitlistReturnPath(params.get(WAITLIST_RETURN_PATH_QUERY_KEY))
}

export function buildWaitlistEntryUrl(baseUrl: string, options?: WaitlistEntryOptions): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  const entryUrl = `${base}${buildWaitlistEntryPath()}`
  const returnPath = normalizeAlfaClubWaitlistReturnPath(options?.alfaClubReturnPath)
  if (!returnPath) return entryUrl

  const params = new URLSearchParams()
  params.set(WAITLIST_CONTINUE_QUERY_KEY, ALFACLUB_CONTINUE_VALUE)
  params.set(WAITLIST_RETURN_PATH_QUERY_KEY, returnPath)
  return `${entryUrl}?${params.toString()}`
}

export function getPrivyCapableWaitlistEntryUrl(): string {
  return buildWaitlistEntryUrl(getMarketingBaseUrl())
}

export function getMarketingWaitlistEntryUrl(): string {
  return buildWaitlistEntryUrl(getMarketingBaseUrl())
}

/** True when the browser is already on the canonical marketing-host `/waitlist` route. */
export function isOnCanonicalMarketingWaitlistPage(): boolean {
  if (typeof window === 'undefined') return false
  if (!isMarketingWaitlistEntryLocation({ pathname: window.location.pathname })) return false
  try {
    return window.location.origin === new URL(getMarketingWaitlistEntryUrl()).origin
  } catch {
    return false
  }
}

export type WaitlistSetupIntent = 'base-app' | 'owner-install'

export function readWaitlistSetupIntent(value: string | null | undefined): WaitlistSetupIntent | null {
  const setup = String(value ?? '')
    .trim()
    .toLowerCase()
  if (setup === 'base-app' || setup === 'owner-install') return setup
  return null
}

/** SPA-safe waitlist setup path (marketing host route). */
export function buildWaitlistSetupPath(setup: WaitlistSetupIntent): string {
  return `${CANONICAL_MARKETING_WAITLIST_PATH}?setup=${setup}`
}

/** Canonical marketing-host URL for waitlist setup deep links (`4626.fun`, not `app.4626.fun`). */
export function buildWaitlistSetupUrl(setup: WaitlistSetupIntent): string {
  const url = new URL(getMarketingWaitlistEntryUrl())
  url.searchParams.set('setup', setup)
  return url.toString()
}

export function readStoredWaitlistReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return normalizeWaitlistReferralCode(window.sessionStorage.getItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function storeWaitlistReferralCode(referralCode: string | null | undefined): void {
  if (typeof window === 'undefined') return
  const normalized = normalizeWaitlistReferralCode(referralCode)
  try {
    if (normalized) window.sessionStorage.setItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY, normalized)
    else window.sessionStorage.removeItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function clearStoredWaitlistReferralCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(WAITLIST_REFERRAL_CODE_STORAGE_KEY)
  } catch {
    // ignore
  }
}
