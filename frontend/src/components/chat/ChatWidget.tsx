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

import { useCallback, useState } from 'react'
import { useAccount } from 'wagmi'
import { X } from 'lucide-react'
import { XmtpChatProvider, type ChatConversation, useXmtp } from '@/lib/xmtp/provider'
import { ChatBar } from './ChatBar'
import { ChatWindow } from './ChatWindow'

const MAX_OPEN_WINDOWS = 3

type OpenWindow = {
  id: string
  name: string
  type: 'dm' | 'group'
  minimized: boolean
}

function ChatWidgetInner() {
  const { isConnected } = useAccount()
  const { startDm } = useXmtp()

  const [barExpanded, setBarExpanded] = useState(false)
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [showNewDm, setShowNewDm] = useState(false)
  const [newDmAddress, setNewDmAddress] = useState('')
  const [newDmError, setNewDmError] = useState('')
  const [newDmLoading, setNewDmLoading] = useState(false)

  // Don't render anything if wallet is not connected
  if (!isConnected) return null

  const handleOpenChat = useCallback((convo: ChatConversation) => {
    setOpenWindows((prev) => {
      // Already open? Just un-minimize
      const existing = prev.find((w) => w.id === convo.id)
      if (existing) {
        return prev.map((w) => (w.id === convo.id ? { ...w, minimized: false } : w))
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
        minimized: false,
      })
      return next
    })
  }, [])

  const handleMinimize = useCallback((id: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
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

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2 pointer-events-none">
      {/* Chat windows — stack from right to left */}
      {openWindows.map((win) => (
        <div key={win.id} className="pointer-events-auto">
          <ChatWindow
            conversationId={win.id}
            conversationName={win.name}
            conversationType={win.type}
            minimized={win.minimized}
            onMinimize={() => handleMinimize(win.id)}
            onClose={() => handleClose(win.id)}
          />
        </div>
      ))}

      {/* Chat bar — always on far right */}
      <div className="pointer-events-auto">
        <ChatBar
          expanded={barExpanded}
          onToggle={() => setBarExpanded((v) => !v)}
          onOpenChat={handleOpenChat}
          onNewDm={handleNewDm}
        />
      </div>

      {/* New DM modal overlay */}
      {showNewDm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
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
    </div>
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
