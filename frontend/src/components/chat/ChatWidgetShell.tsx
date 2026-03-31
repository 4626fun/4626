import { Suspense, lazy } from 'react'
import { MessageSquare } from 'lucide-react'
import { ConnectToChatPrompt } from './ConnectToChatPrompt'
import { useChatActivation } from './useChatActivation'

const LazyChatWidget = lazy(async () => {
  const mod = await import('./ChatWidget')
  return { default: mod.ChatWidget }
})

function ChatWidgetLoadingFallback() {
  return (
    <>
      <div className="fixed bottom-0 right-4 z-50 hidden md:flex items-end pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-t-xl bg-zinc-900 border border-b-0 border-white/10 px-4 py-2.5 text-xs font-medium text-zinc-400">
          <MessageSquare className="w-4 h-4" />
          Loading chat…
        </div>
      </div>
      <div className="fixed inset-0 z-50 pointer-events-none md:hidden">
        <div className="absolute top-4 right-4 pointer-events-auto">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400">
            <MessageSquare className="w-3.5 h-3.5" />
            …
          </div>
        </div>
      </div>
    </>
  )
}

export function ChatWidgetShell() {
  const { chatActivated, setChatActivated } = useChatActivation()

  if (!chatActivated) {
    return (
      <ConnectToChatPrompt
        onActivate={() => {
          setChatActivated(true)
        }}
      />
    )
  }

  return (
    <Suspense fallback={<ChatWidgetLoadingFallback />}>
      <LazyChatWidget initiallyActivated />
    </Suspense>
  )
}
