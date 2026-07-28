import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { normalizeWaitlistReferralCode } from '@/lib/auth/waitlistEntry'

type ReferrerPayload = {
  display: string
  pointsTotal: number
  rank: number | null
} | null

async function fetchReferrer(code: string): Promise<ReferrerPayload> {
  const res = await apiFetch(`/api/waitlist/referrer?code=${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<ReferrerPayload> | null
  if (!res.ok || !json?.success) return null
  return json.data ?? null
}

export function WaitlistInvitedBy({ referralCode }: { referralCode: string | null }) {
  const code = normalizeWaitlistReferralCode(referralCode)
  const referrerQuery = useQuery({
    queryKey: ['waitlist-referrer', code],
    enabled: Boolean(code),
    staleTime: 60_000,
    queryFn: () => fetchReferrer(code as string),
  })

  if (!code) return null

  const display = referrerQuery.data?.display?.trim()
  const label = display ? display : code

  return (
    <p
      className="text-center text-[12px] leading-relaxed text-[rgb(var(--brand-gold-light)/0.85)]"
      data-testid="waitlist-invited-by"
    >
      Invited by <span className="font-medium text-[rgb(var(--brand-gold))]">{label}</span>
    </p>
  )
}
