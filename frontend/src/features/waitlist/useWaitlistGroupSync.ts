import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isXmtpRateLimitError } from '@/lib/xmtp/xmtpHelpers'
import type { ChatConversation } from '@/lib/xmtp/provider'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { formatWaitlistChatError } from './waitlistChatErrors'
import { WAITLIST_GROUP_SYNC_BACKOFF_MS } from './waitlistGroupChatConstants'
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
  groupName: string
  joinStatus: WaitlistChatStatus
  messagingConnected: boolean
  conversations: ChatConversation[]
  ensureConversationById: (
    conversationId: string,
    options?: { forceSync?: boolean },
  ) => Promise<ChatConversation | null>
  refreshConversations: (options?: { force?: boolean }) => Promise<ChatConversation[]>
}

function resolveWaitlistGroupFromSummaries(
  summaries: ChatConversation[],
  groupIdCandidates: readonly string[],
  groupName: string,
): ChatConversation | null {
  return findWaitlistGroupConversation(summaries, groupIdCandidates, { groupName })
}

export function useWaitlistGroupSync(params: UseWaitlistGroupSyncParams) {
  const {
    groupId,
    envGroupId,
    vaultGroupId,
    groupIdMismatch,
    groupName,
    joinStatus,
    messagingConnected,
    conversations,
    ensureConversationById,
    refreshConversations,
  } = params

  const [refreshBusy, setRefreshBusy] = useState(false)
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  const [resyncError, setResyncError] = useState<string | null>(null)
  const groupSyncStartedRef = useRef(false)
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
    () => resolveWaitlistGroupFromSummaries(conversations, groupIdCandidates, groupName),
    [conversations, groupIdCandidates, groupName],
  )
  groupConversationRef.current = groupConversation

  useEffect(() => {
    if (joinStatus === 'executed') {
      setResyncError(null)
    }
  }, [joinStatus])

  useEffect(() => {
    if (groupConversation) {
      groupSyncStartedRef.current = false
      setSyncTimedOut(false)
    }
  }, [groupConversation])

  const syncWaitlistGroups = useCallback(
    async (options?: { resyncMembership?: boolean; force?: boolean }) => {
      if (groupSyncInFlightRef.current) {
        return groupConversationRef.current
      }
      groupSyncInFlightRef.current = true
      const forceSync = options?.force ?? true
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

        let resolved: ChatConversation | null = groupConversationRef.current

        const refreshed = await refreshConversations({ force: forceSync })
        resolved =
          resolveWaitlistGroupFromSummaries(refreshed, groupIdCandidates, groupName) ?? resolved

        if (!resolved) {
          for (const candidateId of groupIdCandidates) {
            resolved = await ensureConversationById(candidateId, { forceSync })
            if (resolved) break
          }
        }

        if (!resolved) {
          const secondPass = await refreshConversations({ force: forceSync })
          resolved =
            resolveWaitlistGroupFromSummaries(secondPass, groupIdCandidates, groupName) ?? resolved
        }

        return resolved
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (isXmtpRateLimitError(message)) {
          setResyncError(formatWaitlistChatError(message))
        }
        return groupConversationRef.current
      } finally {
        groupSyncInFlightRef.current = false
      }
    },
    [ensureConversationById, groupIdCandidates, groupName, joinStatus, refreshConversations],
  )

  useEffect(() => {
    if (
      !messagingConnected ||
      joinStatus !== 'executed' ||
      groupIdCandidates.length === 0 ||
      groupConversation ||
      groupSyncStartedRef.current
    ) {
      return
    }

    groupSyncStartedRef.current = true
    let cancelled = false
    let attempt = 0

    const runBackoffSync = async () => {
      while (!cancelled && !groupConversationRef.current && attempt < WAITLIST_GROUP_SYNC_BACKOFF_MS.length) {
        const delay = WAITLIST_GROUP_SYNC_BACKOFF_MS[attempt] ?? 0
        if (delay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, delay))
        }
        if (cancelled || groupConversationRef.current) return
        await syncWaitlistGroups({ force: true })
        attempt += 1
      }
      if (!cancelled && !groupConversationRef.current) {
        setSyncTimedOut(true)
      }
    }

    void runBackoffSync()

    return () => {
      cancelled = true
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
      await refreshConversations({ force: true })
      return
    }
    setRefreshBusy(true)
    setSyncTimedOut(false)
    groupSyncStartedRef.current = false
    try {
      await syncWaitlistGroups({ resyncMembership: joinStatus !== 'executed', force: true })
      await refreshConversations({ force: true })
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
