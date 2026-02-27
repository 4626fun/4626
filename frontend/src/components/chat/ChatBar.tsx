/**
 * ChatBar — bottom-right conversation list panel (Facebook Messenger style).
 *
 * When collapsed: a small pill showing "Chat" + total unread count.
 * When expanded: a panel listing all conversations.
 */

import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, ChevronDown, Plus, Loader2, Wifi, WifiOff, X } from 'lucide-react'
import { useXmtp, type ChatConversation } from '@/lib/xmtp/provider'
import { useIdentity } from '@/hooks/useIdentity'
import { getAgentIdentity } from './agentIdentity'
import { useAccountContext } from '@/wallet/accountContext'

type Props = {
  expanded: boolean
  onToggle: () => void
  onOpenChat: (convo: ChatConversation) => void
  onNewDm: () => void
  variant?: 'desktop' | 'mobile'
}

function formatTime(date?: Date): string {
  if (!date) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

function initials(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '??'
  return trimmed.slice(0, 2).toUpperCase()
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function ConversationItem({
  convo,
  onOpenChat,
}: {
  convo: ChatConversation
  onOpenChat: (convo: ChatConversation) => void
}) {
  const { resolveInboxAddress } = useXmtp()
  const [resolvedPeer, setResolvedPeer] = useState<{ inboxId: string; address: string | null } | null>(null)

  useEffect(() => {
    if (convo.type !== 'dm') return
    if (convo.peerAddress) return
    if (!convo.peerInboxId) return
    let cancelled = false
    resolveInboxAddress(convo.peerInboxId).then((addr) => {
      if (!cancelled) setResolvedPeer({ inboxId: convo.peerInboxId!, address: addr })
    })
    return () => { cancelled = true }
  }, [convo.type, convo.peerAddress, convo.peerInboxId, resolveInboxAddress])

  const peerAddress =
    convo.peerAddress ??
    (convo.peerInboxId && resolvedPeer?.inboxId === convo.peerInboxId ? resolvedPeer.address : null)

  const identity = useIdentity(convo.type === 'dm' ? peerAddress : null)
  const agentIdentity = convo.type === 'dm' ? getAgentIdentity(peerAddress) : null
  const displayName =
    convo.type === 'dm' && peerAddress
      ? (agentIdentity?.name ?? identity.displayName)
      : convo.name
  const displaySecondary =
    convo.type === 'dm' && peerAddress
      ? (agentIdentity ? 'CreatorVault assistant' : (identity.secondary ?? truncateAddress(peerAddress)))
      : null
  const avatar = convo.type === 'dm'
    ? (agentIdentity?.avatar ?? identity.avatar)
    : (convo.imageUrl ?? null)
  const subtitle = convo.lastMessageText
    ? (displaySecondary ? `${displaySecondary} · ${convo.lastMessageText}` : convo.lastMessageText)
    : (displaySecondary ?? 'No messages')
  const lensBadge = convo.type === 'dm' && peerAddress && identity.lensHandle ? `Lens @${identity.lensHandle}` : null

  return (
    <button
      type="button"
      onClick={() => onOpenChat({
        ...convo,
        name: displayName,
        peerAddress: peerAddress ?? convo.peerAddress,
      })}
      className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
    >
      <div className="shrink-0 w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[11px] font-medium text-zinc-300 uppercase">
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          initials(displayName)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-zinc-200 font-medium truncate">
            {displayName}
          </span>
          {lensBadge && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.08em] text-cyan-200">
              {lensBadge}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 shrink-0">
            {formatTime(convo.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-zinc-500 truncate">
            {subtitle}
          </span>
          {convo.unreadCount > 0 && (
            <span className="shrink-0 flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-brand-primary text-[9px] font-bold text-black px-1">
              {convo.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function ChatBar({ expanded, onToggle, onOpenChat, onNewDm, variant = 'desktop' }: Props) {
  const { status, error, connect, conversations, resetInstallations, installationLimitInboxId } = useXmtp()
  const accountContext = useAccountContext()
  const hasWalletIdentity = Boolean(accountContext.signerAddress)
  const xmtpModeLabel = accountContext.activeAccountType === 'SMART_WALLET' ? 'Smart Wallet' : 'User Wallet'
  const xmtpModeHint =
    accountContext.signerType === 'SMART_WALLET'
      ? 'Connected as Smart Wallet'
      : 'Connected as User Wallet'

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  )

  const isConnected = status === 'connected'
  const isLoading = status === 'signing' || status === 'connecting'

  if (variant === 'mobile' && !expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="relative flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900 text-zinc-200 shadow-lg hover:bg-zinc-800 transition-colors"
        aria-label="Open messenger"
      >
        <MessageSquare className="w-5 h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-brand-primary text-[10px] font-bold text-black px-1">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    )
  }

  const containerClasses =
    variant === 'mobile'
      ? 'flex flex-col h-full w-full bg-black text-white'
      : 'flex flex-col'

  return (
    <div className={containerClasses} style={variant === 'desktop' ? { width: 280 } : undefined}>
      {/* Header / toggle pill */}
      {variant === 'desktop' ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center justify-between gap-2 rounded-t-xl px-4 py-2.5 bg-zinc-900 border border-white/10 border-b-0 text-zinc-200 hover:bg-zinc-800 transition-colors select-none"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">Chats</span>
            {totalUnread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-brand-primary text-[10px] font-bold text-black px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-zinc-500" />
            )}
            <ChevronDown
              className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? '' : 'rotate-180'}`}
            />
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="text-2xl font-semibold tracking-tight">Messenger</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNewDm}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-zinc-100 hover:bg-white/20 transition-colors"
              aria-label="New message"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-zinc-100 hover:bg-white/20 transition-colors"
              aria-label="Close messenger"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expandable panel */}
      {expanded && (
        <div
          className={
            variant === 'mobile'
              ? 'flex flex-col flex-1 bg-black'
              : 'flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-xl overflow-hidden max-h-[420px]'
          }
        >
          {variant === 'mobile' && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-500">
                <MessageSquare className="w-4 h-4 text-zinc-400" />
                Ask Keepr or Search
              </div>
            </div>
          )}
          {/* Not connected state */}
          {!isConnected && !isLoading && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-500" />
              <div className="text-sm text-zinc-400">
                {error ? (
                  <span className="text-red-400 text-xs">{error}</span>
                ) : (
                  'Sign in to start chatting'
                )}
              </div>
              {hasWalletIdentity ? (
                <div className="text-[11px] text-zinc-500">
                  Messaging mode: <span className="text-zinc-200">{xmtpModeLabel}</span>
                  <span className="block text-[10px] text-zinc-500">{xmtpModeHint}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={connect}
                className="px-4 py-2 rounded-lg bg-brand-primary/20 text-brand-primary text-sm font-medium hover:bg-brand-primary/30 transition-colors"
              >
                {hasWalletIdentity ? `Connect Messaging (${xmtpModeLabel})` : 'Connect Messaging'}
              </button>
              {installationLimitInboxId ? (
                <>
                  <div className="text-[11px] text-amber-200/80 leading-relaxed">
                    You hit XMTP’s 10-installation limit. Resetting revokes older installations to free a slot.
                    If you want more control, use{' '}
                    <a
                      className="underline hover:text-amber-100"
                      href="https://xmtp.chat/inbox-tools"
                      target="_blank"
                      rel="noreferrer"
                    >
                      xmtp.chat/inbox-tools
                    </a>
                    .
                  </div>
                  <button
                    type="button"
                    onClick={() => void resetInstallations()}
                    className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/15 transition-colors"
                    title="Revokes older XMTP installations to free a slot."
                  >
                    Reset XMTP installations
                  </button>
                </>
              ) : null}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 px-4 py-8">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
              <div className="text-xs text-zinc-400">
                {status === 'signing' ? 'Sign to enable messaging…' : 'Connecting to XMTP…'}
              </div>
            </div>
          )}

          {/* Connected - conversation list */}
          {isConnected && (
            <>
              {/* New chat button */}
              {variant === 'desktop' && (
                <button
                  type="button"
                  onClick={onNewDm}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border-b border-white/5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New message
                </button>
              )}

              {conversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-500">
                  No conversations yet
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {conversations.map((convo) => (
                    <ConversationItem
                      key={convo.id}
                      convo={convo}
                      onOpenChat={onOpenChat}
                    />
                  ))}
                </div>
              )}

              {/* Footer badge */}
              <div className="px-4 py-1.5 text-[9px] text-zinc-600 text-center border-t border-white/5">
                Powered by XMTP
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
