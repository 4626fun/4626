import { useMemo, useState, useCallback, useEffect } from 'react'
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

type WaitlistGroupChatPanelProps = {
  setupComplete: boolean
  signingReady: boolean
}

export function WaitlistGroupChatPanel(props: WaitlistGroupChatPanelProps) {
  if (!props.setupComplete) return null

  return (
    <AccountContextProvider>
      <XmtpChatProvider>
        <WaitlistGroupChatPanelInner {...props} />
      </XmtpChatProvider>
    </AccountContextProvider>
  )
}

function WaitlistGroupChatPanelInner({ signingReady }: WaitlistGroupChatPanelProps) {
  const { status: xmtpStatus } = useXmtp()
  const messagingReady = xmtpStatus === 'connected'
  const statusQuery = useWaitlistXmtpStatus(signingReady)
  const chatConfig = statusQuery.data
  const chatReady = chatConfig?.chatReady ?? false
  const joinStatus = useWaitlistChatJoin({
    xmtpMemberAddress: chatConfig?.xmtpMemberAddress,
    chatReady,
    enabled: signingReady,
    messagingReady,
  })

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
      ) : !chatConfig?.configured ? (
        <p className="text-xs text-zinc-400">
          Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.
        </p>
      ) : !chatReady ? (
        <p className="text-xs text-zinc-400">{blockedMessage}</p>
      ) : (
        <WaitlistGroupChatSurface
          groupId={chatConfig.groupId}
          groupName={groupName}
          joinStatus={joinStatus}
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
  if (!messagingReady && joinStatus === 'awaiting_messaging') {
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
  groupName: string
  joinStatus: WaitlistChatStatus
  signingReady: boolean
  chatReady: boolean
}) {
  const {
    status,
    connect,
    conversations,
    error,
    localStateResetRequired,
    resetLocalState,
    resetInstallations,
    installationLimitInboxId,
    refreshConversations,
    ensureConversationById,
  } = useXmtp()
  const { prepare, walletReady } = usePrepareWaitlistMessagingWallet(props.signingReady && props.chatReady)
  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [prepareBusy, setPrepareBusy] = useState(false)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [syncTimedOut, setSyncTimedOut] = useState(false)

  const handleConnectMessaging = useCallback(async () => {
    setPrepareError(null)
    setPrepareBusy(true)
    try {
      const prepared = await prepare()
      if (!prepared.ok) {
        setPrepareError(prepared.error)
        return
      }
      await connect('user')
    } finally {
      setPrepareBusy(false)
    }
  }, [connect, prepare])

  const groupConversation = useMemo(() => {
    const groupId = props.groupId
    if (!groupId) return null
    return (
      conversations.find(
        (conversation) =>
          conversation.type === 'group' &&
          (conversation.id === groupId || conversation.id.toLowerCase() === groupId.toLowerCase()),
      ) ?? null
    )
  }, [conversations, props.groupId])

  const handleRefreshGroup = useCallback(async () => {
    if (!props.groupId) {
      await refreshConversations()
      return
    }
    setRefreshBusy(true)
    setSyncTimedOut(false)
    try {
      await ensureConversationById(props.groupId)
    } finally {
      setRefreshBusy(false)
    }
  }, [ensureConversationById, props.groupId, refreshConversations])

  useEffect(() => {
    if (status !== 'connected' || props.joinStatus !== 'executed' || !props.groupId || groupConversation) {
      setSyncTimedOut(false)
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 40

    const tick = async () => {
      if (cancelled || attempts >= maxAttempts) return
      attempts += 1
      await ensureConversationById(props.groupId!)
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
  }, [ensureConversationById, groupConversation, props.groupId, props.joinStatus, status])

  const isConnecting = status === 'signing' || status === 'connecting'
  const messagingReady = status === 'connected'
  const statusMessage = props.joinStatus !== 'idle' ? waitlistChatStatusMessage(props.joinStatus) : null

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

  if (!messagingReady && !isConnecting) {
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
          loading={prepareBusy}
          disabled={prepareBusy}
          onClick={() => void handleConnectMessaging()}
        >
          Connect messaging
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

  if (!groupConversation) {
    return (
      <div className="space-y-2">
        {statusMessage ? (
          <p className="text-xs text-zinc-400" role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {syncTimedOut ? (
          <p className="text-xs text-amber-200/90">
            The group is still syncing. Try refresh below, or close other 4626 tabs and reconnect messaging.
          </p>
        ) : null}
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
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {statusMessage && props.joinStatus !== 'executed' ? (
        <p className="text-[11px] text-zinc-500">{statusMessage}</p>
      ) : null}
      <ChatWindow
        conversationId={groupConversation.id}
        conversationName={groupConversation.name || props.groupName}
        conversationType="group"
        conversationImageUrl={groupConversation.imageUrl}
        minimized={false}
        variant="embedded"
        onMinimize={() => undefined}
        onClose={() => undefined}
      />
    </div>
  )
}
