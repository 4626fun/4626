import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { LeaderboardEntry } from './leaderboardUi'

export type WaitlistLeaderboardData = {
  page: number
  limit: number
  pointsType: 'total' | 'invite' | 'agent'
  totalCount: number
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

export async function fetchWaitlistLeaderboardPreview(limit = 15): Promise<WaitlistLeaderboardData> {
  const res = await apiFetch(
    `${API_ENDPOINTS.waitlist.leaderboard}?pointsType=total&page=1&limit=${limit}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  )
  const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistLeaderboardData> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || 'Leaderboard request failed')
  }
  return json.data
}

export function useWaitlistLeaderboardPreview(limit = 15) {
  return useQuery({
    queryKey: ['waitlist-leaderboard-preview', limit],
    queryFn: () => fetchWaitlistLeaderboardPreview(limit),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
