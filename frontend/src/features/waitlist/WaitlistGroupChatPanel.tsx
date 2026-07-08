import { useCallback, useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'
import { XmtpChatProvider, useXmtp } from '@/lib/xmtp/provider'
import { WaitlistMessagingAccountContextProvider } from './WaitlistMessagingAccountContextProvider'

import {
  useWaitlistChatJoin,
  waitlistChatBlockedMessage,
  type WaitlistChatStatus,
} from './useWaitlistChatJoin'
import { useWaitlistXmtpStatus } from './useWaitlistXmtpStatus'
import { WaitlistGroupChatSurface } from './WaitlistGroupChatSurface'
import { WaitlistMessagingWalletProviders } from './WaitlistMessagingWalletProviders'
import { useWaitlistMessagingSessionRepair } from './useWaitlistMessagingSessionRepair'
import type { WaitlistConnectTrack } from './waitlistFlowState'

type WaitlistGroupChatPanelProps = {
  setupComplete: boolean
  messagingReady: boolean
  connectTrack: WaitlistConnectTrack
  layout?: 'inline' | 'sidebar' | 'mobile' | 'dock'
  /** Forwarded to surface for the embedded signer expiry recovery path. */
  onSignOut?: () => void
  signOutBusy?: boolean
  /** Preferred recovery path: repair session drift without hard sign-out. */
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
}

export function WaitlistGroupChatPanel(props: WaitlistGroupChatPanelProps) {
  if (!props.setupComplete) return null

  return <WaitlistGroupChatPanelInner {...props} />
}

function WaitlistGroupChatPanelInner(props: WaitlistGroupChatPanelProps) {
  const {
    messagingReady,
    connectTrack,
    setupComplete,
    layout = 'inline',
    onSignOut,
    signOutBusy,
    onRepairSession: onRepairSessionProp,
    repairBusy: repairBusyProp,
  } = props
  const statusQuery = useWaitlistXmtpStatus(setupComplete)
  const chatConfig = statusQuery.data
  const identityHintAddress = chatConfig?.xmtpMemberAddress ?? null
  const repairSession = useWaitlistMessagingSessionRepair()
  const [localRepairBusy, setLocalRepairBusy] = useState(false)

  const handleRepairSession = useCallback(async () => {
    setLocalRepairBusy(true)
    try {
      const outcome = await repairSession()
      return outcome === 'repaired'
    } finally {
      setLocalRepairBusy(false)
    }
  }, [repairSession])

  const attemptXmtpSessionRepair = useCallback(async () => {
    const outcome = await repairSession()
    return outcome === 'repaired'
  }, [repairSession])

  const onRepairSession = onRepairSessionProp ?? handleRepairSession
  const repairBusy = repairBusyProp ?? localRepairBusy

  return (
    <WaitlistMessagingWalletProviders
      connectTrack={connectTrack}
      fallback={
        <WaitlistChatSection layout={layout}>
          <LoadingInline labelOverride="Loading waitlist chat…" />
        </WaitlistChatSection>
      }
    >
      <WaitlistGroupChatMessagingTree
        messagingReady={messagingReady}
        connectTrack={connectTrack}
        layout={layout}
        statusQuery={statusQuery}
        chatConfig={chatConfig}
        identityHintAddress={identityHintAddress}
        onSignOut={onSignOut}
        signOutBusy={signOutBusy}
        onRepairSession={onRepairSession}
        repairBusy={repairBusy}
        attemptXmtpSessionRepair={attemptXmtpSessionRepair}
      />
    </WaitlistMessagingWalletProviders>
  )
}

function WaitlistGroupChatMessagingTree(props: {
  messagingReady: boolean
  connectTrack: WaitlistConnectTrack
  layout: 'inline' | 'sidebar' | 'mobile' | 'dock'
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
  chatConfig: ReturnType<typeof useWaitlistXmtpStatus>['data']
  identityHintAddress: string | null
  onSignOut?: () => void
  signOutBusy?: boolean
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
  attemptXmtpSessionRepair: () => Promise<boolean>
}) {
  const {
    messagingReady,
    connectTrack,
    layout,
    statusQuery,
    chatConfig,
    identityHintAddress,
    onSignOut,
    signOutBusy,
    onRepairSession,
    repairBusy,
    attemptXmtpSessionRepair,
  } = props

  return (
    <WaitlistMessagingAccountContextProvider xmtpMemberAddress={identityHintAddress}>
      <XmtpChatProvider
        identityHintAddress={identityHintAddress}
        manualConnectOnly
        attemptSessionRepair={attemptXmtpSessionRepair}
      >
        {statusQuery.isLoading && !chatConfig ? (
          <WaitlistChatSection layout={layout}>
            <LoadingInline labelOverride="Loading waitlist chat…" />
          </WaitlistChatSection>
        ) : (
          <WaitlistGroupChatPanelBody
            messagingReady={messagingReady}
            connectTrack={connectTrack}
            statusQuery={statusQuery}
            layout={layout}
            onSignOut={onSignOut}
            signOutBusy={signOutBusy}
            onRepairSession={onRepairSession}
            repairBusy={repairBusy}
          />
        )}
      </XmtpChatProvider>
    </WaitlistMessagingAccountContextProvider>
  )
}

function WaitlistGroupChatPanelBody({
  messagingReady: accountMessagingReady,
  connectTrack,
  statusQuery,
  layout,
  onSignOut,
  signOutBusy,
  onRepairSession,
  repairBusy,
}: {
  messagingReady: boolean
  connectTrack: WaitlistConnectTrack
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
  layout: 'inline' | 'sidebar' | 'mobile' | 'dock'
  onSignOut?: () => void
  signOutBusy?: boolean
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
}) {
  const { status: xmtpStatus } = useXmtp()
  const xmtpConnected = xmtpStatus === 'connected'
  const chatConfig = statusQuery.data
  const serverChatReady = chatConfig?.chatReady ?? false
  const joinChatReady = serverChatReady || accountMessagingReady
  const join = useWaitlistChatJoin({
    xmtpMemberAddress: chatConfig?.xmtpMemberAddress,
    chatReady: joinChatReady,
    enabled: accountMessagingReady,
    messagingReady: xmtpConnected,
    serverJoinActionStatus: chatConfig?.joinAction?.status ?? null,
  })

  const groupName = chatConfig?.groupName ?? 'Waitlist chat'
  const blockedMessage = waitlistChatBlockedMessage({
    executionTrack: chatConfig?.executionTrack,
    connectTrack,
    joinBlockedReason: chatConfig?.joinBlockedReason,
  })

  // Depend on the stable `refetch` fn, not the whole query result object —
  // the result is a new object every render, so depending on it turns this
  // into an unbounded refetch loop (each refetch re-renders, re-firing the
  // effect) that trips the server's 429 rate limit.
  const refetchStatus = statusQuery.refetch
  useEffect(() => {
    if (accountMessagingReady) {
      void refetchStatus().catch(() => undefined)
    }
  }, [accountMessagingReady, refetchStatus])

  return (
    <WaitlistChatSection layout={layout}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-zinc-200">{groupName}</h3>
            <p className="text-[11px] text-zinc-500">Chat with other waitlist members</p>
          </div>
        </div>
        <WaitlistJoinBadge joinStatus={join.status} chatReady={serverChatReady && accountMessagingReady} />
      </header>

      <WaitlistGroupChatPanelContent
        accountMessagingReady={accountMessagingReady}
        connectTrack={connectTrack}
        statusQuery={statusQuery}
        chatConfig={chatConfig}
        blockedMessage={blockedMessage}
        join={join}
        groupName={groupName}
        chatReady={serverChatReady}
        onSignOut={onSignOut}
        signOutBusy={signOutBusy}
        onRepairSession={onRepairSession}
        repairBusy={repairBusy}
      />
    </WaitlistChatSection>
  )
}

function WaitlistGroupChatPanelContent(props: {
  accountMessagingReady: boolean
  connectTrack: WaitlistConnectTrack
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
  chatConfig: ReturnType<typeof useWaitlistXmtpStatus>['data']
  blockedMessage: string
  join: { status: WaitlistChatStatus; retryJoin: () => void }
  groupName: string
  chatReady: boolean
  onSignOut?: () => void
  signOutBusy?: boolean
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
}) {
  const {
    accountMessagingReady,
    connectTrack,
    statusQuery,
    chatConfig,
    blockedMessage,
    join,
    groupName,
    chatReady,
    signOutBusy,
    onRepairSession,
    repairBusy,
  } = props
  const hasCachedStatus = Boolean(chatConfig)
  const hasStatusErrorWithoutFallback = statusQuery.isError && !hasCachedStatus
  const hasStatusErrorWithFallback = statusQuery.isError && hasCachedStatus

  if (!accountMessagingReady) {
    return <p className="text-xs text-zinc-400">{blockedMessage}</p>
  }
  if (statusQuery.isLoading) {
    return <LoadingInline labelOverride="Loading waitlist chat…" />
  }
  if (hasStatusErrorWithoutFallback) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400">
          Could not load waitlist chat status. Refresh the page or try again in a moment.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void statusQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }
  if (!chatConfig?.configured) {
    return (
      <p className="text-xs text-zinc-400">
        Waitlist chat is not configured yet. Ask an admin to set WAITLIST_XMTP_GROUP_ID or the waitlist Keepr
        vault group.
      </p>
    )
  }

  const allowConnectSurface = chatReady || accountMessagingReady

  if (!allowConnectSurface) {
    return <p className="text-xs text-zinc-400">{blockedMessage}</p>
  }

  const surfaceChatReady = allowConnectSurface

  return (
    <div className="space-y-2">
      {hasStatusErrorWithFallback ? (
        <p className="text-xs text-amber-200/90">
          Waitlist chat status refresh failed. Showing the last known state while we retry.
        </p>
      ) : null}
      {chatConfig.configured && !chatConfig.vaultConfigured ? (
        <p className="text-xs text-amber-200/90">
          Automated group joins may fail until ops registers the waitlist Keepr vault. You can still connect
          messaging here.
        </p>
      ) : null}
      <WaitlistGroupChatSurface
        connectTrack={connectTrack}
        canonicalCswAddress={chatConfig.canonicalCswAddress}
        groupId={chatConfig.groupId}
        envGroupId={chatConfig.envGroupId}
        vaultGroupId={chatConfig.vaultGroupId}
        groupIdMismatch={chatConfig.groupIdMismatch}
        groupName={groupName}
        joinStatus={join.status}
        joinActionError={chatConfig.joinAction?.lastError ?? null}
        xmtpMemberAddress={chatConfig.xmtpMemberAddress}
        retryJoin={join.retryJoin}
        chatReady={surfaceChatReady}
        onRequestReauth={onRepairSession}
        reauthBusy={repairBusy ?? signOutBusy}
      />
    </div>
  )
}

function WaitlistChatSection({
  children,
  layout = 'inline',
}: {
  children: React.ReactNode
  layout?: 'inline' | 'sidebar' | 'mobile' | 'dock' | 'dock'
}) {
  const shellClass =
    layout === 'dock'
      ? 'flex min-h-[300px] max-h-[min(72vh,560px)] flex-col space-y-3 overflow-hidden'
      : layout === 'sidebar'
      ? 'flex h-full min-h-[320px] flex-col space-y-3 rounded-none border-y border-l border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-4 lg:min-h-[min(72vh,640px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
      : layout === 'mobile'
        ? 'flex min-h-[280px] flex-col space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 max-h-[min(55vh,480px)]'
        : 'space-y-3 pt-1'

  return (
    <section aria-label="Waitlist group chat" className={shellClass}>
      {children}
    </section>
  )
}

function WaitlistJoinBadge(props: { joinStatus: WaitlistChatStatus; chatReady: boolean }) {
  const { joinStatus, chatReady } = props

  if (!chatReady || joinStatus === 'idle' || joinStatus === 'awaiting_messaging') {
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
      ? 'bg-emerald-500/12 text-emerald-200'
      : joinStatus === 'failed' || joinStatus === 'error'
        ? 'bg-red-500/12 text-red-200'
        : 'bg-brand-primary/12 text-brand-primary'

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  )
}
