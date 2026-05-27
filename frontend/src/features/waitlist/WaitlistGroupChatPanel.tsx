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
import { WaitlistGroupChatSurface, type WaitlistGroupChatSurfaceProps } from './WaitlistGroupChatSurface'

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

  return (
    <XmtpChatProvider identityHintAddress={identityHintAddress} manualConnectOnly>
      {statusQuery.isLoading && !chatConfig ? (
        <section aria-label="Waitlist group chat" className="space-y-3 pt-1">
          <LoadingInline label="Loading waitlist chat…" />
        </section>
      ) : (
        <WaitlistGroupChatPanelBody
          signingReady={signingReady}
          statusQuery={statusQuery}
        />
      )}
    </XmtpChatProvider>
  )
}

function WaitlistGroupChatPanelBody({
  signingReady,
  statusQuery,
}: {
  signingReady: boolean
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

  const groupName = chatConfig?.groupName ?? 'Waitlist chat'
  const blockedMessage = waitlistChatBlockedMessage({
    executionTrack: chatConfig?.executionTrack,
    joinBlockedReason: chatConfig?.joinBlockedReason,
  })

  const surfaceProps: WaitlistGroupChatSurfaceProps | null = chatReady && chatConfig
    ? {
        groupId: chatConfig.groupId,
        envGroupId: chatConfig.envGroupId,
        vaultGroupId: chatConfig.vaultGroupId,
        groupIdMismatch: chatConfig.groupIdMismatch,
        groupName,
        joinStatus: join.status,
        joinActionError: chatConfig.joinAction?.lastError ?? null,
        xmtpMemberAddress: chatConfig.xmtpMemberAddress,
        retryJoin: join.retryJoin,
        chatReady,
      }
    : null

  return (
    <section aria-label="Waitlist group chat" className="space-y-3 pt-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-zinc-200">{groupName}</h3>
            <p className="text-[11px] text-zinc-400">XMTP group for waitlist members</p>
          </div>
        </div>
        <WaitlistJoinBadge joinStatus={join.status} chatReady={chatReady} />
      </div>

      <WaitlistGroupChatPanelContent
        signingReady={signingReady}
        statusQuery={statusQuery}
        chatConfig={chatConfig}
        blockedMessage={blockedMessage}
        surfaceProps={surfaceProps}
        vaultWarning={Boolean(chatConfig?.configured && !chatConfig?.vaultConfigured && chatReady)}
      />
    </section>
  )
}

function WaitlistGroupChatPanelContent(props: {
  signingReady: boolean
  statusQuery: ReturnType<typeof useWaitlistXmtpStatus>
  chatConfig: ReturnType<typeof useWaitlistXmtpStatus>['data']
  blockedMessage: string
  surfaceProps: WaitlistGroupChatSurfaceProps | null
  vaultWarning: boolean
}) {
  const { signingReady, statusQuery, chatConfig, blockedMessage, surfaceProps, vaultWarning } = props

  if (!signingReady) {
    return <p className="text-xs text-zinc-400">{blockedMessage}</p>
  }
  if (statusQuery.isLoading) {
    return <LoadingInline label="Loading waitlist chat…" />
  }
  if (statusQuery.isError) {
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
  if (chatConfig.joinBlockedReason === 'service_unavailable') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400">
          Waitlist chat status is temporarily unavailable. Connect messaging below once signing is ready, or
          retry loading status.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void statusQuery.refetch()}>
          Retry status
        </Button>
      </div>
    )
  }
  if (!surfaceProps) {
    return <p className="text-xs text-zinc-400">{blockedMessage}</p>
  }

  return (
    <div className="space-y-2">
      {vaultWarning ? (
        <p className="text-xs text-amber-200/90">
          Waitlist chat group is set, but the Keepr vault for automated joins is missing. You can still connect
          messaging; group join may fail until ops registers the waitlist vault.
        </p>
      ) : null}
      <WaitlistGroupChatSurface {...surfaceProps} />
    </div>
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
