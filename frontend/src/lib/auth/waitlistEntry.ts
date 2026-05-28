import { getMarketingBaseUrl, getWaitlistReferralBaseUrl } from '@/lib/env/host'

const CANONICAL_MARKETING_WAITLIST_PATH = '/waitlist'
const WAITLIST_REFERRAL_PATH_PREFIX = '/r'
export const WAITLIST_START_AUTH_QUERY_KEY = 'start'

export const WAITLIST_REFERRAL_CODE_STORAGE_KEY = 'cv:waitlist:referral_code'
export const WAITLIST_REFERRAL_CLICK_SESSION_KEY = 'cv:waitlist:referral_click_session'

type WaitlistEntryLocation = {
  pathname?: string | null
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

export function buildWaitlistReferralPath(referralCode: string): string {
  const normalized = normalizeWaitlistReferralCode(referralCode)
  return normalized ? `${WAITLIST_REFERRAL_PATH_PREFIX}/${normalized}` : CANONICAL_MARKETING_WAITLIST_PATH
}

export function buildWaitlistReferralUrl(baseUrl: string, referralCode: string): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistReferralPath(referralCode)}`
}

export function getMarketingWaitlistReferralUrl(referralCode: string): string {
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

export function buildWaitlistEntryUrl(baseUrl: string): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistEntryPath()}`
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
