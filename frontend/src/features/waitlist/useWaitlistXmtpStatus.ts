import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'

export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'sub-account' | 'none-yet'

export type WaitlistXmtpStatus = {
  configured: boolean
  vaultConfigured: boolean
  groupId: string | null
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

async function fetchWaitlistXmtpStatus(): Promise<WaitlistXmtpStatus | null> {
  const response = await apiFetch('/api/waitlist/xmtp-status')
  if (!response.ok) return null
  const json = (await response.json()) as { success?: boolean; data?: WaitlistXmtpStatus }
  return json.data ?? null
}

export function useWaitlistXmtpStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['waitlist-xmtp-status'],
    queryFn: fetchWaitlistXmtpStatus,
    enabled,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const joinStatus = query.state.data?.joinAction?.status ?? null
      if (joinStatus === 'pending' || joinStatus === 'retry' || joinStatus === 'executing') {
        return 3_000
      }
      return false
    },
  })
}
