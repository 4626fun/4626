import { useCallback, useMemo, useState } from 'react'

import { ChatWindow } from '@/components/chat/ChatWindow'
import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'
import { useXmtp } from '@/lib/xmtp/provider'

import { usePrepareWaitlistMessagingWallet } from './usePrepareWaitlistMessagingWallet'
import { useWaitlistGroupSync } from './useWaitlistGroupSync'
import { useWaitlistMessagingConnect } from './useWaitlistMessagingConnect'
import { formatWaitlistChatError } from './waitlistChatErrors'
import type { WaitlistChatStatus } from './waitlistChatCopy'
import { findWaitlistGroupConversation } from './waitlistXmtpGroupIds'
import {
  deriveWaitlistXmtpPhase,
  WAITLIST_CHAT_SHELL_MIN_HEIGHT_PX,
  waitlistXmtpPhaseMessage,
} from './waitlistXmtpPhase'

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
  const chatConversationId = rekeyedConversationId ?? groupConversation?.id ?? null

  const {
    prepareError,
    prepareBusy,
    isConnecting,
    needsConnectMessaging,
    connectAndJoin,
    reconnectMessaging,
  } = useWaitlistMessagingConnect({
    xmtpStatus: status,
    privyAuthenticated,
    prepare,
    connect,
    disconnect,
    joinStatus,
    retryJoin,
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

  const phase = deriveWaitlistXmtpPhase({
    signingReady: true,
    statusLoading: false,
    statusError: false,
    configured: true,
    serviceUnavailable: false,
    chatReady,
    localStateResetRequired,
    xmtpStatus: status,
    joinStatus,
    hasGroupConversation: Boolean(groupConversation),
    syncTimedOut,
    needsConnectMessaging,
    prepareError,
    xmtpError: error,
  })

  const statusMessage = waitlistXmtpPhaseMessage(phase, {
    joinStatus,
    walletReady,
    error: prepareError ?? error,
    syncTimedOut,
  })

  const recoverGroupConversation = useCallback(async (): Promise<string | null> => {
    await syncWaitlistGroups({ resyncMembership: true })
    for (const candidateId of groupIdCandidates) {
      const resolved = await ensureConversationById(candidateId)
      if (resolved?.id) return resolved.id
    }
    const refreshed = await refreshConversations({ force: true })
    return findWaitlistGroupConversation(refreshed, groupIdCandidates)?.id ?? null
  }, [ensureConversationById, groupIdCandidates, refreshConversations, syncWaitlistGroups])

  const shellStyle = { minHeight: `${WAITLIST_CHAT_SHELL_MIN_HEIGHT_PX}px` }

  if (phase === 'chat_ready' && chatConversationId) {
    const chatConversationName = groupConversation?.name || groupName
    const chatConversationImageUrl = groupConversation?.imageUrl

    return (
      <div className="space-y-2" style={shellStyle}>
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

  return (
    <div className="flex flex-col justify-center space-y-3 py-2" style={shellStyle}>
      {phase === 'connecting' ? (
        <LoadingInline
          label={status === 'signing' ? 'Sign to enable messaging…' : 'Connecting to XMTP…'}
        />
      ) : (
        <>
          {statusMessage ? (
            <p
              className={`text-center text-xs leading-relaxed ${
                phase === 'connect_error' ? 'text-red-300' : 'text-zinc-400'
              }`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          ) : null}

          {displayJoinActionError ? (
            <p className="text-center text-xs text-red-300">{displayJoinActionError}</p>
          ) : null}

          {resyncError ? <p className="text-center text-xs text-red-300">{resyncError}</p> : null}

          {identityMismatch ? (
            <p className="text-center text-xs text-amber-200/90">
              Messaging opened the wrong wallet inbox. Reconnect to use your waitlist wallet (
              {xmtpMemberAddress?.slice(0, 6)}…{xmtpMemberAddress?.slice(-4)}).
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {phase === 'local_reset_required' ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void resetLocalState()}>
                Reset local XMTP state
              </Button>
            ) : null}

            {phase === 'connect_prompt' || phase === 'connect_error' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={prepareBusy || isConnecting}
                disabled={prepareBusy || isConnecting}
                onClick={() => void connectAndJoin()}
              >
                {isConnecting ? 'Connecting…' : 'Connect & join waitlist chat'}
              </Button>
            ) : null}

            {phase === 'join_in_progress' ? (
              <Button type="button" variant="secondary" size="sm" onClick={retryJoin}>
                Retry join
              </Button>
            ) : null}

            {phase === 'group_syncing' ? (
              <>
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
              </>
            ) : null}

            {installationLimitInboxId &&
            (phase === 'connect_prompt' || phase === 'connect_error' || phase === 'group_syncing') ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void resetInstallations()}>
                Free an XMTP install slot
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
