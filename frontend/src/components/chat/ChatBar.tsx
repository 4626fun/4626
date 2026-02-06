/**
 * ChatBar — bottom-right conversation list panel (Facebook Messenger style).
 *
 * When collapsed: a small pill showing "Chat" + total unread count.
 * When expanded: a panel listing all conversations.
 */

import { useMemo } from 'react'
import { MessageSquare, ChevronDown, Plus, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useXmtp, type ChatConversation } from '@/lib/xmtp/provider'

type Props = {
  expanded: boolean
  onToggle: () => void
  onOpenChat: (convo: ChatConversation) => void
  onNewDm: () => void
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

export function ChatBar({ expanded, onToggle, onOpenChat, onNewDm }: Props) {
  const { status, error, connect, conversations } = useXmtp()

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  )

  const isConnected = status === 'connected'
  const isLoading = status === 'signing' || status === 'connecting'

  return (
    <div className="flex flex-col" style={{ width: 280 }}>
      {/* Header / toggle pill */}
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

      {/* Expandable panel */}
      {expanded && (
        <div className="flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-white/10 border-t-0 rounded-b-xl overflow-hidden max-h-[420px]">
          {/* Not connected state */}
          {!isConnected && !isLoading && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-500" />
              <div className="text-sm text-zinc-400">
                {error ? (
                  <span className="text-red-400 text-xs">{error}</span>
                ) : (
                  'Connect to XMTP to start chatting'
                )}
              </div>
              <button
                type="button"
                onClick={connect}
                className="px-4 py-2 rounded-lg bg-brand-primary/20 text-brand-primary text-sm font-medium hover:bg-brand-primary/30 transition-colors"
              >
                Enable Chat
              </button>
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
              <button
                type="button"
                onClick={onNewDm}
                className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border-b border-white/5"
              >
                <Plus className="w-3.5 h-3.5" />
                New message
              </button>

              {conversations.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-500">
                  No conversations yet
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {conversations.map((convo) => (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => onOpenChat(convo)}
                      className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-medium text-zinc-300 uppercase">
                        {convo.type === 'group' ? (
                          convo.name.slice(0, 2)
                        ) : (
                          convo.name.slice(0, 2)
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-zinc-200 font-medium truncate">
                            {convo.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 flex-shrink-0">
                            {formatTime(convo.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500 truncate">
                            {convo.lastMessageText ?? 'No messages'}
                          </span>
                          {convo.unreadCount > 0 && (
                            <span className="flex-shrink-0 flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-brand-primary text-[9px] font-bold text-black px-1">
                              {convo.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
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
