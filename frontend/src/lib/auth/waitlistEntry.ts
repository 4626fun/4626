import { getMarketingBaseUrl } from '@/lib/host'

const CANONICAL_MARKETING_WAITLIST_PATH = '/waitlist'

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

export function isMarketingWaitlistEntryLocation(location: WaitlistEntryLocation): boolean {
  const rawPath = String(location.pathname ?? '').trim()
  const pathname = rawPath.length === 0 ? '/' : rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return pathname === CANONICAL_MARKETING_WAITLIST_PATH
}

export function buildWaitlistEntryPath(): string {
  return CANONICAL_MARKETING_WAITLIST_PATH
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
