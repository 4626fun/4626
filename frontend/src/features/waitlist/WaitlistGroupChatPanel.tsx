import { useEffect } from 'react'
import { MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { LoadingInline } from '@/components/ui/LoadingState'
import { XmtpChatProvider, useXmtp } from '@/lib/xmtp/provider'
import { AccountContextProvider } from '@/wallet/accountContext'

import {
  useWaitlistChatJoin,
  waitlistChatBlockedMessage,
  type WaitlistChatStatus,
} from './useWaitlistChatJoin'
import { useWaitlistXmtpStatus } from './useWaitlistXmtpStatus'
import { WaitlistGroupChatSurface } from './WaitlistGroupChatSurface'

type WaitlistGroupChatPanelProps = {
  setupComplete: boolean
  signingReady: boolean
  layout?: 'inline' | 'sidebar' | 'mobile'
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
    signingReady,
    setupComplete,
    layout = 'inline',
    onSignOut,
    signOutBusy,
    onRepairSession,
    repairBusy,
  } = props
  const statusQuery = useWaitlistXmtpStatus(setupComplete)
  const chatConfig = statusQuery.data
  const identityHintAddress = chatConfig?.xmtpMemberAddress ?? null

  return (
    <AccountContextProvider>
      <XmtpChatProvider identityHintAddress={identityHintAddress} manualConnectOnly>
        {statusQuery.isLoading && !chatConfig ? (
          <WaitlistChatSection layout={layout}>
            <LoadingInline labelOverride="Loading waitlist chat…" />
          </WaitlistChatSection>
        ) : (
          <WaitlistGroupChatPanelBody
            signingReady={signingReady}
            statusQuery={statusQuery}
            layout={layout}
            onSignOut={onSignOut}
            signOutBusy={signOutBusy}
            onRepairSession={onRepairSession}
            repairBusy={repairBusy}
          />
        )}
      </XmtpChatProvider>
    </AccountContextProvider>
  )
}

function WaitlistGroupChatPanelBody({
  signingReady,
  statusQuery,
  layout,
  onSignOut,
  signOutBusy,
  onRepairSession,
  repairBusy,
}: {
  signingReady: boolean
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
  layout: 'inline' | 'sidebar' | 'mobile'
  onSignOut?: () => void
  signOutBusy?: boolean
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
}) {
  const { status: xmtpStatus } = useXmtp()
  const messagingReady = xmtpStatus === 'connected'
  const chatConfig = statusQuery.data
  const serverChatReady = chatConfig?.chatReady ?? false
  // Allow the auto join POST effect when the local signing step is complete even if
  // the current status snapshot has not yet reported chatReady (the POST itself will
  // re-validate eligibility server-side and may execute or defer the group add).
  const joinChatReady = serverChatReady || signingReady
  const join = useWaitlistChatJoin({
    xmtpMemberAddress: chatConfig?.xmtpMemberAddress,
    chatReady: joinChatReady,
    enabled: signingReady,
    messagingReady,
    serverJoinActionStatus: chatConfig?.joinAction?.status ?? null,
  })

  const groupName = chatConfig?.groupName ?? 'Waitlist chat'
  const blockedMessage = waitlistChatBlockedMessage({
    executionTrack: chatConfig?.executionTrack,
    joinBlockedReason: chatConfig?.joinBlockedReason,
  })

  // When the local signing step reports complete (owner installed / track ready),
  // proactively refetch status so the server-side eligibility (fresh isCswOwner read)
  // and xmtpMemberAddress / chatReady catch up quickly. This unblocks the connect UI
  // and group sync without requiring a manual page refresh.
  useEffect(() => {
    if (signingReady) {
      void statusQuery.refetch().catch(() => undefined)
    }
  }, [signingReady, statusQuery])

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
        <WaitlistJoinBadge joinStatus={join.status} chatReady={serverChatReady && signingReady} />
      </header>

      <WaitlistGroupChatPanelContent
        signingReady={signingReady}
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
  signingReady: boolean
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
    signingReady,
    statusQuery,
    chatConfig,
    blockedMessage,
    join,
    groupName,
    chatReady,
    onSignOut,
    signOutBusy,
    onRepairSession,
    repairBusy,
  } = props
  const hasCachedStatus = Boolean(chatConfig)
  const hasStatusErrorWithoutFallback = statusQuery.isError && !hasCachedStatus
  const hasStatusErrorWithFallback = statusQuery.isError && hasCachedStatus

  // Gate the "finish signing" message on the local signing step (from the setup UI).
  // Once the user has completed the owner-install step locally, allow the messaging
  // connect UI even if this particular status snapshot has not yet reflected chatReady
  // (small lag on the server's isCswOwner read or profile signals). The connect flow +
  // join POST will re-check eligibility and the status will be re-fetched.
  if (!signingReady) {
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
  // Allow the connect surface when the local signing step reports ready (or server says chatReady).
  // This lets users tap "Connect & join" promptly after the owner install step completes,
  // even if the status snapshot is one read behind.
  const allowConnectSurface = chatReady || signingReady

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
        onRequestReauth={onRepairSession ?? onSignOut}
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
  layout?: 'inline' | 'sidebar' | 'mobile'
}) {
  const shellClass =
    layout === 'sidebar'
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
