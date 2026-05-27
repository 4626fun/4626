import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { PointsActivityRow } from '@/lib/waitlist/pointsActivity'

export type AccountTrayPointsSnapshot = {
  signupId: number
  tier: number
  leaderboardEligible: boolean
  points: {
    total: number
    invite: number
    signup: number
    tasks: number
    csw: number
    social: number
    bonus: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
  activity: PointsActivityRow[]
}

export class AccountTrayPointsAuthError extends Error {
  readonly code = 'account_tray_points_auth_required' as const

  constructor(message = 'Privy sign-in required for points') {
    super(message)
    this.name = 'AccountTrayPointsAuthError'
  }
}

export function isAccountTrayPointsAuthError(error: unknown): error is AccountTrayPointsAuthError {
  return error instanceof AccountTrayPointsAuthError
}

export async function fetchAccountTrayPoints(
  limit = 40,
  privyAccessToken?: string | null,
): Promise<AccountTrayPointsSnapshot> {
  const token = typeof privyAccessToken === 'string' ? privyAccessToken.trim() : ''
  if (!token) {
    throw new AccountTrayPointsAuthError()
  }

  const qs = new URLSearchParams({ limit: String(limit) })
  const response = await apiFetch(`/api/accounts/me/points?${qs.toString()}`, {
    method: 'GET',
    withCredentials: true,
    headers: { 'X-Privy-Token': token },
  })
  const body = (await response.json().catch(() => null)) as ApiEnvelope<AccountTrayPointsSnapshot> | null

  if (response.status === 401 || response.status === 403) {
    throw new AccountTrayPointsAuthError(
      typeof body?.error === 'string' ? body.error : 'Privy sign-in required for points',
    )
  }
  if (!response.ok || !body?.success || !body.data) {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load account points')
  }
  return body.data
}
