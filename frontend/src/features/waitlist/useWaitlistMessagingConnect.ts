import { useCallback, useEffect, useRef, useState } from 'react'

import type { XmtpStatus } from '@/lib/xmtp/provider'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { shouldRetryWaitlistJoin } from './waitlistChatCopy'
import type { PrepareWaitlistMessagingWalletResult } from './prepareWaitlistMessagingWallet'

type UseWaitlistMessagingConnectParams = {
  xmtpStatus: XmtpStatus
  privyAuthenticated: boolean
  prepare: () => Promise<PrepareWaitlistMessagingWalletResult>
  connect: (intent: 'user') => Promise<void>
  disconnect: () => void
  joinStatus: WaitlistChatStatus
  retryJoin: () => void
  walletReady: boolean
}

export function useWaitlistMessagingConnect(params: UseWaitlistMessagingConnectParams) {
  const {
    xmtpStatus,
    privyAuthenticated,
    prepare,
    connect,
    disconnect,
    joinStatus,
    retryJoin,
    walletReady,
  } = params

  const [prepareError, setPrepareError] = useState<string | null>(null)
  const [prepareBusy, setPrepareBusy] = useState(false)
  const [messagingEverConnected, setMessagingEverConnected] = useState(false)
  const connectInFlightRef = useRef(false)

  const isConnecting = xmtpStatus === 'signing' || xmtpStatus === 'connecting'
  const messagingConnected = xmtpStatus === 'connected'
  const shouldRequestJoin = shouldRetryWaitlistJoin(joinStatus)

  useEffect(() => {
    if (messagingConnected) {
      setMessagingEverConnected(true)
    }
  }, [messagingConnected])

  const needsConnectMessaging =
    (!messagingConnected && !isConnecting && !messagingEverConnected) ||
    (xmtpStatus === 'error' && !isConnecting)

  const connectAndJoin = useCallback(
    async (options?: { skipJoinRetry?: boolean; reconnect?: boolean }) => {
      if (connectInFlightRef.current) return

      setPrepareError(null)
      if (!privyAuthenticated) {
        setPrepareError(
          'Your 4626 session is active, but Privy sign-in is not loaded in this browser. Sign in with email again, then retry.',
        )
        return
      }

      connectInFlightRef.current = true
      setPrepareBusy(true)
      try {
        if (options?.reconnect) {
          disconnect()
        }

        const prepared = await prepare()
        if (!prepared.ok) {
          setPrepareError(prepared.error)
          return
        }

        await connect('user')
        setMessagingEverConnected(true)

        if (!options?.skipJoinRetry && shouldRequestJoin) {
          retryJoin()
        }
      } catch (err) {
        setPrepareError(err instanceof Error ? err.message : String(err))
      } finally {
        connectInFlightRef.current = false
        setPrepareBusy(false)
      }
    },
    [connect, disconnect, prepare, privyAuthenticated, retryJoin, shouldRequestJoin],
  )

  const reconnectMessaging = useCallback(async () => {
    const skipJoinRetry =
      joinStatus === 'executed' || joinStatus === 'pending' || joinStatus === 'executing'
    await connectAndJoin({ skipJoinRetry, reconnect: true })
  }, [connectAndJoin, joinStatus])

  return {
    prepareError,
    prepareBusy,
    walletReady,
    isConnecting,
    messagingConnected,
    needsConnectMessaging,
    connectAndJoin,
    reconnectMessaging,
  }
}
