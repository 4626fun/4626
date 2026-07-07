import { useCallback, useEffect, useRef, useState } from 'react'

import type { XmtpStatus } from '@/lib/xmtp/provider'

import { isPrivyEmbeddedSignerAuthError } from '@/lib/xmtp/xmtpHelpers'
import type { SessionRepairOutcome } from '@/lib/auth/sessionRepair'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { shouldRetryWaitlistJoin } from './waitlistChatCopy'
import { formatWaitlistChatError } from './waitlistChatErrors'
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
  repairSession?: () => Promise<SessionRepairOutcome | boolean> | (SessionRepairOutcome | boolean)
}

const SESSION_FINALIZING_RETRY_MESSAGE =
  'Your sign-in is still finalizing. Tap Connect Messaging again in a moment.'

/**
 * Normalize a repair result into a SessionRepairOutcome. A legacy boolean
 * `true` maps to `repaired`; `false` maps to `transient` so a momentary token
 * miss never burns the single repair attempt or hard-errors the connect path.
 */
function normalizeRepairOutcome(value: SessionRepairOutcome | boolean): SessionRepairOutcome {
  if (value === true) return 'repaired'
  if (value === false) return 'transient'
  return value
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
    repairSession,
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

      connectInFlightRef.current = true
      setPrepareBusy(true)
      try {
        // Only a successful repair consumes the single attempt; a `transient`
        // outcome leaves this false so a later user click can retry repair.
        let repairConsumed = false

        const runRepairOutcome = async (): Promise<SessionRepairOutcome> => {
          if (!repairSession) return 'no-privy'
          const result = await Promise.resolve(repairSession()).catch(() => 'transient' as const)
          return normalizeRepairOutcome(result)
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (!privyAuthenticated) {
            if (!repairConsumed && repairSession) {
              const outcome = await runRepairOutcome()
              if (outcome === 'repaired') {
                repairConsumed = true
                continue
              }
              if (outcome === 'transient') {
                // Session likely still finalizing — do not burn the attempt.
                setPrepareError(SESSION_FINALIZING_RETRY_MESSAGE)
                return
              }
              // 'true-stale' | 'recovery-required' | 'no-privy' fall through.
            }
            setPrepareError(
              'Your 4626 session is active, but Privy sign-in is not loaded in this browser. Sign in with email again, then retry.',
            )
            return
          }

          if (options?.reconnect || attempt > 0) {
            disconnect()
          }

          const prepared = await prepare()
          if (!prepared.ok) {
            setPrepareError(prepared.error)
            return
          }

          try {
            await connect('user')
            setMessagingEverConnected(true)

            if (!options?.skipJoinRetry && shouldRequestJoin) {
              retryJoin()
            }
            return
          } catch (connectError) {
            const raw =
              connectError instanceof Error ? connectError.message : String(connectError)
            const authExpired = isPrivyEmbeddedSignerAuthError(raw)
            if (authExpired && !repairConsumed && repairSession) {
              const outcome = await runRepairOutcome()
              if (outcome === 'repaired') {
                repairConsumed = true
                continue
              }
              if (outcome === 'transient') {
                setPrepareError(SESSION_FINALIZING_RETRY_MESSAGE)
                return
              }
              // 'true-stale' | 'recovery-required' | 'no-privy' fall through.
            }
            throw connectError
          }
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        const friendly = formatWaitlistChatError(raw)
        if (friendly) {
          setPrepareError(friendly)
        } else if (isPrivyEmbeddedSignerAuthError(raw)) {
          setPrepareError('Sign-in for chat expired.')
        } else {
          setPrepareError(raw)
        }
      } finally {
        connectInFlightRef.current = false
        setPrepareBusy(false)
      }
    },
    [connect, disconnect, prepare, privyAuthenticated, retryJoin, shouldRequestJoin, repairSession],
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
