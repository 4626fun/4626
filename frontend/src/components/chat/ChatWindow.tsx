/**
 * ChatWindow — individual chat window pinned to the bottom of the viewport.
 *
 * Features:
 * - Header with conversation name + minimize/close controls
 * - Scrollable message area with auto-scroll to bottom
 * - Text input with send button
 * - Real-time message streaming
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Copy,
  CornerUpLeft,
  ExternalLink,
  MessageCircle,
  Minus,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useXmtp, type ChatMessage, type ChatMessageActions } from '@/lib/xmtp/provider'
import { useIdentity } from '@/hooks/useIdentity'
import { apiFetch } from '@/lib/api/apiBase'
import { trackEvent } from '@/lib/analytics/analytics'
import { fetchZoraProfile } from '@/lib/zora/client'
import { useAccountContext } from '@/wallet/accountContext'
import { Spinner } from '@/components/ui/Spinner'
import { getAgentIdentity } from './agentIdentity'
import { EthosAvatarScoreForAddress } from './EthosScorePill'
import {
  CHAT_COMMAND_CATEGORIES,
  type ChatCommandCategoryId,
  type ChatCommandDefinition,
  inferCommandIdFromAgentText,
  getChatCommandByCommandText,
  listChatCommandsByCategory,
  listChatFollowUps,
  listAllChatCommands,
  listQuickChatCommands,
  searchChatCommands,
  getChatCommandById,
} from './commandCenter'
import { resolveCommandCenterVisibility, shouldAttemptInactiveDmRecovery } from './chatWindowState'

type Props = {
  conversationId: string
  conversationName: string
  conversationType: 'dm' | 'group'
  peerInboxId?: string
  peerAddress?: string
  conversationImageUrl?: string
  minimized: boolean
  onMinimize: () => void
  onClose: () => void
  onConversationRekey?: (oldConversationId: string, newConversationId: string) => void
  variant?: 'desktop' | 'mobile'
  seedCommandId?: string | null
  onSeedConsumed?: () => void
}

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
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

function initials(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '??'
  return trimmed.slice(0, 2).toUpperCase()
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function isAddressDisplay(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim()
  return /^0x[a-fA-F0-9]{4}(?:…|\.{3})[a-fA-F0-9]{4}$/.test(trimmed) || /^0x[a-fA-F0-9]{40}$/.test(trimmed)
}

function isDuplicateAddressLabel(value: string | null | undefined, addressValue: string | null | undefined): boolean {
  if (!value || !addressValue) return false
  const trimmed = value.trim().toLowerCase()
  return trimmed === addressValue.toLowerCase() || trimmed === truncateAddress(addressValue).toLowerCase()
}

function previewMessageText(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return 'Empty message'
  if (compact.length <= 80) return compact
  return `${compact.slice(0, 79)}…`
}

function inferLocalContentType(value: string): ChatMessage['contentType'] {
  const text = value.trim()
  if (!text) return 'text'
  if ((text.startsWith('{') && text.endsWith('}')) || /^```json/i.test(text)) return 'json'
  if (text.startsWith('```')) return 'code'
  return 'text'
}

type CommandGuardResult = {
  allowed: boolean
  reason: string | null
  guardCategory: string | null
  checking: boolean
}

type PreflightResult = {
  allowed: boolean
  reason?: string
  guardCategory?: string
}

const DESKTOP_CHAT_WINDOW_WIDTH = 350
const DESKTOP_CHAT_WINDOW_HEIGHT = 520
const DESKTOP_CHAT_WINDOW_MINIMIZED_HEIGHT = 44

function ChatHeaderAvatar({
  avatar,
  initialsValue,
  addressValue,
  interactive,
  onOpenProfile,
  className = '',
}: {
  avatar: string | null
  initialsValue: string
  addressValue: string | null
  interactive: boolean
  onOpenProfile?: (event?: { stopPropagation?: () => void }) => void
  className?: string
}) {
  const content = (
    <>
      <span className="absolute left-1/2 top-0 flex h-11 w-11 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-white/10 text-[10px] font-semibold uppercase text-zinc-300">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsValue
        )}
      </span>
      <span className="absolute left-1/2 top-[34px] z-10 -translate-x-1/2">
        <EthosAvatarScoreForAddress address={addressValue} />
      </span>
    </>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={(event) => onOpenProfile?.(event)}
        className={`relative h-[62px] w-12 shrink-0 ${className}`}
        aria-label="Open profile"
        title="Open profile"
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`relative h-[62px] w-12 shrink-0 ${className}`}>
      {content}
    </div>
  )
}

function HeaderMenuItem(props: {
  icon: ReactNode
  label: string
  detail?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.045] text-zinc-300">
        {props.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-zinc-100">{props.label}</span>
        {props.detail ? <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{props.detail}</span> : null}
      </span>
    </button>
  )
}

function baseAllowedGuard(): CommandGuardResult {
  return {
    allowed: true,
    reason: null,
    guardCategory: null,
    checking: false,
  }
}

function preflightUnavailableGuard(): CommandGuardResult {
  return {
    allowed: false,
    reason: 'Write guard is temporarily unavailable. Please retry.',
    guardCategory: 'runtime_unavailable',
    checking: false,
  }
}

/** Inline sender label that resolves inboxId → address → display name */
function SenderLabel({ inboxId }: { inboxId: string }) {
  const { resolveInboxAddress } = useXmtp()
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveInboxAddress(inboxId)
      .then((addr) => {
        if (cancelled) return
        setAddress((prev) => (prev === addr ? prev : addr))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [inboxId, resolveInboxAddress])

  const { displayName } = useIdentity(address)
  return <span>{address ? displayName : `${inboxId.slice(0, 8)}…`}</span>
}

export function ChatWindow({
  conversationId,
  conversationName,
  conversationType,
  peerInboxId,
  peerAddress,
  conversationImageUrl,
  minimized,
  onMinimize,
  onClose,
  onConversationRekey,
  variant = 'desktop',
  seedCommandId = null,
  onSeedConsumed,
}: Props) {
  const { address } = useAccount()
  const accountContext = useAccountContext()
  const {
    loadMessages,
    sendMessage,
    sendIntent,
    startDm,
    startDmByInbox,
    subscribeToMessages,
    status,
    resolveInboxAddress,
    inboxId,
  } = useXmtp()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [resolvedPeer, setResolvedPeer] = useState<{ inboxId: string; address: string | null } | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<ChatCommandCategoryId>('vault')
  const [pendingCommand, setPendingCommand] = useState<ChatCommandDefinition | null>(null)
  const [lastCommandId, setLastCommandId] = useState<string | null>(null)
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null)
  const [commandHint, setCommandHint] = useState<string | null>(null)
  const [commandGuards, setCommandGuards] = useState<Record<string, CommandGuardResult>>({})
  const [desktopCommandsOpen, setDesktopCommandsOpen] = useState(false)
  const [peerAddressCopied, setPeerAddressCopied] = useState(false)
  const [peerAddressHovered, setPeerAddressHovered] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [peerCreatorCoinAddress, setPeerCreatorCoinAddress] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  const resolvingPeerInboxIdRef = useRef<string | null>(null)
  const localMessageSeqRef = useRef(0)
  const trackedShownButtonsRef = useRef<Set<string>>(new Set())
  const pendingCompletionRef = useRef<{ commandId: string; source: string } | null>(null)

  useEffect(() => {
    if (conversationType !== 'dm') return
    if (peerAddress) return
    if (!peerInboxId) return
    let cancelled = false
    if (resolvedPeer?.inboxId === peerInboxId) return
    if (resolvingPeerInboxIdRef.current === peerInboxId) return
    resolvingPeerInboxIdRef.current = peerInboxId
    resolveInboxAddress(peerInboxId)
      .then((addr) => {
        if (cancelled) return
        const normalizedAddr = typeof addr === 'string' ? addr.toLowerCase() : null
        setResolvedPeer((prev) => {
          if (prev?.inboxId === peerInboxId && prev.address === normalizedAddr) return prev
          return { inboxId: peerInboxId, address: normalizedAddr }
        })
      })
      .catch(() => undefined)
      .finally(() => {
        if (resolvingPeerInboxIdRef.current === peerInboxId) {
          resolvingPeerInboxIdRef.current = null
        }
      })
    return () => { cancelled = true }
  }, [conversationType, peerInboxId, peerAddress, resolveInboxAddress, resolvedPeer?.inboxId])

  const dmPeerAddress =
    conversationType === 'dm'
      ? (peerAddress ?? (peerInboxId && resolvedPeer?.inboxId === peerInboxId ? resolvedPeer.address : null))
      : null
  const dmIdentity = useIdentity(dmPeerAddress)
  const agentIdentity = getAgentIdentity(dmPeerAddress)
  const basenamePreferredName = dmIdentity.basenameDisplayName ?? dmIdentity.basename
  const identityDisplayName = dmIdentity.source !== 'address' ? dmIdentity.displayName : null
  const conversationNameLabel = !isAddressDisplay(conversationName) ? conversationName : null
  const headerName =
    conversationType === 'dm' && dmPeerAddress
      ? (agentIdentity?.name ?? basenamePreferredName ?? identityDisplayName ?? conversationNameLabel ?? 'XMTP contact')
      : conversationName
  const identitySecondary = conversationType === 'dm' && dmPeerAddress && !isDuplicateAddressLabel(dmIdentity.secondary, dmPeerAddress)
    ? dmIdentity.secondary
    : null
  const headerSubline =
    conversationType === 'dm' && dmPeerAddress
      ? (agentIdentity ? '4626 assistant' : identitySecondary)
      : null
  const copyablePeerAddress = conversationType === 'dm' ? dmPeerAddress : null
  const peerCreatorCoinHref = peerCreatorCoinAddress ? `/explore/creators/base/${peerCreatorCoinAddress}` : null
  const peerProfileHref = peerCreatorCoinHref ?? (copyablePeerAddress ? `https://basescan.org/address/${copyablePeerAddress}` : null)
  const headerAvatar = conversationType === 'dm'
    ? (conversationImageUrl ?? agentIdentity?.avatar ?? dmIdentity.avatar ?? null)
    : (conversationImageUrl ?? null)
  const headerInitials = initials(headerName)
  const lensBadge = conversationType === 'dm' && dmPeerAddress && dmIdentity.lensHandle
    ? `Lens @${dmIdentity.lensHandle}`
    : null
  const normalizedSenderWallet = useMemo(() => {
    const raw =
      (accountContext.activeAccountType === 'SMART_WALLET'
        ? accountContext.activeAccount
        : accountContext.activeAccount ?? address) ?? ''
    const trimmed = raw.trim().toLowerCase()
    return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed : ''
  }, [accountContext.activeAccount, accountContext.activeAccountType, address])

  useEffect(() => {
    if (conversationType !== 'dm') {
      setPeerCreatorCoinAddress(null)
      return
    }
    if (!copyablePeerAddress || !isEvmAddress(copyablePeerAddress)) {
      setPeerCreatorCoinAddress(null)
      return
    }

    let cancelled = false
    void fetchZoraProfile(copyablePeerAddress)
      .then((profile) => {
        if (cancelled) return
        const creatorCoinAddress = profile?.creatorCoin?.address
        if (creatorCoinAddress && isEvmAddress(creatorCoinAddress)) {
          setPeerCreatorCoinAddress(creatorCoinAddress.toLowerCase())
          return
        }
        setPeerCreatorCoinAddress(null)
      })
      .catch(() => {
        if (cancelled) return
        setPeerCreatorCoinAddress(null)
      })

    return () => {
      cancelled = true
    }
  }, [conversationType, copyablePeerAddress])

  const handleCopyPeerAddress = useCallback(async () => {
    if (!copyablePeerAddress) return
    if (typeof navigator === 'undefined') return
    if (!navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(copyablePeerAddress)
      setPeerAddressCopied(true)
    } catch {
      // ignore clipboard copy failures
    }
  }, [copyablePeerAddress])

  const handleOpenPeerProfile = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.()
      if (!peerProfileHref) return
      if (typeof window === 'undefined') return
      window.open(peerProfileHref, '_blank', 'noopener,noreferrer')
    },
    [peerProfileHref],
  )

  const handleOpenBasescan = useCallback(() => {
    if (!copyablePeerAddress) return
    if (typeof window === 'undefined') return
    window.open(`https://basescan.org/address/${copyablePeerAddress}`, '_blank', 'noopener,noreferrer')
  }, [copyablePeerAddress])

  useEffect(() => {
    if (!peerAddressCopied) return
    const timer = window.setTimeout(() => setPeerAddressCopied(false), 1200)
    return () => window.clearTimeout(timer)
  }, [peerAddressCopied])

  useEffect(() => {
    if (!headerMenuOpen) return

    function closeOnOutsidePointer(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (headerMenuRef.current?.contains(target)) return
      setHeaderMenuOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setHeaderMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [headerMenuOpen])

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
        if (prev.find((m) => m.id === msg.id)) return prev
        if (msg.isSelf) {
          const optimisticIdx = prev.findIndex(
            (candidate) =>
              candidate.isSelf &&
              candidate.id.startsWith('local-') &&
              candidate.status !== 'failed' &&
              candidate.content.trim() === msg.content.trim(),
          )
          if (optimisticIdx >= 0) {
            const next = [...prev]
            next[optimisticIdx] = msg
            return next
          }
        }
        return [...prev, msg]
      })
      if (!msg.isSelf) {
        const inferred = inferCommandIdFromAgentText(msg.content)
        if (inferred) setLastCommandId(inferred)
        const pending = pendingCompletionRef.current
        if (pending) {
          pendingCompletionRef.current = null
          trackEvent('chat_command_completed', {
            conversationId,
            conversationType,
            commandId: pending.commandId,
            source: pending.source,
          })
          void apiFetch('/api/v1/chat/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'chat_command_completed',
              conversationId,
              conversationType,
              commandId: pending.commandId,
              source: pending.source,
            }),
          }).catch(() => undefined)
        }
      }
    })
    return unsub
  }, [conversationId, conversationType, status, subscribeToMessages])

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

  const emitTelemetry = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      const detail = {
        conversationId,
        conversationType,
        ...payload,
      }
      trackEvent(event, detail)
      void apiFetch('/api/v1/chat/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          ...detail,
        }),
      }).catch(() => undefined)
    },
    [conversationId, conversationType],
  )

  const buildLocalMessage = useCallback(
    (text: string, replyToId?: string | null): ChatMessage => {
      localMessageSeqRef.current += 1
      return {
        id: `local-${conversationId}-${Date.now()}-${localMessageSeqRef.current}`,
        conversationId,
        senderInboxId: inboxId ?? 'self',
        content: text.trim(),
        contentType: inferLocalContentType(text),
        replyToId: replyToId ?? null,
        actions: null,
        walletSendCalls: null,
        reactionEmoji: null,
        status: 'sending',
        error: null,
        sentAt: new Date(),
        isSelf: true,
      }
    },
    [conversationId, inboxId],
  )

  const performSend = useCallback(
    async (params: {
      text: string
      source: 'composer' | 'command' | 'confirm' | 'retry' | 'autocomplete'
      commandId?: string | null
      restoreInputOnFail?: boolean
      replyToId?: string | null
      replyToSenderInboxId?: string | null
      retryMessageId?: string
    }): Promise<boolean> => {
      const text = params.text.trim()
      if (!text || sending) return false
      const commandMatch = params.commandId ? getChatCommandById(params.commandId) : getChatCommandByCommandText(text)
      const commandId = commandMatch?.id ?? params.commandId ?? null
      const commandRisk = commandMatch?.risk ?? null
      let messageId = params.retryMessageId ?? null
      const replyToId = params.replyToId ?? null
      const replyToSenderInboxId = params.replyToSenderInboxId?.trim() || null
      const sendOptions =
        replyToId && replyToSenderInboxId
          ? { replyToId, replyToSenderInboxId }
          : replyToId
            ? { replyToId }
            : undefined

      if (messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: 'sending', error: null, sentAt: new Date() }
              : msg,
          ),
        )
      } else {
        const optimistic = buildLocalMessage(text, replyToId)
        messageId = optimistic.id
        setMessages((prev) => [...prev, optimistic])
      }

      if (commandId) {
        setLastCommandId(commandId)
        pendingCompletionRef.current = { commandId, source: params.source }
      }
      emitTelemetry('chat_command_sent', {
        source: params.source,
        commandId,
        commandRisk,
        hasReplyContext: Boolean(replyToId),
      })

      setSending(true)
      try {
        await sendMessage(conversationId, text, sendOptions)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: 'sent', error: null }
              : msg,
          ),
        )
        setReplyToMessageId(null)
        return true
      } catch (error) {
        let reason = error instanceof Error ? error.message : 'send_failed'
        console.error('[chat] send error:', error)

        if (
          shouldAttemptInactiveDmRecovery({
            reason,
            conversationType,
            dmPeerAddress,
            dmPeerInboxId: peerInboxId ?? null,
          }) &&
          (Boolean(dmPeerAddress && isEvmAddress(dmPeerAddress)) || Boolean(peerInboxId?.trim()))
        ) {
          try {
            let recoveredConversationId: string | null = null
            if (dmPeerAddress && isEvmAddress(dmPeerAddress)) {
              const recoveredDm = await startDm(dmPeerAddress)
              if (recoveredDm.ok) {
                recoveredConversationId = recoveredDm.conversationId
              } else {
                reason = recoveredDm.message || reason
              }
            } else {
              recoveredConversationId = await startDmByInbox(String(peerInboxId ?? '').trim())
            }
            if (recoveredConversationId) {
              if (recoveredConversationId !== conversationId) {
                onConversationRekey?.(conversationId, recoveredConversationId)
              }
              await sendMessage(recoveredConversationId, text, sendOptions)
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, status: 'sent', error: null }
                    : msg,
                ),
              )
              setReplyToMessageId(null)
              return true
            }
          } catch (retryError) {
            reason = retryError instanceof Error ? retryError.message : reason
            console.error('[chat] inactive recovery send error:', retryError)
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, status: 'failed', error: reason }
              : msg,
          ),
        )
        if (params.restoreInputOnFail) setInput(text)
        pendingCompletionRef.current = null
        emitTelemetry('chat_command_failed', {
          source: params.source,
          commandId,
          commandRisk,
          reason,
        })
        return false
      } finally {
        setSending(false)
      }
    },
    [
      buildLocalMessage,
      conversationId,
      conversationType,
      dmPeerAddress,
      emitTelemetry,
      onConversationRekey,
      peerInboxId,
      sendMessage,
      sending,
      startDm,
      startDmByInbox,
    ],
  )

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    const replyTarget = replyToMessageId
      ? messages.find((msg) => msg.id === replyToMessageId) ?? null
      : null
    await performSend({
      text,
      source: 'composer',
      commandId: getChatCommandByCommandText(text)?.id ?? null,
      restoreInputOnFail: true,
      replyToId: replyToMessageId,
      replyToSenderInboxId: replyTarget?.senderInboxId ?? null,
    })
  }, [input, messages, performSend, replyToMessageId, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isMobile = variant === 'mobile'
  const showCommandCenter = conversationType === 'dm' && Boolean(agentIdentity)
  const showCommandCenterPanel = resolveCommandCenterVisibility({
    isMobile,
    showCommandCenter,
    desktopCommandsOpen,
  })
  const quickActions = useMemo(() => listQuickChatCommands(), [])
  const allCommands = useMemo(() => listAllChatCommands(), [])
  const categoryActions = useMemo(
    () => listChatCommandsByCategory(activeCategoryId),
    [activeCategoryId],
  )
  const slashSuggestions = useMemo(
    () => searchChatCommands(input, 6),
    [input],
  )
  const followUpActions = useMemo(
    () => listChatFollowUps(lastCommandId),
    [lastCommandId],
  )

  useEffect(() => {
    if (isMobile || !showCommandCenter) {
      setDesktopCommandsOpen(false)
    }
  }, [isMobile, showCommandCenter])

  useEffect(() => {
    if (isMobile || !showCommandCenter) return
    if (pendingCommand) {
      setDesktopCommandsOpen(true)
    }
  }, [isMobile, pendingCommand, showCommandCenter])

  useEffect(() => {
    if (isMobile || !showCommandCenter) return
    if (input.trim().startsWith('/')) {
      setDesktopCommandsOpen(true)
    }
  }, [input, isMobile, showCommandCenter])

  useEffect(() => {
    if (isMobile || !desktopCommandsOpen) return
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDesktopCommandsOpen(false)
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [desktopCommandsOpen, isMobile])

  const messageById = useMemo(
    () => new Map(messages.map((msg) => [msg.id, msg])),
    [messages],
  )
  const replyingToMessage = replyToMessageId ? (messageById.get(replyToMessageId) ?? null) : null

  const writeSendCommands = useMemo(
    () => allCommands.filter((command) => command.risk === 'write' && command.mode === 'send'),
    [allCommands],
  )

  useEffect(() => {
    if (!showCommandCenter) return
    emitTelemetry('chat_command_center_shown', {
      hasAgentIdentity: Boolean(agentIdentity),
    })
  }, [agentIdentity, emitTelemetry, showCommandCenter])

  useEffect(() => {
    if (!showCommandCenter) return
    const visibleIds = [
      ...quickActions.map((command) => `quick:${command.id}`),
      ...categoryActions.map((command) => `category:${command.id}`),
      ...followUpActions.map((command) => `followup:${command.id}`),
    ]
    for (const token of visibleIds) {
      if (trackedShownButtonsRef.current.has(token)) continue
      trackedShownButtonsRef.current.add(token)
      const [placement, commandId] = token.split(':')
      emitTelemetry('chat_command_button_shown', { placement, commandId })
    }
  }, [categoryActions, emitTelemetry, followUpActions, quickActions, showCommandCenter])

  useEffect(() => {
    const latestAgentMessage = [...messages].reverse().find((msg) => !msg.isSelf)
    if (!latestAgentMessage) return
    const inferred = inferCommandIdFromAgentText(latestAgentMessage.content)
    if (inferred) setLastCommandId(inferred)
  }, [messages])

  useEffect(() => {
    if (conversationType !== 'group' || writeSendCommands.length === 0) return
    let cancelled = false
    void (async () => {
      for (const command of writeSendCommands) {
        if (cancelled) return
        setCommandGuards((prev) => ({
          ...prev,
          [command.id]: {
            allowed: true,
            reason: null,
            guardCategory: null,
            checking: true,
          },
        }))
        try {
          const res = await apiFetch('/api/v1/chat/command-preflight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              senderWallet: normalizedSenderWallet,
              command: command.command,
            }),
          })
          const json = (await res.json().catch(() => null)) as {
            success?: boolean
            data?: PreflightResult
          } | null
          const preflight = json?.success ? json.data : null
          const guard: CommandGuardResult = preflight
            ? {
                allowed: preflight.allowed !== false,
                reason: preflight.reason ?? null,
                guardCategory: preflight.guardCategory ?? null,
                checking: false,
              }
            : {
                ...preflightUnavailableGuard(),
              }
          if (cancelled) return
          setCommandGuards((prev) => ({ ...prev, [command.id]: guard }))
          if (!guard.allowed) {
            emitTelemetry('chat_guard_rejected', {
              commandId: command.id,
              guardCategory: guard.guardCategory ?? 'preflight_blocked',
              reason: guard.reason ?? 'preflight_blocked',
            })
          }
        } catch {
          if (cancelled) return
          setCommandGuards((prev) => ({
            ...prev,
            [command.id]: {
              ...preflightUnavailableGuard(),
            },
          }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationId, conversationType, emitTelemetry, normalizedSenderWallet, writeSendCommands])

  const resolveCommandGuard = useCallback((command: ChatCommandDefinition): CommandGuardResult => {
    if (command.risk !== 'write' || command.mode !== 'send') return baseAllowedGuard()
    if (!normalizedSenderWallet) {
      return {
        allowed: false,
        reason: 'Connect a wallet before running write actions.',
        guardCategory: 'wallet_missing',
        checking: false,
      }
    }
    if (conversationType !== 'group') {
      return {
        allowed: false,
        reason: 'Write actions are only available in authorized vault group chats.',
        guardCategory: 'group_required',
        checking: false,
      }
    }
    return commandGuards[command.id] ?? {
      ...baseAllowedGuard(),
      checking: true,
    }
  }, [commandGuards, conversationType, normalizedSenderWallet])

  const unavailableWriteReasons = useMemo(() => {
    const uniqueReasons = new Set<string>()
    for (const command of [...categoryActions, ...followUpActions]) {
      if (command.risk !== 'write' || command.mode !== 'send') continue
      const guard = resolveCommandGuard(command)
      if (!guard.allowed && guard.reason) uniqueReasons.add(guard.reason)
    }
    return [...uniqueReasons]
  }, [categoryActions, followUpActions, resolveCommandGuard])

  const triggerCommand = useCallback(
    async (command: ChatCommandDefinition) => {
      const guard = resolveCommandGuard(command)
      emitTelemetry('chat_command_clicked', {
        commandId: command.id,
        mode: command.mode,
        risk: command.risk,
      })
      if (command.risk === 'write' && command.mode === 'send' && !guard.allowed) {
        const reason = guard.reason ?? 'Write action unavailable.'
        setCommandHint(reason)
        emitTelemetry('chat_guard_rejected', {
          commandId: command.id,
          guardCategory: guard.guardCategory ?? 'client_guard',
          reason,
        })
        return
      }
      if (command.mode === 'prefill') {
        setInput(command.command)
        setLastCommandId(command.id)
        setPendingCommand(null)
        setCommandHint(null)
        inputRef.current?.focus()
        return
      }
      if (command.risk === 'write') {
        setPendingCommand(command)
        return
      }
      const ok = await performSend({
        text: command.command,
        source: 'command',
        commandId: command.id,
      })
      if (!ok) return
      setLastCommandId(command.id)
      setPendingCommand(null)
      setCommandHint(null)
    },
    [emitTelemetry, performSend, resolveCommandGuard],
  )

  const handleConfirmPending = useCallback(async () => {
    if (!pendingCommand || pendingCommand.mode !== 'send') return
    const guard = resolveCommandGuard(pendingCommand)
    if (!guard.allowed) {
      setCommandHint(guard.reason ?? 'Write action unavailable.')
      emitTelemetry('chat_guard_rejected', {
        commandId: pendingCommand.id,
        guardCategory: guard.guardCategory ?? 'client_guard',
        reason: guard.reason ?? 'client_guard_rejected',
      })
      setPendingCommand(null)
      return
    }
    emitTelemetry('chat_command_confirmation_accepted', {
      commandId: pendingCommand.id,
    })
    const ok = await performSend({
      text: pendingCommand.command,
      source: 'confirm',
      commandId: pendingCommand.id,
    })
    if (!ok) return
    setLastCommandId(pendingCommand.id)
    setPendingCommand(null)
    setCommandHint(null)
  }, [emitTelemetry, pendingCommand, performSend, resolveCommandGuard])

  const handleCancelPending = useCallback(() => {
    if (pendingCommand) {
      emitTelemetry('chat_command_confirmation_cancelled', {
        commandId: pendingCommand.id,
      })
    }
    setPendingCommand(null)
  }, [emitTelemetry, pendingCommand])

  useEffect(() => {
    if (!seedCommandId) return
    const seeded = getChatCommandById(seedCommandId)
    onSeedConsumed?.()
    if (!seeded) return
    setActiveCategoryId(seeded.category)
    setLastCommandId(seeded.id)
    if (seeded.mode === 'prefill') {
      setInput(seeded.command)
      inputRef.current?.focus()
      return
    }
    if (seeded.risk === 'write') {
      setPendingCommand(seeded)
      return
    }
    setInput(seeded.command)
    inputRef.current?.focus()
  }, [seedCommandId, onSeedConsumed])

  const handleRetryMessage = useCallback(async (messageId: string) => {
    const target = messages.find((msg) => msg.id === messageId)
    if (!target || target.status !== 'failed') return
    const replyTarget = target.replyToId
      ? messages.find((msg) => msg.id === target.replyToId) ?? null
      : null
    await performSend({
      text: target.content,
      source: 'retry',
      retryMessageId: target.id,
      commandId: getChatCommandByCommandText(target.content)?.id ?? null,
      replyToId: target.replyToId ?? null,
      replyToSenderInboxId: replyTarget?.senderInboxId ?? null,
    })
  }, [messages, performSend])

  const handleActionIntent = useCallback(async (actions: ChatMessageActions, actionId: string) => {
    if (sending) return
    setSending(true)
    try {
      await sendIntent(conversationId, { promptId: actions.promptId, actionId })
      emitTelemetry('chat_action_intent_sent', {
        actionId,
        promptId: actions.promptId,
      })
    } catch (error) {
      console.error('[chat] sendIntent error:', error)
    } finally {
      setSending(false)
    }
  }, [conversationId, emitTelemetry, sendIntent, sending])

  const handleSelectAutocomplete = useCallback(async (command: ChatCommandDefinition) => {
    emitTelemetry('chat_autocomplete_selected', {
      commandId: command.id,
      risk: command.risk,
      mode: command.mode,
    })
    await triggerCommand(command)
  }, [emitTelemetry, triggerCommand])

  const headerMenu = headerMenuOpen ? (
    <div
      className="absolute left-0 top-[calc(100%+8px)] z-[80] w-[292px] overflow-hidden rounded-2xl border border-white/10 bg-[#202123]/98 p-2 text-zinc-100 shadow-[0_20px_70px_-24px_rgba(0,0,0,0.95)] ring-1 ring-black/40 backdrop-blur-xl"
      onClick={(event) => event.stopPropagation()}
      role="menu"
      aria-label={`${headerName} chat menu`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-2.5 pt-1">
        <ChatHeaderAvatar
          avatar={headerAvatar}
          initialsValue={headerInitials}
          addressValue={copyablePeerAddress}
          interactive={false}
          className="scale-[0.9]"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-50">{headerName}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            {copyablePeerAddress ? truncateAddress(copyablePeerAddress) : 'XMTP conversation'}
          </div>
        </div>
      </div>
      <div className="mt-1 space-y-1">
        <HeaderMenuItem
          icon={<UserRound className="h-4 w-4" />}
          label={peerCreatorCoinHref ? 'View creator profile' : 'View wallet profile'}
          detail={peerCreatorCoinHref ? 'Open creator coin token page' : 'Open portfolio and identity context'}
          disabled={!peerProfileHref}
          onClick={() => {
            handleOpenPeerProfile()
            setHeaderMenuOpen(false)
          }}
        />
        <HeaderMenuItem
          icon={<Copy className="h-4 w-4" />}
          label={peerAddressCopied ? 'Address copied' : 'Copy address'}
          detail={copyablePeerAddress ? truncateAddress(copyablePeerAddress) : 'Address unavailable'}
          disabled={!copyablePeerAddress}
          onClick={() => {
            void handleCopyPeerAddress()
            setHeaderMenuOpen(false)
          }}
        />
        <HeaderMenuItem
          icon={<ExternalLink className="h-4 w-4" />}
          label="View on Basescan"
          detail="Inspect wallet and transactions"
          disabled={!copyablePeerAddress}
          onClick={() => {
            handleOpenBasescan()
            setHeaderMenuOpen(false)
          }}
        />
      </div>
      <div className="my-2 border-t border-white/10" />
      <div className="space-y-1">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.045] text-zinc-300">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-zinc-100">XMTP encrypted</span>
            <span className="mt-0.5 block truncate text-[10px] text-zinc-500">Messages use end-to-end encryption</span>
          </span>
        </div>
        <HeaderMenuItem
          icon={<MessageCircle className="h-4 w-4" />}
          label="Minimize chat"
          onClick={() => {
            setHeaderMenuOpen(false)
            onMinimize()
          }}
        />
        <HeaderMenuItem
          icon={<X className="h-4 w-4" />}
          label="Close chat"
          onClick={() => {
            setHeaderMenuOpen(false)
            onClose()
          }}
        />
      </div>
    </div>
  ) : null

  return (
    <div
      className={`flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl ${
        isMobile ? 'h-full w-full rounded-none' : 'rounded-t-xl'
      }`}
      style={
        isMobile
          ? undefined
          : {
              width: DESKTOP_CHAT_WINDOW_WIDTH,
              height: minimized ? DESKTOP_CHAT_WINDOW_MINIMIZED_HEIGHT : DESKTOP_CHAT_WINDOW_HEIGHT,
            }
      }
    >
      {/* Header */}
      {isMobile ? (
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-200 transition-colors"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            <ChatHeaderAvatar
              avatar={headerAvatar}
              initialsValue={headerInitials}
              addressValue={copyablePeerAddress}
              interactive={Boolean(peerProfileHref)}
              onOpenProfile={handleOpenPeerProfile}
            />
            <div ref={headerMenuRef} className="relative min-w-0 text-left">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setHeaderMenuOpen((prev) => !prev)
                }}
                className="block max-w-full rounded-lg text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
              >
                <span className="block truncate text-sm font-semibold text-zinc-100">
                  {headerName}
                </span>
                {headerSubline && (
                  <span className="block truncate text-[10px] text-zinc-500">
                    {headerSubline}
                  </span>
                )}
              </button>
              {headerMenu}
              {copyablePeerAddress && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopyPeerAddress()}
                    onMouseEnter={() => setPeerAddressHovered(true)}
                    onMouseLeave={() => setPeerAddressHovered(false)}
                    onFocus={() => setPeerAddressHovered(true)}
                    onBlur={() => setPeerAddressHovered(false)}
                    className="font-mono text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={`Copy address ${copyablePeerAddress}`}
                  >
                    {peerAddressHovered ? copyablePeerAddress : truncateAddress(copyablePeerAddress)}
                  </button>
                  {peerAddressCopied ? (
                    <span className="text-[9px] text-emerald-300/90">Copied</span>
                  ) : null}
                </div>
              )}
              {lensBadge && (
                <div className="text-[9px] text-cyan-200 truncate">
                  {lensBadge}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-200 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-800/80 border-b border-white/10 cursor-pointer select-none shrink-0"
          onClick={onMinimize}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ChatHeaderAvatar
              avatar={headerAvatar}
              initialsValue={headerInitials}
              addressValue={copyablePeerAddress}
              interactive={Boolean(peerProfileHref)}
              onOpenProfile={handleOpenPeerProfile}
            />
            <div ref={headerMenuRef} className="relative min-w-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setHeaderMenuOpen((prev) => !prev)
                }}
                className="block max-w-full rounded-lg text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/60"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
              >
                <span className="block truncate text-sm font-medium text-zinc-200">{headerName}</span>
                {headerSubline && (
                  <span className="block truncate text-[10px] text-zinc-500">{headerSubline}</span>
                )}
              </button>
              {headerMenu}
              {copyablePeerAddress && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleCopyPeerAddress()
                    }}
                    onMouseEnter={() => setPeerAddressHovered(true)}
                    onMouseLeave={() => setPeerAddressHovered(false)}
                    onFocus={() => setPeerAddressHovered(true)}
                    onBlur={() => setPeerAddressHovered(false)}
                    className="font-mono text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={`Copy address ${copyablePeerAddress}`}
                  >
                    {peerAddressHovered ? copyablePeerAddress : truncateAddress(copyablePeerAddress)}
                  </button>
                  {peerAddressCopied ? (
                    <span className="text-[9px] text-emerald-300/90">Copied</span>
                  ) : null}
                </div>
              )}
              {lensBadge && (
                <div className="text-[9px] text-cyan-200 truncate">{lensBadge}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showCommandCenter ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDesktopCommandsOpen((prev) => !prev)
                }}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                  desktopCommandsOpen
                    ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'
                    : 'border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
                aria-label={desktopCommandsOpen ? 'Back to chat' : 'Open commands'}
              >
                {desktopCommandsOpen ? 'Back' : 'Commands'}
              </button>
            ) : null}
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
      )}

      {/* Messages */}
      {(!minimized || isMobile) && (
        <>
          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5 ${
              isMobile ? 'bg-black' : ''
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="text-zinc-500" size="md" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-500">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} gap-0.5`}
                >
                  {/* Sender label for group chats */}
                  {conversationType === 'group' && !msg.isSelf && (
                    <span className="text-[9px] text-zinc-500 mb-0.5 px-1">
                      <SenderLabel inboxId={msg.senderInboxId} />
                    </span>
                  )}
                  <div
                    className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-break-word shadow-[0_10px_24px_-18px_rgba(0,0,0,0.9)] ${
                      msg.isSelf
                        ? 'bg-[#2374e1] text-white rounded-br-md'
                        : 'bg-white/[0.13] text-zinc-100 rounded-bl-md border border-white/12'
                    }`}
                  >
                    {msg.replyToId && (
                      <div className="mb-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-300">
                        <div className="uppercase tracking-[0.08em] text-zinc-500">Replying To</div>
                        <div className="mt-0.5 text-zinc-300">
                          {previewMessageText(messageById.get(msg.replyToId)?.content ?? `Message ${msg.replyToId}`)}
                        </div>
                      </div>
                    )}
                    {msg.contentType === 'json' && msg.richPreview ? (
                      <pre className="max-h-40 overflow-auto rounded-lg bg-black/25 p-2 text-[11px] leading-relaxed text-zinc-100">
                        {msg.richPreview}
                      </pre>
                    ) : msg.contentType === 'code' ? (
                      <pre className="max-h-40 overflow-auto rounded-lg bg-black/25 p-2 text-[11px] leading-relaxed text-zinc-100">
                        {msg.content}
                      </pre>
                    ) : (
                      msg.content
                    )}
                    {msg.walletSendCalls ? (
                      <div className="mt-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-2 text-[11px] text-cyan-100">
                        <div className="font-medium">Confirm in Base App</div>
                        <div className="mt-1 text-cyan-200/80">
                          {msg.walletSendCalls.calls[0]?.metadata?.description ?? 'Review and sign this transaction.'}
                        </div>
                      </div>
                    ) : null}
                    {msg.actions && msg.actions.buttons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.actions.buttons.map((button) => {
                          const isPrimary = button.style === 'primary'
                          const isDanger = button.style === 'danger'
                          return (
                            <button
                              key={`${msg.actions!.promptId}-${button.id}`}
                              type="button"
                              disabled={sending || msg.isSelf}
                              onClick={() => void handleActionIntent(msg.actions!, button.id)}
                              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                                isDanger
                                  ? 'border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20'
                                  : isPrimary
                                    ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                                    : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                              }`}
                            >
                              {button.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2 px-1">
                    {msg.reactionEmoji ? (
                      <span className="text-sm leading-none" aria-label="Reaction">
                        {msg.reactionEmoji}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-zinc-500">
                      {formatTimestamp(msg.sentAt)}
                    </span>
                    {msg.isSelf && (
                      <span
                        className={`text-[10px] ${
                          msg.status === 'failed'
                            ? 'text-red-300'
                            : msg.status === 'sending'
                              ? 'text-zinc-400'
                              : 'text-zinc-500'
                        }`}
                      >
                        {msg.status === 'failed' ? 'Failed' : msg.status === 'sending' ? 'Sending…' : 'Sent'}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 px-1">
                    {!msg.id.startsWith('local-') && (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyToMessageId(msg.id)
                          inputRef.current?.focus()
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <CornerUpLeft className="w-3 h-3" />
                        Reply
                      </button>
                    )}
                    {msg.isSelf && msg.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => void handleRetryMessage(msg.id)}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {showCommandCenterPanel && (
            <div className="border-t border-white/10 bg-zinc-900/75 px-3 py-2 shrink-0">
              {!isMobile && (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Command Center</div>
                  <button
                    type="button"
                    onClick={() => {
                      setDesktopCommandsOpen(false)
                      inputRef.current?.focus()
                    }}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-white/10"
                  >
                    Back to chat
                  </button>
                </div>
              )}
              <div className={isMobile ? 'space-y-2' : 'max-h-56 overflow-y-auto pr-1 space-y-2'}>
              {slashSuggestions.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 mb-1.5">Slash Suggestions</div>
                  <div className="space-y-1">
                    {slashSuggestions.map((command) => (
                      <button
                        key={`autocomplete-${command.id}`}
                        type="button"
                        onClick={() => void handleSelectAutocomplete(command)}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left hover:bg-white/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] text-zinc-100 truncate">{command.command}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{command.description}</div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] ${
                            command.risk === 'write'
                              ? 'bg-amber-500/15 text-amber-200'
                              : 'bg-cyan-500/15 text-cyan-100'
                          }`}
                        >
                          {command.risk}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 mb-1.5">Quick Actions</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      onClick={() => void triggerCommand(command)}
                      disabled={sending}
                      className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                      title={command.description}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CHAT_COMMAND_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategoryId(category.id)}
                    className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] transition-colors ${
                      activeCategoryId === category.id
                        ? 'bg-white/20 text-zinc-100'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categoryActions.map((command) => {
                  const guard = resolveCommandGuard(command)
                  const disabled = sending || guard.checking || !guard.allowed
                  return (
                    <button
                      key={command.id}
                      type="button"
                      onClick={() => void triggerCommand(command)}
                      disabled={disabled}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                        command.risk === 'write'
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                          : 'border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                      }`}
                      title={
                        guard.allowed
                          ? command.description
                          : `${command.description}\n${guard.reason ?? 'Unavailable'}`
                      }
                    >
                      {command.label}
                    </button>
                  )
                })}
              </div>

              {followUpActions.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 mb-1.5">Suggested Next</div>
                  <div className="flex flex-wrap gap-1.5">
                    {followUpActions.map((command) => {
                      const guard = resolveCommandGuard(command)
                      return (
                        <button
                          key={command.id}
                          type="button"
                          onClick={() => void triggerCommand(command)}
                          disabled={sending || guard.checking || !guard.allowed}
                          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                          title={
                            guard.allowed
                              ? command.description
                              : `${command.description}\n${guard.reason ?? 'Unavailable'}`
                          }
                        >
                          {command.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {unavailableWriteReasons.length > 0 && (
                <div className="text-[10px] text-amber-200/90">
                  Write actions unavailable: {unavailableWriteReasons[0]}
                </div>
              )}

              {commandHint && (
                <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100">
                  {commandHint}
                </div>
              )}

              {pendingCommand && (
                <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100">
                  <div className="font-medium">Confirm write action</div>
                  <div className="mt-1 text-amber-100/90">{pendingCommand.command}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConfirmPending()}
                      disabled={sending}
                      className="rounded-md bg-amber-400/25 px-2 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-400/35 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPending}
                      disabled={sending}
                      className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/15 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="space-y-2 border-t border-white/10 bg-zinc-900/90 px-3 py-2.5 shrink-0">
            {replyingToMessage && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Replying To</div>
                  <div className="text-[11px] text-zinc-200 truncate">
                    {previewMessageText(replyingToMessage.content)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToMessageId(null)}
                  className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label="Cancel reply"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={showCommandCenter ? 'Type a message or tap an action…' : 'Type a message…'}
              disabled={sending}
              className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-brand-primary/50 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="shrink-0 rounded-full bg-[#2374e1] p-2 text-white transition-colors hover:bg-[#2f80ed] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {sending ? (
                <Spinner size="sm" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
