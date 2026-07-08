import { Suspense, lazy, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, MessageSquare } from 'lucide-react'

import { LoadingInline } from '@/components/ui/LoadingState'

import type { WaitlistConnectTrack } from './waitlistFlowState'

const LazyWaitlistGroupChatPanel = lazy(async () => {
  const mod = await import('./WaitlistGroupChatPanel')
  return { default: mod.WaitlistGroupChatPanel }
})

type WaitlistChatDockProps = {
  setupComplete: boolean
  messagingReady: boolean
  connectTrack: WaitlistConnectTrack
}

/**
 * Desktop waitlist chat dock — mirrors app ChatWidget bottom-right placement.
 * Portaled to document.body so Framer Motion transforms on the waitlist card
 * do not trap `position: fixed` in the centered column.
 */
export function WaitlistChatDock(props: WaitlistChatDockProps) {
  const [expanded, setExpanded] = useState(true)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] sm:right-5">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/75 px-4 py-2.5 text-sm font-medium text-zinc-200 shadow-[0_18px_46px_-26px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-colors hover:border-white/15 hover:bg-black/85"
          aria-label="Open waitlist group chat"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Waitlist chat</span>
        </button>
      ) : (
        <div className="pointer-events-auto flex w-[min(370px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-[0_18px_46px_-26px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 text-left text-zinc-200 transition-colors hover:bg-white/[0.03]"
            aria-label="Minimize waitlist group chat"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">Waitlist chat</span>
            </span>
            <ChevronDown className="h-4 w-4 rotate-180 text-zinc-400" />
          </button>

          <div className="flex min-h-0 flex-1 flex-col p-3">
            <Suspense
              fallback={
                <div className="flex min-h-[300px] items-center justify-center px-2 py-6">
                  <LoadingInline labelOverride="Loading waitlist chat…" />
                </div>
              }
            >
              <LazyWaitlistGroupChatPanel
                setupComplete={props.setupComplete}
                messagingReady={props.messagingReady}
                connectTrack={props.connectTrack}
                layout="dock"
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
