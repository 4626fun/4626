import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import type { LeaderboardEntry } from '@/features/waitlist/leaderboardUi'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import {
  fetchAccountTrayPoints,
  isAccountTrayPointsAuthError,
} from '@/lib/waitlist/accountTrayPoints'

type LeaderboardPage = {
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
  totalCount: number
}

async function fetchMiniLeaderboard(): Promise<LeaderboardPage> {
  const res = await apiFetch(`${API_ENDPOINTS.waitlist.leaderboard}?pointsType=total&page=1&limit=5`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<LeaderboardPage> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Leaderboard request failed')
  }
  return json.data
}

export type WaitlistGameHqData = {
  points: number | null
  rank: number | null
  referrals: number | null
  referralCode: string | null
  inviteUrl: string | null
  inviteDisplayPath: string | null
  topRows: LeaderboardEntry[]
  me: LeaderboardEntry | null
  meOutsideTop: boolean
  loading: boolean
  /** True when leaderboard + points sources both failed (or points auth missing and no score). */
  statsUnavailable: boolean
  inviteUnavailable: boolean
}

export function useWaitlistGameHq(input: {
  enabled: boolean
  accountMe: AccountSetupMe | null
  getPrivyAccessToken: (() => Promise<string | null>) | null
  joinedSessionAddress: string | null
}): WaitlistGameHqData {
  const { enabled, accountMe, getPrivyAccessToken, joinedSessionAddress } = input

  const leaderboardQuery = useQuery({
    queryKey: ['waitlist-game-hq', 'leaderboard', joinedSessionAddress],
    enabled,
    staleTime: 20_000,
    queryFn: fetchMiniLeaderboard,
  })

  const trayPointsQuery = useQuery({
    queryKey: ['waitlist-game-hq', 'points', joinedSessionAddress],
    enabled: enabled && Boolean(getPrivyAccessToken),
    staleTime: 15_000,
    retry: (failureCount, error) => !isAccountTrayPointsAuthError(error) && failureCount < 1,
    queryFn: async () => {
      const token = getPrivyAccessToken ? await getPrivyAccessToken().catch(() => null) : null
      return fetchAccountTrayPoints(20, token)
    },
  })

  return useMemo(() => {
    const me = leaderboardQuery.data?.me ?? null
    const topRows = leaderboardQuery.data?.leaderboard ?? []
    const tray = trayPointsQuery.data
    const hasScore = accountMe?.score != null
    const hasTrayTotal = typeof tray?.points.total === 'number'
    const hasMeTotal = typeof me?.pointsTotal === 'number'
    const pointsKnown = hasScore || hasTrayTotal || hasMeTotal
    const pointsDisplay = pointsKnown
      ? resolvePublicPointsDisplay({
          score: accountMe?.score ?? null,
          positionTotal: tray?.points.total ?? me?.pointsTotal ?? null,
        }).points
      : null
    const rank = tray?.rank.total ?? me?.rank ?? null
    const referrals =
      typeof tray?.points.invite === 'number'
        ? tray.points.invite
        : typeof me?.pointsInvite === 'number'
          ? me.pointsInvite
          : null
    const referralCode = me?.referralCode ?? null
    const inviteUrl = referralCode ? getMarketingWaitlistReferralUrl(referralCode) : null
    let inviteDisplayPath: string | null = null
    if (inviteUrl) {
      try {
        const parsed = new URL(inviteUrl)
        inviteDisplayPath = `${parsed.host}${parsed.pathname}`
      } catch {
        inviteDisplayPath = inviteUrl
      }
    }
    const meOutsideTop = Boolean(
      me && !topRows.some((row) => row.signupId === me.signupId),
    )
    const loading = leaderboardQuery.isLoading || trayPointsQuery.isLoading
    const leaderboardSettled = !leaderboardQuery.isLoading && !leaderboardQuery.isFetching
    const inviteUnavailable = leaderboardSettled && !referralCode
    const statsUnavailable =
      !loading &&
      !pointsKnown &&
      (leaderboardQuery.isError || trayPointsQuery.isError || !getPrivyAccessToken)

    return {
      points: pointsDisplay,
      rank,
      referrals,
      referralCode,
      inviteUrl,
      inviteDisplayPath,
      topRows,
      me,
      meOutsideTop,
      loading,
      statsUnavailable,
      inviteUnavailable,
    }
  }, [
    accountMe?.score,
    getPrivyAccessToken,
    leaderboardQuery.data,
    leaderboardQuery.isError,
    leaderboardQuery.isFetching,
    leaderboardQuery.isLoading,
    trayPointsQuery.data,
    trayPointsQuery.isError,
    trayPointsQuery.isLoading,
  ])
}
