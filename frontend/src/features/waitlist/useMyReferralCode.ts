import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

/**
 * Shape mirrored from the `WaitlistPositionResponse` on the server
 * (`frontend/api/_handlers/waitlist/_position.ts`). Only includes fields this
 * hook needs — additional fields from the endpoint are ignored.
 */
export type WaitlistPositionLite = {
  signupId: number
  referralCode: string | null
  pointsTotal: number
  referrals: {
    qualifiedCount: number
    pendingCount: number
    pendingCountCapped: number
    pendingCap: number
  }
}

type WaitlistPositionPayload = WaitlistPositionLite & Record<string, unknown>

async function fetchWaitlistPositionByEmail(email: string): Promise<WaitlistPositionLite | null> {
  const query = new URLSearchParams({ email })
  const res = await apiFetch(`/api/waitlist/position?${query.toString()}`, {
    withCredentials: true,
  })
  if (!res.ok) return null
  const json = (await res.json()) as ApiEnvelope<WaitlistPositionPayload | null>
  if (!json.success || !json.data) return null
  const payload = json.data
  return {
    signupId: payload.signupId,
    referralCode: payload.referralCode ?? null,
    pointsTotal:
      typeof (payload as { points?: { total?: unknown } }).points?.total === 'number'
        ? Math.max(0, Math.floor((payload as { points: { total: number } }).points.total))
        : 0,
    referrals: payload.referrals,
  }
}

/**
 * Returns the authenticated user's referral code + referral counts.
 * Returns `null` when the user has no email, isn't authorized for that
 * profile, or the backend returns no row. This is intentionally a soft
 * failure — the UI should hide share affordances rather than error.
 */
export function useMyReferralCode(email: string | null | undefined) {
  const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null
  return useQuery({
    queryKey: ['waitlist', 'position', 'self', normalizedEmail],
    queryFn: () =>
      normalizedEmail ? fetchWaitlistPositionByEmail(normalizedEmail) : Promise.resolve(null),
    enabled: Boolean(normalizedEmail),
    staleTime: 60_000,
  })
}
