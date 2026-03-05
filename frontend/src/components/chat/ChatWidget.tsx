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

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { X } from 'lucide-react'
import { XmtpChatProvider, type ChatConversation, useXmtp } from '@/lib/xmtp/provider'
import { ChatBar } from './ChatBar'
import { ChatWindow } from './ChatWindow'
import { getChatCommandById } from './commandCenter'

const MAX_OPEN_WINDOWS = 3
const AGENT_XMTP_ADDRESS = String(import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim().toLowerCase()
const AGENT_DISPLAY_NAME = String(import.meta.env.VITE_AGENT_DISPLAY_NAME ?? 'Keepr').trim() || 'Keepr'

type PendingDeepLinkIntent = {
  actionId: string
  peerAddress: string
  peerName: string
}

type OpenWindow = {
  id: string
  name: string
  type: 'dm' | 'group'
  peerInboxId?: string
  peerAddress?: string
  imageUrl?: string
  minimized: boolean
  seedCommandId?: string | null
}

function ChatWidgetInner() {
  const { isConnected } = useAccount()
  const { startDm, connect, status } = useXmtp()

  const [barExpanded, setBarExpanded] = useState(false)
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [showNewDm, setShowNewDm] = useState(false)
  const [newDmAddress, setNewDmAddress] = useState('')
  const [newDmError, setNewDmError] = useState('')
  const [newDmLoading, setNewDmLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pendingDeepLinkIntent, setPendingDeepLinkIntent] = useState<PendingDeepLinkIntent | null>(null)

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
      const convoId = await startDm(pendingDeepLinkIntent.peerAddress as `0x${string}`)
      if (cancelled || !convoId) return
      handleOpenChat({
        id: convoId,
        type: 'dm',
        name: pendingDeepLinkIntent.peerName,
        peerAddress: pendingDeepLinkIntent.peerAddress,
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

  const handleNewDm = useCallback(() => {
    setShowNewDm(true)
    setNewDmAddress('')
    setNewDmError('')
  }, [])

  const handleStartDm = useCallback(async () => {
    const addr = newDmAddress.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setNewDmError('Enter a valid Ethereum address')
      return
    }
    setNewDmError('')
    setNewDmLoading(true)
    try {
      const convoId = await startDm(addr as `0x${string}`)
      if (convoId) {
        setShowNewDm(false)
        handleOpenChat({
          id: convoId,
          type: 'dm',
          name: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
          peerAddress: addr,
          unreadCount: 0,
        })
      } else {
        setNewDmError('Could not start conversation')
      }
    } catch (e) {
      setNewDmError(e instanceof Error ? e.message : 'Failed to start DM')
    } finally {
      setNewDmLoading(false)
    }
  }, [newDmAddress, startDm, handleOpenChat])

  const activeMobileWindow = openWindows[openWindows.length - 1]
  const showMobileBar = barExpanded && !activeMobileWindow

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isChatOverlayActiveOnMobile = isMobile && (showMobileBar || Boolean(activeMobileWindow))
    window.dispatchEvent(new CustomEvent('vault-mobile-chat-overlay-change', { detail: { active: isChatOverlayActiveOnMobile } }))
    return () => {
      window.dispatchEvent(new CustomEvent('vault-mobile-chat-overlay-change', { detail: { active: false } }))
    }
  }, [isMobile, showMobileBar, activeMobileWindow])

  // Don't render anything if wallet is not connected
  if (!isConnected) return null

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
              <label className="text-xs text-zinc-400">Recipient address</label>
              <input
                type="text"
                value={newDmAddress}
                onChange={(e) => setNewDmAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleStartDm() }}
                placeholder="0x…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-brand-primary/40 font-mono"
                autoFocus
              />
              {newDmError && (
                <div className="text-xs text-red-400">{newDmError}</div>
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
