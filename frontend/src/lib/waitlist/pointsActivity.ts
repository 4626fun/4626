import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export type PointsActivityRow = {
  id: string
  source: string
  label: string
  amount: number
  waitlistPoints: number
  amoeCredits: number
  createdAt: string
}

export type WaitlistPointsActivityBatch = {
  signupId: number
  activity: PointsActivityRow[]
}

export async function fetchWaitlistPointsActivity(limit = 30): Promise<WaitlistPointsActivityBatch | null> {
  const qs = new URLSearchParams({ limit: String(limit) })
  const response = await apiFetch(`/api/waitlist/points-activity?${qs.toString()}`, {
    method: 'GET',
    withCredentials: true,
  })
  const body = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistPointsActivityBatch> | null
  if (!response.ok || !body?.success || !body.data) return null
  return body.data
}
