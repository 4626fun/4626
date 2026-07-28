import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { CHAT_OPEN_REQUEST_EVENT, CHAT_TOGGLE_REQUEST_EVENT } from '@/lib/chat/openChat'
import { useSafeLogin } from '@/lib/privy/safeHooks'

export function ConnectToChatPrompt(props: { onActivate?: (() => void) | null }) {
  const { login } = useSafeLogin()
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

  // Mobile entry is the bottom-nav Chat tab (`requestToggleChat`). Keep this
  // component mounted for event handling + desktop-less activation paths.
  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={busy}
      className="sr-only"
      aria-label={busy ? 'Connecting chat' : 'Open chat'}
    >
      {busy ? 'Connecting chat' : 'Open chat'}
    </button>
  )
}
