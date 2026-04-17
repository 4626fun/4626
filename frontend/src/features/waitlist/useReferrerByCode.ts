import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { normalizeWaitlistReferralCode } from '@/lib/auth/waitlistEntry'

export type ReferrerDisplay = {
  display: string
  pointsTotal: number
  rank: number | null
}

async function fetchReferrerByCode(code: string): Promise<ReferrerDisplay | null> {
  const query = new URLSearchParams({ code })
  const res = await apiFetch(`/api/waitlist/referrer?${query.toString()}`)
  if (!res.ok) return null
  const json = (await res.json()) as ApiEnvelope<ReferrerDisplay | null>
  if (!json.success) return null
  return json.data ?? null
}

/**
 * Resolve a referral code to the referrer's public display name + signal.
 * Returns `null` for unknown codes or when the code is empty/invalid so the
 * caller can cleanly branch on "show a personalized banner vs not".
 *
 * Uses the same `normalizeWaitlistReferralCode` rules as the rest of the
 * waitlist flow, and hits the public `/api/waitlist/referrer` endpoint.
 */
export function useReferrerByCode(rawCode: string | null | undefined) {
  const normalized = normalizeWaitlistReferralCode(rawCode ?? '')
  return useQuery({
    queryKey: ['waitlist', 'referrer', normalized],
    queryFn: () => (normalized ? fetchReferrerByCode(normalized) : Promise.resolve(null)),
    enabled: Boolean(normalized),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
}
