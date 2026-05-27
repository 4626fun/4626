/**
 * ChatBar — bottom-right conversation list panel.
 *
 * When collapsed: a small pill showing "Chat" + total unread count.
 * When expanded: a panel listing all conversations.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, ChevronDown, Plus, Search, Wifi, WifiOff, X } from 'lucide-react'
import { useXmtp, type ChatConversation } from '@/lib/xmtp/provider'
import { useIdentity } from '@/hooks/useIdentity'
import { getAgentIdentity } from './agentIdentity'
import { useAccountContext } from '@/wallet/accountContext'
import { LoadingInline } from '@/components/ui/LoadingState'
import { EthosAvatarScoreForAddress } from './EthosScorePill'

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
  const resolvingInboxIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (convo.type !== 'dm') return
    if (convo.peerAddress) return
    if (!convo.peerInboxId) return
    let cancelled = false
    const inboxId = convo.peerInboxId
    if (resolvedPeer?.inboxId === inboxId) return
    if (resolvingInboxIdRef.current === inboxId) return
    resolvingInboxIdRef.current = inboxId
    resolveInboxAddress(inboxId)
      .then((addr) => {
        if (cancelled) return
        const normalizedAddr = typeof addr === 'string' ? addr.toLowerCase() : null
        setResolvedPeer((prev) => {
          if (prev?.inboxId === inboxId && prev.address === normalizedAddr) return prev
          return { inboxId, address: normalizedAddr }
        })
      })
      .catch(() => undefined)
      .finally(() => {
        if (resolvingInboxIdRef.current === inboxId) {
          resolvingInboxIdRef.current = null
        }
      })
    return () => { cancelled = true }
  }, [convo.type, convo.peerAddress, convo.peerInboxId, resolveInboxAddress, resolvedPeer?.inboxId])

  const peerAddress =
    convo.peerAddress ??
    (convo.peerInboxId && resolvedPeer?.inboxId === convo.peerInboxId ? resolvedPeer.address : null)

  const identity = useIdentity(convo.type === 'dm' ? peerAddress : null)
  const agentIdentity = convo.type === 'dm' ? getAgentIdentity(peerAddress) : null
  const basenamePreferredName = identity.basenameDisplayName ?? identity.basename
  const identityDisplayName = identity.source !== 'address' ? identity.displayName : null
  const conversationNameLabel =
    convo.name && !/^0x[a-fA-F0-9]{4}(?:…|\.{3})[a-fA-F0-9]{4}$/i.test(convo.name.trim())
      ? convo.name
      : null
  const displayName =
    convo.type === 'dm' && peerAddress
      ? (agentIdentity?.name ?? basenamePreferredName ?? identityDisplayName ?? conversationNameLabel ?? convo.name)
      : convo.name
  const displaySecondary =
    convo.type === 'dm' && peerAddress
      ? (agentIdentity ? '4626 assistant' : (identity.secondary ?? truncateAddress(peerAddress)))
      : null
  const avatar = convo.type === 'dm'
    ? (agentIdentity?.avatar ?? identity.avatar ?? convo.imageUrl ?? null)
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
        imageUrl: avatar ?? convo.imageUrl,
      })}
      className="group flex w-full items-start gap-3 border-b border-white/5 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.06]"
    >
      <div className="relative h-10 w-10 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold uppercase text-zinc-300">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(displayName)
          )}
        </div>
        <EthosAvatarScoreForAddress
          address={peerAddress}
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {displayName}
            </span>
          </span>
          {lensBadge && (
            <span className="shrink-0 inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.08em] text-cyan-200">
              {lensBadge}
            </span>
          )}
          <span className="shrink-0 text-[10px] text-zinc-500 group-hover:text-zinc-400">
            {formatTime(convo.lastMessageAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[12px] text-zinc-300">
            {subtitle}
          </span>
          {convo.unreadCount > 0 && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#2374e1] px-1 text-[10px] font-bold text-white">
              {convo.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function ChatBar({ expanded, onToggle, onOpenChat, onNewDm, variant = 'desktop' }: Props) {
  const {
    status,
    error,
    connect,
    conversations,
    resetInstallations,
    resetLocalState,
    installationLimitInboxId,
    localStateResetRequired,
  } = useXmtp()
  const accountContext = useAccountContext()
  const hasWalletIdentity = Boolean(accountContext.signerAddress)
  const xmtpModeLabel = accountContext.activeAccountType === 'SMART_WALLET' ? 'Smart Wallet' : 'User Wallet'
  const xmtpModeHint =
    accountContext.activeAccountType === 'SMART_WALLET'
      ? 'Connected as Smart Wallet'
      : 'Connected as User Wallet'

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  )

  const isConnected = status === 'connected'
  const isLoading = status === 'signing' || status === 'connecting'
  const [searchQuery, setSearchQuery] = useState('')

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const sorted = [...conversations].sort(
      (a, b) =>
        b.unreadCount - a.unreadCount ||
        (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
    )
    if (!normalizedQuery) return sorted
    return sorted.filter((conversation) =>
      (conversation.name ?? '').toLowerCase().includes(normalizedQuery) ||
      (conversation.peerAddress ?? '').toLowerCase().includes(normalizedQuery) ||
      (conversation.lastMessageText ?? '').toLowerCase().includes(normalizedQuery),
    )
  }, [conversations, searchQuery])

  if (variant === 'mobile' && !expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="relative flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900 text-zinc-200 shadow-lg hover:bg-zinc-800 transition-colors"
        aria-label="Open chats"
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
    <div className={containerClasses} style={variant === 'desktop' ? { width: 320 } : undefined}>
      {/* Header / toggle pill */}
      {variant === 'desktop' ? (
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center justify-between gap-2 border border-white/10 bg-black/75 px-4 py-2.5 text-zinc-200 shadow-[0_18px_46px_-26px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-colors select-none hover:border-white/15 hover:bg-black/85 ${
            expanded ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'
          }`}
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
          <div className="text-2xl font-semibold tracking-tight">Chats</div>
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
              aria-label="Close chats"
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
              : 'flex flex-col bg-black/82 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-2xl overflow-hidden max-h-[420px] shadow-[0_26px_72px_-36px_rgba(0,0,0,0.95)]'
          }
        >
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
              {!localStateResetRequired ? (
                <button
                  type="button"
                  onClick={() => void connect('user')}
                  className="px-4 py-2 rounded-lg bg-brand-primary/20 text-brand-primary text-sm font-medium hover:bg-brand-primary/30 transition-colors"
                >
                  {hasWalletIdentity ? `Connect Messaging (${xmtpModeLabel})` : 'Connect Messaging'}
                </button>
              ) : null}
              {localStateResetRequired ? (
                <>
                  <div className="text-[11px] text-amber-200/80 leading-relaxed">
                    This browser’s XMTP cache no longer validates against your inbox. Reset local messaging state to
                    clear the cache and recreate this browser install. If reset says OPFS is locked with only one tab
                    open, click Reset again — the page will reload once automatically to release the lock.
                  </div>
                  <button
                    type="button"
                    onClick={() => void resetLocalState()}
                    className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/15 transition-colors"
                    title="Clears only this browser's local XMTP database, then reconnects."
                  >
                    Reset local XMTP state
                  </button>
                </>
              ) : null}
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
              <LoadingInline
                intent="session"
                labelOverride={status === 'signing' ? 'Sign to enable messaging...' : 'Connecting to XMTP...'}
              />
            </div>
          )}

          {/* Connected - conversation list */}
          {isConnected && (
            <>
              <div className={`${variant === 'mobile' ? 'px-4 pb-2' : 'px-3 py-2 border-b border-white/5'}`}>
                <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-zinc-400 transition-colors focus-within:border-brand-primary/40">
                  <Search className="w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search chats"
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="rounded-full p-0.5 text-zinc-500 transition-colors hover:text-zinc-300"
                      aria-label="Clear chat search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </label>
              </div>
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
              ) : filteredConversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-500">
                  No chats match that search
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {filteredConversations.map((convo) => (
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
