/**
 * ChatWindow — individual chat window pinned to the bottom of the viewport.
 *
 * Features:
 * - Header with conversation name + minimize/close controls
 * - Scrollable message area with auto-scroll to bottom
 * - Text input with send button
 * - Real-time message streaming
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, X, Send, Loader2 } from 'lucide-react'
import { useXmtp, type ChatMessage } from '@/lib/xmtp/provider'

type Props = {
  conversationId: string
  conversationName: string
  conversationType: 'dm' | 'group'
  minimized: boolean
  onMinimize: () => void
  onClose: () => void
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatWindow({
  conversationId,
  conversationName,
  conversationType,
  minimized,
  onMinimize,
  onClose,
}: Props) {
  const { loadMessages, sendMessage, subscribeToMessages, status } = useXmtp()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load initial messages
  useEffect(() => {
    if (status !== 'connected') return
    let cancelled = false
    setLoading(true)
    loadMessages(conversationId).then((msgs) => {
      if (cancelled) return
      setMessages(msgs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [conversationId, status, loadMessages])

  // Subscribe to live messages
  useEffect(() => {
    if (status !== 'connected') return
    const unsub = subscribeToMessages(conversationId, (msg) => {
      setMessages((prev) => {
        // Deduplicate
        if (prev.find((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })
    return unsub
  }, [conversationId, status, subscribeToMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when expanded
  useEffect(() => {
    if (!minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [minimized])

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      await sendMessage(conversationId, text)
    } catch (e) {
      console.error('[chat] send error:', e)
      // Restore input on failure
      setInput(text)
    } finally {
      setSending(false)
    }
  }, [input, sending, sendMessage, conversationId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div
      className="flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-t-xl overflow-hidden shadow-2xl"
      style={{ width: 320, height: minimized ? 40 : 420 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-800/80 border-b border-white/10 cursor-pointer select-none flex-shrink-0"
        onClick={onMinimize}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-medium text-zinc-300 uppercase flex-shrink-0">
            {conversationName.slice(0, 2)}
          </div>
          <span className="text-sm text-zinc-200 font-medium truncate">{conversationName}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMinimize() }}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {!minimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-500">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
                >
                  {/* Sender label for group chats */}
                  {conversationType === 'group' && !msg.isSelf && (
                    <span className="text-[9px] text-zinc-500 mb-0.5 px-1">
                      {msg.senderInboxId.slice(0, 8)}…
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                      msg.isSelf
                        ? 'bg-brand-primary/20 text-zinc-100 rounded-br-md'
                        : 'bg-white/10 text-zinc-200 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-zinc-600 mt-0.5 px-1">
                    {formatTimestamp(msg.sentAt)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-zinc-800/50 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              disabled={sending}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-primary/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="p-2 rounded-full bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
