import { getAppBaseUrl, getMarketingBaseUrl } from '@/lib/host'

export type WaitlistEntryReason = 'needs-session' | 'needs-acceptance'

export function buildWaitlistEntryPath(reason: WaitlistEntryReason): string {
  const params = new URLSearchParams({ reason })
  return `/?${params.toString()}#waitlist`
}

export function buildWaitlistEntryUrl(baseUrl: string, reason: WaitlistEntryReason): string {
  const base = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${base}${buildWaitlistEntryPath(reason)}`
}

export function getPrivyCapableWaitlistEntryUrl(reason: WaitlistEntryReason): string {
  return buildWaitlistEntryUrl(getAppBaseUrl(), reason)
}

export function getMarketingWaitlistEntryUrl(reason: WaitlistEntryReason): string {
  return buildWaitlistEntryUrl(getMarketingBaseUrl(), reason)
}
