import type { ReactNode } from 'react'

import { XmtpChatProvider } from '@/lib/xmtp/provider'
import { useXmtpSessionRepair } from '@/lib/xmtp/useXmtpSessionRepair'

/**
 * `XmtpChatProvider` pre-wired with the bounded chat session-repair callback.
 *
 * Use this only inside the app interactive layout (PrivyProvider + SIWE/wagmi
 * context present). It must NOT be mounted on marketing shells — see
 * `useXmtpSessionRepair`. The waitlist embedded chat keeps its own repair path
 * via `useWaitlistMessagingConnect` and therefore uses the bare provider.
 */
export function ChatProviderWithSessionRepair({
  children,
  identityHintAddress = null,
}: {
  children: ReactNode
  identityHintAddress?: string | null
}) {
  const attemptSessionRepair = useXmtpSessionRepair()
  return (
    <XmtpChatProvider identityHintAddress={identityHintAddress} attemptSessionRepair={attemptSessionRepair}>
      {children}
    </XmtpChatProvider>
  )
}
