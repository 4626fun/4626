import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useLogin } from '@privy-io/react-auth'
import { MessageSquare } from 'lucide-react'
import { CHAT_OPEN_REQUEST_EVENT, CHAT_TOGGLE_REQUEST_EVENT } from '@/lib/chat/openChat'

function useSafeChatLogin() {
  try {
    return useLogin() as { login: (options?: unknown) => Promise<void> }
  } catch {
    return {
      login: async () => {},
    }
  }
}

export function ConnectToChatPrompt(props: { onActivate?: (() => void) | null }) {
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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleChatShortcut = () => {
      void handleConnect()
    }

    window.addEventListener(CHAT_TOGGLE_REQUEST_EVENT, handleChatShortcut)
    window.addEventListener(CHAT_OPEN_REQUEST_EVENT, handleChatShortcut)
    return () => {
      window.removeEventListener(CHAT_TOGGLE_REQUEST_EVENT, handleChatShortcut)
      window.removeEventListener(CHAT_OPEN_REQUEST_EVENT, handleChatShortcut)
    }
  }, [handleConnect])

  return (
    <>
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
