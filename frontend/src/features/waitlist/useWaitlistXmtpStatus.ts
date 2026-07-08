import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'

export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'base-app-direct' | 'none-yet'

export type WaitlistXmtpStatus = {
  configured: boolean
  vaultConfigured: boolean
  groupId: string | null
  envGroupId: string | null
  vaultGroupId: string | null
  groupIdSource: 'vault' | 'env' | null
  groupIdMismatch: boolean
  groupName: string
  chatReady: boolean
  canJoin: boolean
  executionTrack: WaitlistChatExecutionTrack
  canonicalCswAddress: string | null
  xmtpMemberAddress: string | null
  joinBlockedReason: string | null
  joinAction: {
    actionId: number
    status: 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null
    lastError: string | null
  } | null
}

async function fetchWaitlistXmtpStatus(): Promise<WaitlistXmtpStatus> {
  const response = await apiFetch('/api/waitlist/xmtp-status')
  const json = (await response.json().catch(() => null)) as {
    success?: boolean
    error?: string
    data?: WaitlistXmtpStatus
  } | null
  if (!response.ok || !json?.success || !json.data) {
    const reason = json?.error ?? `waitlist_xmtp_status_${response.status}`
    const error = new Error(reason)
    if (response.status === 429) {
      error.name = 'RateLimitedError'
    } else if (response.status === 401 || response.status === 403) {
      error.name = 'UnauthorizedError'
    }
    throw error
  }
  return json.data
}

export function useWaitlistXmtpStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['waitlist-xmtp-status'],
    queryFn: fetchWaitlistXmtpStatus,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    // Retrying a 429 immediately just extends the rate-limit window.
    retry: (failureCount, error) =>
      error.name !== 'RateLimitedError' && error.name !== 'UnauthorizedError' && failureCount < 2,
    refetchInterval: (query) => {
      const joinStatus = query.state.data?.joinAction?.status ?? null
      if (joinStatus === 'pending' || joinStatus === 'retry' || joinStatus === 'executing') {
        return 8_000
      }
      return false
    },
  })
}
