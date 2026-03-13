/**
 * ChatWidget — root chat component rendered on every page.
 *
 * Manages:
 * - The XmtpChatProvider (self-contained)
 * - Which chat windows are open and their minimized state
 * - The ChatBar (conversation list toggle)
 * - "New DM" modal
 *
 * Layout (fixed, bottom of viewport):
 * ┌──────────────────────────────────────────┐
 * │  ...page content...                      │
 * │                                          │
 * │   [ChatWindow 2] [ChatWindow 1] [ChatBar]│ ← bottom-right
 * └──────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useLogin } from '@privy-io/react-auth'
import { MessageSquare, X } from 'lucide-react'
import { XmtpChatProvider, type ChatConversation, useXmtp } from '@/lib/xmtp/provider'
import {
  getBasenameAutocompleteCandidate,
  resolveDmRecipient,
  type DmRecipientResolution,
} from '@/lib/xmtp/socialIdentity'
import { resolveDmRoute } from './dmRouting'
import { ChatBar } from './ChatBar'
import { ChatWindow } from './ChatWindow'
import { getChatCommandById } from './commandCenter'
import { rekeyOpenWindows, type OpenWindow } from './chatWidgetState'

const MAX_OPEN_WINDOWS = 3
const AGENT_XMTP_ADDRESS = String(import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim().toLowerCase()
const AGENT_DISPLAY_NAME = String(import.meta.env.VITE_AGENT_DISPLAY_NAME ?? 'akita').trim() || 'akita'
const DM_PREVIEW_LOOKUP_DEBOUNCE_MS = 450

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeEvmAddress(value: string | null | undefined): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  return isEvmAddress(raw) ? (raw.toLowerCase() as `0x${string}`) : null
}

function shouldResolveDmPreviewInput(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  if (isEvmAddress(trimmed)) return true

  const basenameCandidate = getBasenameAutocompleteCandidate(trimmed)
  if (!basenameCandidate) return false

  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed
  if (!withoutAt) return false
  if (withoutAt.toLowerCase().endsWith('.base.eth')) return true
  return withoutAt.length >= 3
}

type PendingDeepLinkIntent = {
  actionId: string
  peerAddress: string
  peerName: string
}

function ConnectToChatPrompt() {
  const { login } = useLogin({})
  const [busy, setBusy] = useState(false)

  const handleConnect = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await login()
    } catch {
      // user dismissed
    } finally {
      setBusy(false)
    }
  }, [busy, login])

  return (
    <>
      {/* Desktop: bottom-right pill */}
      <div className="fixed bottom-0 right-4 z-50 hidden md:flex items-end pointer-events-none">
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy}
          className="pointer-events-auto flex items-center gap-2 rounded-t-xl bg-zinc-900 border border-b-0 border-white/10 px-4 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-60"
        >
          <MessageSquare className="w-4 h-4" />
          {busy ? 'Connecting…' : 'Chat'}
        </button>
      </div>
      {/* Mobile: top-right icon */}
      <div className="fixed inset-0 z-50 pointer-events-none md:hidden">
        <div className="absolute top-4 right-4 pointer-events-auto">
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-60"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {busy ? '…' : 'Chat'}
          </button>
        </div>
      </div>
    </>
  )
}

function ChatWidgetInner() {
  const { isConnected, address } = useAccount()
  const { startDm, connect, status, identityAddress } = useXmtp()

  const [barExpanded, setBarExpanded] = useState(false)
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [showNewDm, setShowNewDm] = useState(false)
  const [newDmAddress, setNewDmAddress] = useState('')
  const [newDmError, setNewDmError] = useState('')
  const [newDmNotice, setNewDmNotice] = useState('')
  const [newDmLoading, setNewDmLoading] = useState(false)
  const [newDmPreview, setNewDmPreview] = useState<DmRecipientResolution | null>(null)
  const [newDmPreviewQuery, setNewDmPreviewQuery] = useState('')
  const [newDmPreviewLoading, setNewDmPreviewLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pendingDeepLinkIntent, setPendingDeepLinkIntent] = useState<PendingDeepLinkIntent | null>(null)
  const newDmPreviewCacheRef = useRef<Map<string, DmRecipientResolution | null>>(new Map())

  const maybeConnectMessaging = useCallback(() => {
    if (status === 'idle' || status === 'error') {
      void connect()
    }
  }, [connect, status])

  const clearChatActionQuery = useCallback(() => {
    if (typeof window === 'undefined') return
    const nextUrl = new URL(window.location.href)
    const hasAny =
      nextUrl.searchParams.has('chatAction') ||
      nextUrl.searchParams.has('chatPeer') ||
      nextUrl.searchParams.has('chatName')
    if (!hasAny) return
    nextUrl.searchParams.delete('chatAction')
    nextUrl.searchParams.delete('chatPeer')
    nextUrl.searchParams.delete('chatName')
    window.history.replaceState({}, '', nextUrl.toString())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handleChange = () => setIsMobile(mq.matches)
    handleChange()
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const searchParams = new URLSearchParams(window.location.search)
    const actionId = searchParams.get('chatAction')
    if (!actionId) return
    if (!getChatCommandById(actionId)) return
    const maybePeer = String(searchParams.get('chatPeer') ?? '').trim().toLowerCase()
    const peerAddress =
      /^0x[a-fA-F0-9]{40}$/.test(maybePeer) ? maybePeer : AGENT_XMTP_ADDRESS
    if (!/^0x[a-fA-F0-9]{40}$/.test(peerAddress)) return
    const maybeName = String(searchParams.get('chatName') ?? '').trim()
    const peerName = maybeName || (peerAddress === AGENT_XMTP_ADDRESS
      ? AGENT_DISPLAY_NAME
      : `${peerAddress.slice(0, 6)}…${peerAddress.slice(-4)}`)
    setPendingDeepLinkIntent({
      actionId,
      peerAddress,
      peerName,
    })
  }, [])

  const handleOpenChat = useCallback((convo: ChatConversation) => {
    const seedCommandId = (convo as ChatConversation & { seedCommandId?: string }).seedCommandId ?? null
    setOpenWindows((prev) => {
      // Already open? Just un-minimize
      const existing = prev.find((w) => w.id === convo.id)
      if (existing) {
        return prev.map((w) =>
          w.id === convo.id
            ? { ...w, minimized: false, seedCommandId: seedCommandId ?? w.seedCommandId ?? null }
            : w,
        )
      }
      // Enforce max open windows (close oldest)
      const next = [...prev]
      if (next.length >= MAX_OPEN_WINDOWS) {
        next.shift()
      }
      next.push({
        id: convo.id,
        name: convo.name,
        type: convo.type,
        peerInboxId: convo.peerInboxId,
        peerAddress: convo.peerAddress,
        imageUrl: convo.imageUrl,
        minimized: false,
        seedCommandId,
      })
      return next
    })
    if (isMobile) {
      setBarExpanded(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (!pendingDeepLinkIntent) return
    maybeConnectMessaging()
  }, [pendingDeepLinkIntent, maybeConnectMessaging])

  useEffect(() => {
    if (!pendingDeepLinkIntent) return
    if (status !== 'connected') return
    if (!/^0x[a-fA-F0-9]{40}$/.test(pendingDeepLinkIntent.peerAddress)) {
      setPendingDeepLinkIntent(null)
      clearChatActionQuery()
      return
    }

    let cancelled = false
    void (async () => {
      let targetPeerAddress = pendingDeepLinkIntent.peerAddress as `0x${string}`
      let dmResult = await startDm(targetPeerAddress)
      if (!dmResult.ok && dmResult.reason === 'self_recipient') {
        const agentAddress = normalizeEvmAddress(AGENT_XMTP_ADDRESS)
        if (agentAddress && agentAddress !== targetPeerAddress) {
          targetPeerAddress = agentAddress
          dmResult = await startDm(agentAddress, { nameHint: AGENT_DISPLAY_NAME })
        }
      }
      if (cancelled || !dmResult.ok) return
      handleOpenChat({
        id: dmResult.conversationId,
        type: 'dm',
        name: targetPeerAddress === AGENT_XMTP_ADDRESS
          ? AGENT_DISPLAY_NAME
          : pendingDeepLinkIntent.peerName,
        peerAddress: targetPeerAddress,
        unreadCount: 0,
        seedCommandId: pendingDeepLinkIntent.actionId,
      } as ChatConversation)
      setPendingDeepLinkIntent(null)
      clearChatActionQuery()
    })()

    return () => {
      cancelled = true
    }
  }, [clearChatActionQuery, handleOpenChat, pendingDeepLinkIntent, startDm, status])

  const handleMinimize = useCallback((id: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
    )
  }, [])

  const handleSeedConsumed = useCallback((id: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, seedCommandId: null } : w)),
    )
  }, [])

  const handleClose = useCallback((id: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const handleConversationRekey = useCallback((oldConversationId: string, newConversationId: string) => {
    setOpenWindows((prev) => rekeyOpenWindows(prev, oldConversationId, newConversationId))
  }, [])

  const handleNewDm = useCallback(() => {
    setShowNewDm(true)
    setNewDmAddress('')
    setNewDmError('')
    setNewDmNotice('')
    setNewDmPreview(null)
    setNewDmPreviewQuery('')
    setNewDmPreviewLoading(false)
  }, [])

  useEffect(() => {
    if (!showNewDm) return
    const input = newDmAddress.trim()
    if (!shouldResolveDmPreviewInput(input)) {
      setNewDmPreview(null)
      setNewDmPreviewQuery('')
      setNewDmPreviewLoading(false)
      return
    }

    const cacheKey = input.toLowerCase()
    const cached = newDmPreviewCacheRef.current.get(cacheKey)
    if (cached !== undefined) {
      setNewDmPreview(cached)
      setNewDmPreviewQuery(input)
      setNewDmPreviewLoading(false)
      return
    }

    let cancelled = false
    setNewDmPreviewLoading(true)
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const resolved = await resolveDmRecipient(input)
          newDmPreviewCacheRef.current.set(cacheKey, resolved)
          if (cancelled) return
          setNewDmPreview(resolved)
        } catch {
          if (cancelled) return
          setNewDmPreview(null)
        } finally {
          if (cancelled) return
          setNewDmPreviewQuery(input)
          setNewDmPreviewLoading(false)
        }
      })()
    }, DM_PREVIEW_LOOKUP_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [newDmAddress, showNewDm])

  const handleStartDm = useCallback(async () => {
    const input = newDmAddress.trim()
    const inputKey = input.toLowerCase()
    const previewForInput =
      newDmPreviewQuery.trim().toLowerCase() === inputKey
        ? newDmPreview
        : newDmPreviewCacheRef.current.get(inputKey) ?? null
    const resolved = previewForInput ?? await resolveDmRecipient(input)
    if (!resolved) {
      setNewDmError('Enter a valid Ethereum address or Basename (for example, akita)')
      return
    }
    newDmPreviewCacheRef.current.set(inputKey, resolved)
    setNewDmError('')
    setNewDmNotice('')
    setNewDmLoading(true)
    try {
      const agentAddress = normalizeEvmAddress(AGENT_XMTP_ADDRESS)
      const routeDecision = resolveDmRoute({
        recipient: resolved,
        identityAddress,
        connectedAddress: address,
        agentAddress: AGENT_XMTP_ADDRESS,
        agentDisplayName: AGENT_DISPLAY_NAME,
      })
      let destination = routeDecision.recipient
      if (routeDecision.notice) setNewDmNotice(routeDecision.notice)

      let dmResult = await startDm(destination.address, {
        nameHint: destination.basenameHint,
        imageUrl: destination.avatarUrl,
      })

      if (!dmResult.ok && dmResult.reason === 'self_recipient' && agentAddress) {
        setNewDmNotice('Use Akita to chat about your wallet. Opening Akita instead.')
        destination = {
          ...destination,
          address: agentAddress,
          basenameHint: AGENT_DISPLAY_NAME,
        }
        dmResult = await startDm(agentAddress, {
          nameHint: AGENT_DISPLAY_NAME,
          imageUrl: destination.avatarUrl,
        })
      }

      if (dmResult.ok) {
        setShowNewDm(false)
        handleOpenChat({
          id: dmResult.conversationId,
          type: 'dm',
          name: destination.basenameHint || `${destination.address.slice(0, 6)}…${destination.address.slice(-4)}`,
          peerAddress: destination.address,
          imageUrl: destination.avatarUrl ?? undefined,
          unreadCount: 0,
        })
      } else {
        setNewDmError(dmResult.message || 'Could not start conversation')
      }
    } catch (e) {
      setNewDmError(e instanceof Error ? e.message : 'Failed to start DM')
    } finally {
      setNewDmLoading(false)
    }
  }, [newDmAddress, newDmPreview, newDmPreviewQuery, startDm, handleOpenChat, identityAddress, address])

  const activeMobileWindow = openWindows[openWindows.length - 1]
  const showMobileBar = barExpanded && !activeMobileWindow
  const basenameAutocomplete = getBasenameAutocompleteCandidate(newDmAddress)
  const showBasenameAutocomplete = Boolean(
    basenameAutocomplete && basenameAutocomplete !== newDmAddress.trim().toLowerCase(),
  )
  const activeDmPreview =
    newDmPreviewQuery.trim().toLowerCase() === newDmAddress.trim().toLowerCase()
      ? newDmPreview
      : null

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isChatOverlayActiveOnMobile = isMobile && (showMobileBar || Boolean(activeMobileWindow))
    window.dispatchEvent(new CustomEvent('vault-mobile-chat-overlay-change', { detail: { active: isChatOverlayActiveOnMobile } }))
    return () => {
      window.dispatchEvent(new CustomEvent('vault-mobile-chat-overlay-change', { detail: { active: false } }))
    }
  }, [isMobile, showMobileBar, activeMobileWindow])

  if (!isConnected) return <ConnectToChatPrompt />

  return (
    <>
      <div className="fixed inset-0 z-50 pointer-events-none md:hidden">
        {showMobileBar && (
          <div className="absolute inset-0 pointer-events-auto">
            <ChatBar
              expanded
              variant="mobile"
              onToggle={() => setBarExpanded(false)}
              onOpenChat={handleOpenChat}
              onNewDm={handleNewDm}
            />
          </div>
        )}

        {activeMobileWindow && (
          <div className="absolute inset-0 pointer-events-auto">
            <ChatWindow
              conversationId={activeMobileWindow.id}
              conversationName={activeMobileWindow.name}
              conversationType={activeMobileWindow.type}
              peerInboxId={activeMobileWindow.peerInboxId}
              peerAddress={activeMobileWindow.peerAddress}
              conversationImageUrl={activeMobileWindow.imageUrl}
              minimized={false}
              variant="mobile"
              seedCommandId={activeMobileWindow.seedCommandId ?? null}
              onSeedConsumed={() => handleSeedConsumed(activeMobileWindow.id)}
              onMinimize={() => handleMinimize(activeMobileWindow.id)}
              onConversationRekey={handleConversationRekey}
              onClose={() => handleClose(activeMobileWindow.id)}
            />
          </div>
        )}

        {!showMobileBar && !activeMobileWindow && (
          <div className="absolute top-4 right-4 pointer-events-auto">
            <ChatBar
              expanded={false}
              variant="mobile"
              onToggle={() => {
                setBarExpanded(true)
                maybeConnectMessaging()
              }}
              onOpenChat={handleOpenChat}
              onNewDm={handleNewDm}
            />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 right-4 z-50 hidden md:flex items-end gap-2 pointer-events-none">
        {/* Chat windows — stack from right to left */}
        {openWindows.map((win) => (
          <div key={win.id} className="pointer-events-auto">
            <ChatWindow
              conversationId={win.id}
              conversationName={win.name}
              conversationType={win.type}
              peerInboxId={win.peerInboxId}
              peerAddress={win.peerAddress}
              conversationImageUrl={win.imageUrl}
              minimized={win.minimized}
              seedCommandId={win.seedCommandId ?? null}
              onSeedConsumed={() => handleSeedConsumed(win.id)}
              onMinimize={() => handleMinimize(win.id)}
              onConversationRekey={handleConversationRekey}
              onClose={() => handleClose(win.id)}
            />
          </div>
        ))}

        {/* Chat bar — always on far right */}
        <div className="pointer-events-auto">
          <ChatBar
            expanded={barExpanded}
            onToggle={() =>
              setBarExpanded((v) => {
                const next = !v
                if (next) maybeConnectMessaging()
                return next
              })
            }
            onOpenChat={handleOpenChat}
            onNewDm={handleNewDm}
          />
        </div>
      </div>

      {/* New DM modal overlay */}
      {showNewDm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-[360px] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">New Message</h3>
              <button
                type="button"
                onClick={() => setShowNewDm(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400">Recipient address or Basename</label>
              <input
                type="text"
                value={newDmAddress}
                onChange={(e) => {
                  setNewDmAddress(e.target.value)
                  if (newDmError) setNewDmError('')
                  if (newDmNotice) setNewDmNotice('')
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleStartDm() }}
                placeholder="0x... or akita"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-primary/40 font-mono"
                autoFocus
              />
              {showBasenameAutocomplete && basenameAutocomplete && (
                <button
                  type="button"
                  onClick={() => setNewDmAddress(basenameAutocomplete)}
                  className="text-xs text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  Use {basenameAutocomplete}
                </button>
              )}
              {newDmAddress.trim() && newDmPreviewLoading && !newDmError && (
                <div className="text-xs text-zinc-500">Resolving recipient…</div>
              )}
              {newDmAddress.trim() && !newDmPreviewLoading && activeDmPreview && !newDmError && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] text-zinc-400">Recipient</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeDmPreview.avatarUrl ? (
                      <img
                        src={activeDmPreview.avatarUrl}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10" />
                    )}
                    <div className="text-xs text-zinc-200">
                      {activeDmPreview.basenameHint
                        ? `${activeDmPreview.basenameHint}.base.eth`
                        : 'Wallet address'}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {activeDmPreview.address.slice(0, 6)}…{activeDmPreview.address.slice(-4)}
                  </div>
                </div>
              )}
              {newDmError && (
                <div className="text-xs text-red-400">{newDmError}</div>
              )}
              {!newDmError && newDmNotice && (
                <div className="text-xs text-zinc-400">{newDmNotice}</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewDm(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartDm}
                disabled={newDmLoading || !newDmAddress.trim()}
                className="px-4 py-1.5 rounded-lg bg-brand-primary/20 text-brand-primary text-sm font-medium hover:bg-brand-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {newDmLoading ? 'Starting…' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Self-contained chat widget — wraps itself in the XMTP provider.
 * Drop this into any layout to get the full chat experience.
 */
export function ChatWidget() {
  return (
    <XmtpChatProvider>
      <ChatWidgetInner />
    </XmtpChatProvider>
  )
}
