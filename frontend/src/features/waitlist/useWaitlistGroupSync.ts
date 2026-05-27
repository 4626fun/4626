import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ChatConversation } from '@/lib/xmtp/provider'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { WAITLIST_GROUP_SYNC_DELAY_MS } from './waitlistGroupChatConstants'
import {
  collectWaitlistGroupIdCandidates,
  findWaitlistGroupConversation,
} from './waitlistXmtpGroupIds'
import { resyncWaitlistGroupMembership } from './waitlistXmtpResync'

type UseWaitlistGroupSyncParams = {
  groupId: string | null
  envGroupId: string | null
  vaultGroupId: string | null
  groupIdMismatch: boolean
  joinStatus: WaitlistChatStatus
  messagingConnected: boolean
  conversations: ChatConversation[]
  ensureConversationById: (conversationId: string) => Promise<ChatConversation | null>
  refreshConversations: () => Promise<ChatConversation[]>
}

export function useWaitlistGroupSync(params: UseWaitlistGroupSyncParams) {
  const {
    groupId,
    envGroupId,
    vaultGroupId,
    groupIdMismatch,
    joinStatus,
    messagingConnected,
    conversations,
    ensureConversationById,
    refreshConversations,
  } = params

  const [refreshBusy, setRefreshBusy] = useState(false)
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  const [resyncError, setResyncError] = useState<string | null>(null)
  const groupSyncAttemptRef = useRef(false)
  const groupSyncInFlightRef = useRef(false)
  const groupConversationRef = useRef<ChatConversation | null>(null)

  const groupIdCandidates = useMemo(
    () =>
      collectWaitlistGroupIdCandidates({
        groupId,
        envGroupId,
        vaultGroupId,
        groupIdMismatch,
      }),
    [envGroupId, groupId, groupIdMismatch, vaultGroupId],
  )

  const groupConversation = useMemo(
    () => findWaitlistGroupConversation(conversations, groupIdCandidates),
    [conversations, groupIdCandidates],
  )
  groupConversationRef.current = groupConversation

  useEffect(() => {
    if (joinStatus === 'executed') {
      setResyncError(null)
    }
  }, [joinStatus])

  useEffect(() => {
    if (groupConversation) {
      groupSyncAttemptRef.current = false
      setSyncTimedOut(false)
    }
  }, [groupConversation])

  const syncWaitlistGroups = useCallback(
    async (options?: { resyncMembership?: boolean }) => {
      if (groupSyncInFlightRef.current) {
        return groupConversationRef.current
      }
      groupSyncInFlightRef.current = true
      try {
        if (options?.resyncMembership && joinStatus !== 'executed') {
          const resync = await resyncWaitlistGroupMembership()
          if (!resync.ok) {
            setResyncError(resync.error)
          } else {
            setResyncError(null)
          }
        } else if (options?.resyncMembership) {
          setResyncError(null)
        }

        let resolved: ChatConversation | null = null
        for (const candidateId of groupIdCandidates) {
          resolved = await ensureConversationById(candidateId)
          if (resolved) break
        }
        if (!resolved) {
          await refreshConversations()
        }
        return resolved
      } finally {
        groupSyncInFlightRef.current = false
      }
    },
    [ensureConversationById, groupIdCandidates, joinStatus, refreshConversations],
  )

  useEffect(() => {
    if (
      !messagingConnected ||
      joinStatus !== 'executed' ||
      groupIdCandidates.length === 0 ||
      groupConversation ||
      groupSyncAttemptRef.current
    ) {
      return
    }

    groupSyncAttemptRef.current = true
    const timeoutId = window.setTimeout(() => {
      void syncWaitlistGroups({ resyncMembership: false }).finally(() => {
        if (!groupConversationRef.current) {
          setSyncTimedOut(true)
        }
      })
    }, WAITLIST_GROUP_SYNC_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    groupConversation,
    groupIdCandidates.length,
    joinStatus,
    messagingConnected,
    syncWaitlistGroups,
  ])

  const refreshGroup = useCallback(async () => {
    if (groupIdCandidates.length === 0) {
      await refreshConversations()
      return
    }
    setRefreshBusy(true)
    setSyncTimedOut(false)
    try {
      await syncWaitlistGroups({ resyncMembership: joinStatus !== 'executed' })
    } finally {
      setRefreshBusy(false)
    }
  }, [groupIdCandidates.length, joinStatus, refreshConversations, syncWaitlistGroups])

  return {
    groupIdCandidates,
    groupConversation,
    refreshBusy,
    syncTimedOut,
    resyncError,
    syncWaitlistGroups,
    refreshGroup,
  }
}
