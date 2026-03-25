import { Suspense, lazy, startTransition, useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useLogin } from '@privy-io/react-auth'
import { MessageSquare } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { hasChatDeepLinkSearch } from './chatActivation'

const LazyChatWidget = lazy(async () => {
  const mod = await import('./ChatWidget')
  return { default: mod.ChatWidget }
})

function useSafeChatLogin() {
  try {
    return useLogin({}) as { login: (options?: unknown) => Promise<void> }
  } catch {
    return {
      login: async () => {},
    }
  }
}

function ConnectToChatPrompt(props: { onActivate?: (() => void) | null }) {
  const { login } = useSafeChatLogin()
  const { isConnected } = useAccount()
  const [busy, setBusy] = useState(false)
  const onActivate = props.onActivate ?? null

  const handleConnect = useCallback(async () => {
    if (busy) return
    if (isConnected) {
      onActivate?.()
      return
    }
    setBusy(true)
    try {
      await login({ loginMethods: ['email', 'wallet'] } as any)
      onActivate?.()
    } catch {
      // user dismissed
    } finally {
      setBusy(false)
    }
  }, [busy, isConnected, login, onActivate])

  return (
    <>
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
  const location = useLocation()
  const hasDeepLinkActivation = hasChatDeepLinkSearch(location.search)
  const [chatActivated, setChatActivated] = useState(() => hasDeepLinkActivation)

  useEffect(() => {
    if (!hasDeepLinkActivation) return
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setChatActivated(true)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [hasDeepLinkActivation])

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
