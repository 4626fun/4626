import { getMarketingBaseUrl } from '@/lib/host'

export type WaitlistEntryReason = 'needs-session' | 'needs-acceptance'
const CANONICAL_MARKETING_WAITLIST_HASH = '#waitlist'
const CANONICAL_MARKETING_WAITLIST_PATH = `/${CANONICAL_MARKETING_WAITLIST_HASH}`

type WaitlistEntryLocation = {
  pathname?: string | null
  hash?: string | null
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
  const hash = String(location.hash ?? '').trim()
  return pathname === '/' && hash === CANONICAL_MARKETING_WAITLIST_HASH
}

export function buildWaitlistEntryPath(reason: WaitlistEntryReason): string {
  const params = new URLSearchParams({ reason })
  return `/?${params.toString()}${CANONICAL_MARKETING_WAITLIST_HASH}`
}

export function buildWaitlistEntryUrl(baseUrl: string, reason: WaitlistEntryReason): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistEntryPath(reason)}`
}

export function getPrivyCapableWaitlistEntryUrl(reason: WaitlistEntryReason): string {
  return buildWaitlistEntryUrl(getMarketingBaseUrl(), reason)
}

export function getMarketingWaitlistEntryUrl(reason: WaitlistEntryReason): string {
  return buildWaitlistEntryUrl(getMarketingBaseUrl(), reason)
}
