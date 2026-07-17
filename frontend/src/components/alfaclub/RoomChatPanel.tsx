import { Loader2, MessageSquare, RefreshCw, SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { cn } from '@/lib/shared/utils'

export type RoomChatOrigin = 'telegram' | 'xmtp' | 'web4626' | null

export type RoomChatMessage = {
  roomId: string
  messageId: string
  senderAddress: string
  text: string
  dateMs: number | null
  dateIso: string | null
  username: string | null
  avatarUrl: string | null
  isBot: boolean | null
  replyId: string | null
  replyText: string | null
  replySender: string | null
  replyUsername: string | null
  origin: RoomChatOrigin
}

type RoomChatChannels = {
  enabled: boolean
  telegramEnabled: boolean
  xmtpEnabled: boolean
  rolloutStatus: string | null
}

type RoomChatListResponse = {
  success?: boolean
  data?: {
    messages?: RoomChatMessage[]
    channels?: RoomChatChannels
  }
  error?: string
}

const PAGE_SIZE = 40

function shortAddress(address: string): string {
  const normalized = address.trim()
  if (normalized.length < 10) return normalized || 'unknown'
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

function originLabel(origin: RoomChatOrigin): string {
  switch (origin) {
    case 'telegram':
      return 'Telegram'
    case 'xmtp':
      return 'XMTP'
    case 'web4626':
      return '4626'
    case null:
      return 'AlfaClub'
    default: {
      const _exhaustive: never = origin
      return _exhaustive
    }
  }
}

function formatMessageTime(dateMs: number | null, dateIso: string | null): string {
  const ms = dateMs ?? (dateIso ? Date.parse(dateIso) : NaN)
  if (!Number.isFinite(ms)) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms))
  } catch {
    return ''
  }
}

function createClientMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function fetchRoomChatPage(params: {
  roomId: string
  signal: AbortSignal
  beforeMessageId?: string | null
  beforeDateMs?: number | null
}): Promise<{ messages: RoomChatMessage[]; channels: RoomChatChannels | null }> {
  const query = new URLSearchParams({
    roomId: params.roomId,
    limit: String(PAGE_SIZE),
  })
  if (params.beforeMessageId) query.set('beforeMessageId', params.beforeMessageId)
  if (params.beforeDateMs != null) query.set('beforeDateMs', String(params.beforeDateMs))

  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.roomChat}?${query.toString()}`, {
    method: 'GET',
    signal: params.signal,
  })
  const payload = (await response.json().catch(() => null)) as RoomChatListResponse | null
  if (!response.ok || !payload?.success || !Array.isArray(payload.data?.messages)) {
    if (payload?.error === 'room_access_required') {
      throw new Error(
        'Room key required — hold or stake a FriendKey for this room, or meet the creator-coin equivalent.',
      )
    }
    throw new Error(payload?.error ?? `room_chat_failed_${response.status}`)
  }
  return {
    messages: payload.data.messages,
    channels: payload.data.channels ?? null,
  }
}

function mergeMessages(existing: RoomChatMessage[], incoming: RoomChatMessage[]): RoomChatMessage[] {
  const byId = new Map<string, RoomChatMessage>()
  for (const message of [...existing, ...incoming]) {
    byId.set(message.messageId, message)
  }
  return [...byId.values()].sort((a, b) => {
    const aMs = a.dateMs ?? (a.dateIso ? Date.parse(a.dateIso) : 0)
    const bMs = b.dateMs ?? (b.dateIso ? Date.parse(b.dateIso) : 0)
    if (aMs !== bMs) return aMs - bMs
    return a.messageId.localeCompare(b.messageId)
  })
}

export function RoomChatPanel({ roomId }: { roomId: string }) {
  const { hasSession, sessionHydrated } = useSiweAuth()
  const [messages, setMessages] = useState<RoomChatMessage[]>([])
  const [channels, setChannels] = useState<RoomChatChannels | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<RoomChatMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)

  useEffect(() => {
    if (!sessionHydrated) return
    if (!hasSession) {
      setLoading(false)
      setError('Sign in to view room chat')
      setMessages([])
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setHasMore(true)
    void fetchRoomChatPage({ roomId, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setMessages(mergeMessages([], result.messages))
        setChannels(result.channels)
        setHasMore(result.messages.length >= PAGE_SIZE)
        shouldStickToBottomRef.current = true
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : 'Failed to load room chat')
        setMessages([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [hasSession, reloadKey, roomId, sessionHydrated])

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, loading])

  const oldest = messages[0] ?? null

  const loadOlder = async () => {
    if (!hasSession || loadingMore || !hasMore || !oldest) return
    setLoadingMore(true)
    setError(null)
    shouldStickToBottomRef.current = false
    const controller = new AbortController()
    try {
      const result = await fetchRoomChatPage({
        roomId,
        signal: controller.signal,
        beforeMessageId: oldest.messageId,
        beforeDateMs: oldest.dateMs,
      })
      setMessages((current) => mergeMessages(current, result.messages))
      if (result.channels) setChannels(result.channels)
      setHasMore(result.messages.length >= PAGE_SIZE)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to load older messages')
    } finally {
      setLoadingMore(false)
    }
  }

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || sending || !hasSession) return
    setSending(true)
    setError(null)
    try {
      const response = await apiFetch(API_ENDPOINTS.alfaclub.roomChat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          text,
          clientMessageId: createClientMessageId(),
          replyToMessageId: replyTo?.messageId,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        error?: string
      } | null
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? `room_chat_send_failed_${response.status}`)
      }
      setDraft('')
      setReplyTo(null)
      shouldStickToBottomRef.current = true
      setReloadKey((key) => key + 1)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      role="tabpanel"
      id="room-panel-chat"
      aria-labelledby="room-tab-chat"
      className="flex min-h-[28rem] flex-col border-b border-white/[0.07] pb-10"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">
            <MessageSquare className="size-3" aria-hidden />
            Room chat
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-100">Conversation</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Native 4626 posts sync through AlfaClub with Telegram and XMTP when bridged.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channels ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              TG {channels.telegramEnabled ? 'on' : 'off'} · XMTP {channels.xmtpEnabled ? 'on' : 'off'}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              shouldStickToBottomRef.current = true
              setReloadKey((key) => key + 1)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
          >
            <RefreshCw className="size-3" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]">
        <div ref={listRef} className="min-h-[18rem] flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {hasMore && messages.length > 0 ? (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={() => void loadOlder()}
                disabled={loadingMore}
                className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-200 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading chat…
            </div>
          ) : null}

          {!loading && messages.length === 0 && !error ? (
            <p className="py-16 text-center text-sm text-zinc-500">No messages yet. Say hello.</p>
          ) : null}

          {messages.map((message) => (
            <article
              key={message.messageId}
              className="rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-white/[0.04]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-100">
                  {message.username?.trim() || shortAddress(message.senderAddress)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                    message.origin === 'telegram' && 'bg-sky-500/15 text-sky-200',
                    message.origin === 'xmtp' && 'bg-amber-500/15 text-amber-200',
                    message.origin === 'web4626' && 'bg-emerald-500/15 text-emerald-200',
                    message.origin == null && 'bg-white/[0.06] text-zinc-400',
                  )}
                >
                  {originLabel(message.origin)}
                </span>
                {message.isBot ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                    bot
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-[10px] text-zinc-500">
                  {formatMessageTime(message.dateMs, message.dateIso)}
                </span>
              </div>
              {message.replyId ? (
                <p className="mt-1.5 truncate rounded-lg bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-500">
                  Replying to {message.replyUsername || shortAddress(message.replySender ?? '')}:{' '}
                  {message.replyText || message.replyId}
                </p>
              ) : null}
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-zinc-200">{message.text}</p>
              <button
                type="button"
                onClick={() => setReplyTo(message)}
                className="mt-2 text-[11px] text-zinc-500 transition hover:text-zinc-300"
              >
                Reply
              </button>
            </article>
          ))}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3 sm:px-5">
          {error ? (
            <p className="mb-2 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-400">
              <span className="truncate">
                Replying to {replyTo.username || shortAddress(replyTo.senderAddress)}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage()
            }}
          >
            <label className="sr-only" htmlFor={`room-chat-composer-${roomId}`}>
              Message
            </label>
            <textarea
              id={`room-chat-composer-${roomId}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              disabled={!hasSession || sending}
              placeholder={hasSession ? 'Write a message…' : 'Sign in to chat'}
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/[0.08] placeholder:text-zinc-600 focus:ring-sky-400/40 disabled:opacity-60"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <button
              type="submit"
              disabled={!hasSession || sending || !draft.trim()}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-500/90 px-3 text-sm font-medium text-black transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <SendHorizontal className="size-4" aria-hidden />}
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
