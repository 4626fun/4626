import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'

import { ChatWindow } from '@/components/chat/ChatWindow'
import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'
import { XmtpChatProvider, useXmtp } from '@/lib/xmtp/provider'
import { AccountContextProvider } from '@/wallet/accountContext'

import {
  type WaitlistChatStatus,
  useWaitlistChatJoin,
  waitlistChatBlockedMessage,
  waitlistChatStatusMessage,
} from './useWaitlistChatJoin'
import { useWaitlistXmtpStatus } from './useWaitlistXmtpStatus'
import { usePrepareWaitlistMessagingWallet } from './usePrepareWaitlistMessagingWallet'
import {
  collectWaitlistGroupIdCandidates,
  findWaitlistGroupConversation,
} from './waitlistXmtpGroupIds'
import { resyncWaitlistGroupMembership } from './waitlistXmtpResync'
import { formatWaitlistChatError } from './waitlistChatErrors'

type WaitlistGroupChatPanelProps = {
  setupComplete: boolean
  signingReady: boolean
}

export function WaitlistGroupChatPanel(props: WaitlistGroupChatPanelProps) {
  if (!props.setupComplete) return null

  return (
    <AccountContextProvider>
      <WaitlistGroupChatPanelInner {...props} />
    </AccountContextProvider>
  )
}

function WaitlistGroupChatPanelInner(props: WaitlistGroupChatPanelProps) {
  const { signingReady, setupComplete } = props
  const statusQuery = useWaitlistXmtpStatus(setupComplete)
  const chatConfig = statusQuery.data
  const identityHintAddress = chatConfig?.xmtpMemberAddress ?? null

  if (statusQuery.isLoading && !chatConfig) {
    return (
      <section
        aria-label="Waitlist group chat"
        className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4"
      >
        <LoadingInline label="Loading waitlist chat…" />
      </section>
    )
  }

  return (
    <XmtpChatProvider identityHintAddress={identityHintAddress}>
      <WaitlistGroupChatPanelBody
        signingReady={signingReady}
        setupComplete={setupComplete}
        statusQuery={statusQuery}
      />
    </XmtpChatProvider>
  )
}

function WaitlistGroupChatPanelBody({
  signingReady,
  statusQuery,
}: WaitlistGroupChatPanelProps & {
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
}) {
  const { status: xmtpStatus } = useXmtp()
  const messagingReady = xmtpStatus === 'connected'
  const chatConfig = statusQuery.data
  const chatReady = chatConfig?.chatReady ?? false
  const join = useWaitlistChatJoin({
    xmtpMemberAddress: chatConfig?.xmtpMemberAddress,
    chatReady,
    enabled: signingReady,
    messagingReady,
    serverJoinActionStatus: chatConfig?.joinAction?.status ?? null,
  })
  const joinStatus = join.status
  const retryJoin = join.retryJoin
  const { refetch: refetchWaitlistStatus } = statusQuery

  useEffect(() => {
    if (joinStatus === 'executed' || joinStatus === 'failed' || joinStatus === 'pending' || joinStatus === 'executing') {
      void refetchWaitlistStatus()
    }
  }, [joinStatus, refetchWaitlistStatus])

  const groupName = chatConfig?.groupName ?? 'Waitlist chat'
  const blockedMessage = waitlistChatBlockedMessage({
    executionTrack: chatConfig?.executionTrack,
    joinBlockedReason: chatConfig?.joinBlockedReason,
  })

  return (
    <section
      aria-label="Waitlist group chat"
      className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-zinc-200">{groupName}</h3>
            <p className="text-[11px] text-zinc-400">XMTP group for waitlist members</p>
          </div>
        </div>
        <WaitlistJoinBadge joinStatus={joinStatus} chatReady={chatReady} messagingReady={messagingReady} />
      </div>

      {!signingReady ? (
        <p className="text-xs text-zinc-400">{blockedMessage}</p>
      ) : statusQuery.isLoading ? (
        <LoadingInline label="Loading waitlist chat…" />
      ) : statusQuery.isError ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            Could not load waitlist chat status. Refresh the page or try again in a moment.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : !chatConfig?.configured ? (
        <p className="text-xs text-zinc-400">
          Waitlist chat is not configured yet. Ask an admin to set WAITLIST_XMTP_GROUP_ID or the
          waitlist Keepr vault group.
        </p>
      ) : chatConfig.joinBlockedReason === 'service_unavailable' ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            Waitlist chat status is temporarily unavailable. Connect messaging below once signing is
            ready, or retry loading status.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void statusQuery.refetch()}>
            Retry status
          </Button>
        </div>
      ) : !chatConfig.vaultConfigured ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-200/90">
            Waitlist chat group is set, but the Keepr vault for automated joins is missing. You can still
            connect messaging; group join may fail until ops registers the waitlist vault.
          </p>
          {chatReady ? (
            <WaitlistGroupChatSurface
              groupId={chatConfig.groupId}
              envGroupId={chatConfig.envGroupId}
              vaultGroupId={chatConfig.vaultGroupId}
              groupIdMismatch={chatConfig.groupIdMismatch}
              groupName={groupName}
              joinStatus={joinStatus}
              joinActionError={chatConfig.joinAction?.lastError ?? null}
              xmtpMemberAddress={chatConfig.xmtpMemberAddress}
              retryJoin={retryJoin}
              signingReady={signingReady}
              chatReady={chatReady}
            />
          ) : (
            <p className="text-xs text-zinc-400">{blockedMessage}</p>
          )}
        </div>
      ) : !chatReady ? (
        <p className="text-xs text-zinc-400">{blockedMessage}</p>
      ) : (
        <WaitlistGroupChatSurface
          groupId={chatConfig.groupId}
          envGroupId={chatConfig.envGroupId}
          vaultGroupId={chatConfig.vaultGroupId}
          groupIdMismatch={chatConfig.groupIdMismatch}
          groupName={groupName}
          joinStatus={joinStatus}
          joinActionError={chatConfig.joinAction?.lastError ?? null}
          xmtpMemberAddress={chatConfig.xmtpMemberAddress}
          retryJoin={retryJoin}
          signingReady={signingReady}
          chatReady={chatReady}
        />
      )}
    </section>
  )
}

function WaitlistJoinBadge(props: {
  joinStatus: WaitlistChatStatus
  chatReady: boolean
  messagingReady: boolean
}) {
  const { joinStatus, chatReady, messagingReady } = props

  if (!chatReady || joinStatus === 'idle') {
    return null
  }
  if (joinStatus === 'awaiting_messaging') {
    return null
  }

  const label =
    joinStatus === 'executed'
      ? 'Added'
      : joinStatus === 'failed' || joinStatus === 'error'
        ? 'Join failed'
        : 'Joining…'

  const tone =
    joinStatus === 'executed'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
      : joinStatus === 'failed' || joinStatus === 'error'
        ? 'border-red-400/25 bg-red-500/10 text-red-200'
        : 'border-brand-primary/25 bg-brand-primary/10 text-brand-primary'

  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  )
}

function WaitlistGroupChatSurface(props: {
  groupId: string | null
  envGroupId: string | null
  vaultGroupId: string | null
  groupIdMismatch: boolean
  groupName: string
  joinStatus: WaitlistChatStatus
  joinActionError: string | null
  xmtpMemberAddress: string | null
  retryJoin: () => void
  signingReady: boolean
  chatReady: boolean
}) {
  const {
    groupId,
    envGroupId,
    vaultGroupId,
    groupIdMismatch,
    groupName,
    joinStatus,
    joinActionError,
    xmtpMemberAddress,
    retryJoin,
    signingReady,
    chatReady,
  } = props
  const {
    status,
    connect,
    conversations,
    error,
    identityAddress,
    localStateResetRequired,
    resetLocalState,
    resetInstallations,
    installationLimitInboxId,
    refreshConversations,
    ensureConversationById,
    disconnect,
  } = useXmtp()
  const { prepare, walletReady } = usePrepareWaitlistMessagingWallet(signingReady && chatReady)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [prepareBusy, setPrepareBusy] = useState(false)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [syncTimedOut, setSyncTimedOut] = useState(false)
  const mismatchRejoinRef = useRef(false)
  const autoRecoveryRef = useRef(false)
  const [autoRecoveryBusy, setAutoRecoveryBusy] = useState(false)
  const [resyncError, setResyncError] = useState<string | null>(null)

  const displayJoinActionError = useMemo(() => {
    if (joinStatus === 'executed') return null
    return formatWaitlistChatError(joinActionError)
  }, [joinActionError, joinStatus])

  useEffect(() => {
    if (joinStatus === 'executed') {
      setResyncError(null)
    }
  }, [joinStatus])

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

  const syncWaitlistGroups = useCallback(async (options?: { resyncMembership?: boolean }) => {
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
    let resolved = null
    for (const candidateId of groupIdCandidates) {
      resolved = await ensureConversationById(candidateId)
      if (resolved) break
    }
    if (!resolved) {
      await refreshConversations()
    }
    return resolved
  }, [ensureConversationById, groupIdCandidates, joinStatus, refreshConversations])

  const handleConnectMessaging = useCallback(async (options?: { skipJoinRetry?: boolean }) => {
    setPrepareError(null)
    setPrepareBusy(true)
    try {
      const expected = xmtpMemberAddress?.trim().toLowerCase() ?? null
      const actual = identityAddress?.trim().toLowerCase() ?? null
      if (status === 'connected' && expected && actual && expected !== actual) {
        disconnect()
      }
      const prepared = await prepare()
      if (!prepared.ok) {
        setPrepareError(prepared.error)
        return
      }
      await connect('user')
      if (!options?.skipJoinRetry && joinStatus !== 'executed') {
        retryJoin()
      }
      await syncWaitlistGroups({ resyncMembership: joinStatus === 'executed' })
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : String(err))
    } finally {
      setPrepareBusy(false)
    }
  }, [connect, disconnect, identityAddress, joinStatus, prepare, retryJoin, status, syncWaitlistGroups, xmtpMemberAddress])

  const handleReconnectMessaging = useCallback(async () => {
    disconnect()
    retryJoin()
    await handleConnectMessaging()
  }, [disconnect, handleConnectMessaging, retryJoin])

  const identityMismatch = useMemo(() => {
    const expected = xmtpMemberAddress?.trim().toLowerCase() ?? null
    const actual = identityAddress?.trim().toLowerCase() ?? null
    if (!expected || !actual) return false
    return expected !== actual
  }, [identityAddress, xmtpMemberAddress])

  const groupConversation = useMemo(
    () => findWaitlistGroupConversation(conversations, groupIdCandidates),
    [conversations, groupIdCandidates],
  )

  const effectiveGroupId =
    groupConversation?.id ??
    (joinStatus === 'executed' && groupIdCandidates[0] ? groupIdCandidates[0] : null)

  const handleRefreshGroup = useCallback(async () => {
    if (groupIdCandidates.length === 0) {
      await refreshConversations()
      return
    }
    setRefreshBusy(true)
    setSyncTimedOut(false)
    try {
      await syncWaitlistGroups({ resyncMembership: true })
    } finally {
      setRefreshBusy(false)
    }
  }, [groupIdCandidates.length, refreshConversations, syncWaitlistGroups])

  const isConnecting = status === 'signing' || status === 'connecting'
  const messagingReady = status === 'connected'
  const staleAwaitingJoin = messagingReady && joinStatus === 'awaiting_messaging'
  const needsConnectMessaging = !messagingReady && !isConnecting
  const statusMessage =
    staleAwaitingJoin
      ? waitlistChatStatusMessage('joining')
      : needsConnectMessaging
        ? waitlistChatStatusMessage('awaiting_messaging')
        : joinStatus !== 'idle'
          ? waitlistChatStatusMessage(joinStatus)
          : null

  useEffect(() => {
    if (joinStatus !== 'executed' || !messagingReady || groupConversation) return
    void syncWaitlistGroups({ resyncMembership: true })
  }, [groupConversation, joinStatus, messagingReady, syncWaitlistGroups])

  useEffect(() => {
    if (
      !messagingReady ||
      !groupIdMismatch ||
      joinStatus !== 'executed' ||
      groupConversation ||
      mismatchRejoinRef.current
    ) {
      return
    }
    mismatchRejoinRef.current = true
    retryJoin()
  }, [groupConversation, groupIdMismatch, joinStatus, messagingReady, retryJoin])

  useEffect(() => {
    if (
      status !== 'connected' ||
      groupIdCandidates.length === 0 ||
      groupConversation
    ) {
      setSyncTimedOut(false)
      return
    }
    const shouldSync =
      joinStatus === 'executed' ||
      joinStatus === 'pending' ||
      joinStatus === 'executing'
    if (!shouldSync) {
      setSyncTimedOut(false)
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 40

    const tick = async () => {
      if (cancelled || attempts >= maxAttempts) return
      attempts += 1
      const shouldResync = attempts === 1 || attempts % 3 === 0
      await syncWaitlistGroups({ resyncMembership: shouldResync })
      if (cancelled) return
      if (attempts >= maxAttempts) {
        setSyncTimedOut(true)
      }
    }

    void tick()
    const intervalId = window.setInterval(() => {
      void tick()
    }, 3_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [groupConversation, groupIdCandidates.length, joinStatus, status, syncWaitlistGroups])

  useEffect(() => {
    if (!staleAwaitingJoin) return
    retryJoin()
  }, [retryJoin, staleAwaitingJoin])

  useEffect(() => {
    if (
      !syncTimedOut ||
      joinStatus !== 'executed' ||
      groupConversation ||
      autoRecoveryRef.current ||
      autoRecoveryBusy
    ) {
      return
    }
    autoRecoveryRef.current = true
    setAutoRecoveryBusy(true)
    void (async () => {
      try {
        setSyncTimedOut(false)
        disconnect()
        await resetLocalState()
        await handleConnectMessaging({ skipJoinRetry: true })
      } finally {
        setAutoRecoveryBusy(false)
      }
    })()
  }, [
    autoRecoveryBusy,
    disconnect,
    groupConversation,
    handleConnectMessaging,
    joinStatus,
    resetLocalState,
    syncTimedOut,
  ])

  if (localStateResetRequired) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
        <p className="text-xs leading-relaxed text-amber-100/90">
          This browser&apos;s XMTP cache no longer validates against your inbox. Reset local messaging state to
          reconnect on 4626.fun.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void resetLocalState()}>
          Reset local XMTP state
        </Button>
      </div>
    )
  }

  if (needsConnectMessaging) {
    const displayError = prepareError ?? error
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4 text-center">
        <p className="text-xs text-zinc-400">
          {displayError ? (
            <span className="text-red-300">{displayError}</span>
          ) : walletReady ? (
            'Wallet signer is ready. Click Connect messaging and approve one signature to create your inbox.'
          ) : (
            'Click Connect messaging below to create your XMTP inbox in this browser. After signing once, we add you to the waitlist group automatically.'
          )}
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={prepareBusy || isConnecting}
          disabled={prepareBusy || isConnecting}
          onClick={() => void handleConnectMessaging()}
        >
          {isConnecting ? 'Connecting…' : 'Connect messaging'}
        </Button>
        {installationLimitInboxId ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void resetInstallations()}>
            Free an XMTP install slot
          </Button>
        ) : null}
      </div>
    )
  }

  if (isConnecting) {
    return (
      <LoadingInline
        label={status === 'signing' ? 'Sign to enable messaging…' : 'Connecting to XMTP…'}
      />
    )
  }

  if (!effectiveGroupId) {
    return (
      <div className="space-y-2">
        {statusMessage ? (
          <p className="text-xs text-zinc-400" role="status" aria-live="polite">
            {autoRecoveryBusy
              ? 'Refreshing your waitlist chat inbox…'
              : statusMessage}
          </p>
        ) : null}
        {resyncError ? <p className="text-xs text-red-300">{resyncError}</p> : null}
        {displayJoinActionError &&
        (joinStatus === 'failed' ||
          joinStatus === 'error' ||
          joinStatus === 'pending' ||
          joinStatus === 'executing') ? (
          <p className="text-xs text-red-300">{displayJoinActionError}</p>
        ) : null}
        {groupIdMismatch && joinStatus !== 'executed' ? (
          <p className="text-xs text-amber-200/90">
            Waitlist chat is migrating to the live vault group ({vaultGroupId?.slice(0, 8)}…). We
            will add you there automatically.
          </p>
        ) : null}
        {identityMismatch ? (
          <p className="text-xs text-amber-200/90">
            Messaging opened the wrong wallet inbox for waitlist chat. Reconnect messaging so we use your
            waitlist wallet ({xmtpMemberAddress?.slice(0, 6)}…{xmtpMemberAddress?.slice(-4)}),
            then retry join.
          </p>
        ) : null}
        {identityAddress && xmtpMemberAddress && !identityMismatch && joinStatus === 'executed' ? (
          <p className="text-[11px] text-zinc-500">
            Syncing inbox {identityAddress.slice(0, 6)}…{identityAddress.slice(-4)} for{' '}
            {groupIdCandidates.length > 1 ? `${groupIdCandidates.length} group ids` : 'group'}{' '}
            {groupIdCandidates[0]?.slice(0, 8)}…
          </p>
        ) : null}
        {syncTimedOut ? (
          <p className="text-xs text-amber-200/90">
            The group is still syncing. Try refresh below, reset local messaging state, or reconnect
            messaging.
          </p>
        ) : null}
        {syncTimedOut ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void resetLocalState()}>
            Reset local XMTP state
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={refreshBusy}
            disabled={refreshBusy}
            onClick={() => void handleRefreshGroup()}
          >
            Refresh conversations
          </Button>
          {identityMismatch || syncTimedOut || joinStatus === 'executed' ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => void handleReconnectMessaging()}>
              Reconnect messaging
            </Button>
          ) : null}
          {(joinStatus === 'failed' ||
            joinStatus === 'error' ||
            joinStatus === 'pending' ||
            joinStatus === 'executing' ||
            syncTimedOut ||
            groupIdMismatch) && (
            <Button type="button" variant="primary" size="sm" onClick={retryJoin}>
              Retry join
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!groupConversation && joinStatus === 'executed' ? (
        <p className="text-[11px] text-zinc-500" role="status" aria-live="polite">
          {autoRecoveryBusy
            ? 'Refreshing your waitlist chat inbox…'
            : 'Opening waitlist chat. Messages may take a moment to appear.'}
        </p>
      ) : null}
      {statusMessage && joinStatus !== 'executed' ? (
        <p className="text-[11px] text-zinc-500">{statusMessage}</p>
      ) : null}
      {resyncError ? <p className="text-xs text-red-300">{resyncError}</p> : null}
      <ChatWindow
        conversationId={effectiveGroupId}
        conversationName={groupConversation?.name || groupName}
        conversationType="group"
        conversationImageUrl={groupConversation?.imageUrl}
        minimized={false}
        variant="embedded"
        onMinimize={() => undefined}
        onClose={() => undefined}
      />
    </div>
  )
}
