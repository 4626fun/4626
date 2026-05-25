import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { WaitlistMeData } from '@/hooks/canonicalWalletUtils'

/** Single react-query key for `/api/waitlist/me` — dedupes access + account context. */
export const WAITLIST_ME_QUERY_KEY = ['waitlist', 'me'] as const

export async function fetchWaitlistMe(): Promise<WaitlistMeData | null> {
  const res = await apiFetch('/api/waitlist/me', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
  if (!res.ok || !json?.success) return null
  return json.data ?? null
}
