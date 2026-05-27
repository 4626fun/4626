import { useCallback, useMemo, useState } from 'react'

import { ChatWindow } from '@/components/chat/ChatWindow'
import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'
import { useXmtp } from '@/lib/xmtp/provider'

import { usePrepareWaitlistMessagingWallet } from './usePrepareWaitlistMessagingWallet'
import { useWaitlistGroupSync } from './useWaitlistGroupSync'
import { useWaitlistMessagingConnect } from './useWaitlistMessagingConnect'
import { formatWaitlistChatError } from './waitlistChatErrors'
import { waitlistChatStatusMessage, type WaitlistChatStatus } from './waitlistChatCopy'
import { findWaitlistGroupConversation } from './waitlistXmtpGroupIds'

export type WaitlistGroupChatSurfaceProps = {
  groupId: string | null
  envGroupId: string | null
  vaultGroupId: string | null
  groupIdMismatch: boolean
  groupName: string
  joinStatus: WaitlistChatStatus
  joinActionError: string | null
  xmtpMemberAddress: string | null
  retryJoin: () => void
  chatReady: boolean
}

export function WaitlistGroupChatSurface(props: WaitlistGroupChatSurfaceProps) {
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

  const { prepare, walletReady, privyAuthenticated } = usePrepareWaitlistMessagingWallet(chatReady)

  const messagingConnected = status === 'connected'
  const {
    groupIdCandidates,
    groupConversation,
    refreshBusy,
    syncTimedOut,
    resyncError,
    syncWaitlistGroups,
    refreshGroup,
  } = useWaitlistGroupSync({
    groupId,
    envGroupId,
    vaultGroupId,
    groupIdMismatch,
    joinStatus,
    messagingConnected,
    conversations,
    ensureConversationById,
    refreshConversations,
  })

  const [rekeyedConversationId, setRekeyedConversationId] = useState<string | null>(null)
  const syncedConversationId = groupConversation?.id ?? null
  const chatConversationId = rekeyedConversationId ?? syncedConversationId

  const recoverGroupConversation = useCallback(async (): Promise<string | null> => {
    await syncWaitlistGroups({ resyncMembership: true })
    for (const candidateId of groupIdCandidates) {
      const resolved = await ensureConversationById(candidateId)
      if (resolved?.id) return resolved.id
    }
    const refreshed = await refreshConversations()
    return findWaitlistGroupConversation(refreshed, groupIdCandidates)?.id ?? null
  }, [
    ensureConversationById,
    groupIdCandidates,
    refreshConversations,
    syncWaitlistGroups,
  ])

  const {
    prepareError,
    prepareBusy,
    isConnecting,
    needsConnectMessaging,
    connectMessaging,
    reconnectMessaging,
  } = useWaitlistMessagingConnect({
    xmtpStatus: status,
    privyAuthenticated,
    prepare,
    connect,
    disconnect,
    joinStatus,
    retryJoin,
    syncWaitlistGroups,
    walletReady,
  })

  const displayJoinActionError = useMemo(() => {
    if (joinStatus === 'executed') return null
    return formatWaitlistChatError(joinActionError)
  }, [joinActionError, joinStatus])

  const identityMismatch = useMemo(() => {
    const expected = xmtpMemberAddress?.trim().toLowerCase() ?? null
    const actual = identityAddress?.trim().toLowerCase() ?? null
    if (!expected || !actual) return false
    return expected !== actual
  }, [identityAddress, xmtpMemberAddress])

  if (localStateResetRequired) {
    return (
      <div className="space-y-3 py-1">
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
      <div className="space-y-3 py-1 text-center">
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
          onClick={() => void connectMessaging()}
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

  if (isConnecting && !messagingConnected) {
    return (
      <LoadingInline
        label={status === 'signing' ? 'Sign to enable messaging…' : 'Connecting to XMTP…'}
      />
    )
  }

  if (!groupConversation && joinStatus === 'executed') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400" role="status" aria-live="polite">
          {syncTimedOut
            ? 'Waitlist chat is still syncing.'
            : 'Pulling waitlist chat into this browser…'}
        </p>
        {resyncError ? <p className="text-xs text-red-300">{resyncError}</p> : null}
        {identityMismatch ? (
          <p className="text-xs text-amber-200/90">
            Messaging opened the wrong wallet inbox for waitlist chat. Reconnect messaging so we use your
            waitlist wallet ({xmtpMemberAddress?.slice(0, 6)}…{xmtpMemberAddress?.slice(-4)}).
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={refreshBusy}
            disabled={refreshBusy}
            onClick={() => void refreshGroup()}
          >
            Refresh
          </Button>
          {identityMismatch || syncTimedOut ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => void reconnectMessaging()}>
              Reconnect messaging
            </Button>
          ) : null}
          {syncTimedOut ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => void resetLocalState()}>
              Reset local XMTP state
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (
    !groupConversation &&
    (joinStatus === 'pending' || joinStatus === 'executing' || joinStatus === 'joining')
  ) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400" role="status" aria-live="polite">
          {waitlistChatStatusMessage(joinStatus)}
        </p>
        {displayJoinActionError ? <p className="text-xs text-red-300">{displayJoinActionError}</p> : null}
        <Button type="button" variant="secondary" size="sm" onClick={retryJoin}>
          Retry join
        </Button>
      </div>
    )
  }

  if (!chatConversationId) {
    return null
  }

  const chatConversationName = groupConversation?.name || groupName
  const chatConversationImageUrl = groupConversation?.imageUrl

  return (
    <div className="space-y-2">
      {resyncError ? <p className="text-xs text-red-300">{resyncError}</p> : null}
      <ChatWindow
        conversationId={chatConversationId}
        conversationName={chatConversationName}
        conversationType="group"
        conversationImageUrl={chatConversationImageUrl}
        minimized={false}
        variant="embedded"
        embeddedChrome="inline"
        onConversationRekey={(_oldId, newId) => setRekeyedConversationId(newId)}
        recoverGroupConversation={recoverGroupConversation}
        onMinimize={() => undefined}
        onClose={() => undefined}
      />
    </div>
  )
}
