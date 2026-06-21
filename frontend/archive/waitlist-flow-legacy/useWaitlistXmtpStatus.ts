import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'

export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'sub-account' | 'none-yet'

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
    throw new Error(reason)
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
    refetchInterval: (query) => {
      const joinStatus = query.state.data?.joinAction?.status ?? null
      if (joinStatus === 'pending' || joinStatus === 'retry' || joinStatus === 'executing') {
        return 8_000
      }
      return false
    },
  })
}
