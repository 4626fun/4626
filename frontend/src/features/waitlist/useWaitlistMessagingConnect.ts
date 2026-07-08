import { useCallback, useEffect, useRef, useState } from 'react'

import type { XmtpStatus } from '@/lib/xmtp/provider'

import { isPrivyEmbeddedSignerAuthError } from '@/lib/auth/privyEmbeddedSignerAuthErrors'
import type { SessionRepairOutcome } from '@/lib/auth/sessionRepair'

import type { WaitlistChatStatus } from './waitlistChatCopy'
import { shouldRetryWaitlistJoin } from './waitlistChatCopy'
import { formatWaitlistChatError, signInExpiredMessage } from './waitlistChatErrors'
import type { PrepareWaitlistMessagingWalletResult } from './prepareWaitlistMessagingWallet'

type UseWaitlistMessagingConnectParams = {
  xmtpStatus: XmtpStatus
  /** Latest error surfaced by the xmtp context (`useXmtp().error`), if any. */
  xmtpError?: string | null
  privyAuthenticated: boolean
  prepare: () => Promise<PrepareWaitlistMessagingWalletResult>
  connect: (intent: 'user') => Promise<void>
  disconnect: () => Promise<void>
  joinStatus: WaitlistChatStatus
  retryJoin: () => void
  walletReady: boolean
  repairSession?: () => Promise<SessionRepairOutcome | boolean> | (SessionRepairOutcome | boolean)
}

const SESSION_FINALIZING_RETRY_MESSAGE =
  'Your sign-in is still finalizing. Tap Connect Messaging again in a moment.'

export type ConnectRepairDecision =
  | { action: 'retry' }
  | { action: 'wait'; message: string }
  | { action: 'fresh-sign-in'; message: string }
  | { action: 'privy-not-loaded'; message: string }

/**
 * Normalize a repair result into a SessionRepairOutcome. Legacy boolean `true`
 * maps to `repaired`. Legacy boolean `false` is treated as `transient` only for
 * callers that still return booleans — prefer returning SessionRepairOutcome.
 */
export function normalizeRepairOutcome(value: SessionRepairOutcome | boolean): SessionRepairOutcome {
  if (value === true) return 'repaired'
  if (value === false) return 'transient'
  return value
}

/** Maps session-repair outcomes to the next connect step. */
export function resolveConnectAfterRepair(outcome: SessionRepairOutcome): ConnectRepairDecision {
  if (outcome === 'repaired') return { action: 'retry' }
  if (outcome === 'transient') {
    return { action: 'wait', message: SESSION_FINALIZING_RETRY_MESSAGE }
  }
  if (outcome === 'recovery-required' || outcome === 'true-stale') {
    return { action: 'fresh-sign-in', message: signInExpiredMessage() }
  }
  return {
    action: 'privy-not-loaded',
    message:
      'Your 4626 session is active, but Privy sign-in is not loaded in this browser. Sign in with email again, then retry.',
  }
}

export type ConnectFailureDisplay = { message: string; needsFreshSignIn: boolean }

/**
 * Formats a raw connect failure (either a thrown error's message, or the
 * xmtp context's `error` string after a connect that resolved without
 * throwing but did not reach `'connected'`) into the message + fresh-sign-in
 * flag the UI should show. Shared by both failure paths in `connectAndJoin`
 * so the two stay in sync.
 */
export function resolveConnectFailureDisplay(raw: string): ConnectFailureDisplay {
  const friendly = formatWaitlistChatError(raw)
  if (friendly) {
    const needsFreshSignIn =
      friendly === signInExpiredMessage() || /sign-in for chat expired|sign out and sign in/i.test(friendly)
    return { message: friendly, needsFreshSignIn }
  }
  if (isPrivyEmbeddedSignerAuthError(raw)) {
    return { message: signInExpiredMessage(), needsFreshSignIn: true }
  }
  return { message: raw, needsFreshSignIn: false }
}

export function useWaitlistMessagingConnect(params: UseWaitlistMessagingConnectParams) {
  const {
    xmtpStatus,
    xmtpError = null,
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
  const [needsFreshSignIn, setNeedsFreshSignIn] = useState(false)
  const connectInFlightRef = useRef(false)

  // `provider.tsx`'s shared `connect()` never rejects on a handled/terminal
  // failure — it just sets xmtp `status`/`error` internally and resolves.
  // `connectAndJoin` below is a long-lived callback (its deps deliberately
  // exclude xmtpStatus/xmtpError so in-flight work isn't torn down mid-connect
  // by a status flicker), so its closure alone would only ever see a stale
  // snapshot. Mirror the latest values into refs on every render instead, so
  // the post-`await connect('user')` check reads the true, current outcome.
  const latestStatusRef = useRef(xmtpStatus)
  latestStatusRef.current = xmtpStatus
  const latestErrorRef = useRef(xmtpError)
  latestErrorRef.current = xmtpError

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
      setNeedsFreshSignIn(false)

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

        const applyRepairDecision = (decision: ConnectRepairDecision): boolean => {
          if (decision.action === 'retry') {
            repairConsumed = true
            return true
          }
          if (decision.action === 'wait') {
            setPrepareError(decision.message)
            return false
          }
          if (decision.action === 'fresh-sign-in') {
            setNeedsFreshSignIn(true)
            setPrepareError(decision.message)
            return false
          }
          setPrepareError(decision.message)
          return false
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (!privyAuthenticated) {
            if (!repairConsumed && repairSession) {
              const outcome = await runRepairOutcome()
              if (applyRepairDecision(resolveConnectAfterRepair(outcome))) {
                continue
              }
              return
            }
            setPrepareError(
              'Your 4626 session is active, but Privy sign-in is not loaded in this browser. Sign in with email again, then retry.',
            )
            return
          }

          if (options?.reconnect || attempt > 0) {
            // Await full teardown (client close + OPFS access-handle
            // release) before reconnecting, so the retry doesn't race the
            // prior client's still-open OPFS handle and fail with
            // NoModificationAllowedError.
            await disconnect()
          }

          const prepared = await prepare()
          if (!prepared.ok) {
            const syncLag = prepared.error.toLowerCase().includes('wagmi is still syncing')
            if (syncLag && attempt === 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 1_500))
              continue
            }
            setPrepareError(prepared.error)
            return
          }

          try {
            await connect('user')

            if (latestStatusRef.current !== 'connected') {
              // `connect()` resolved without throwing, but never actually
              // reached 'connected' — a handled failure (e.g. the embedded
              // signer's auth token was rejected). `provider.tsx` already ran
              // its own single bounded repair-and-retry internally before
              // landing here, so don't invoke repairSession a second time
              // from this layer; just surface the error it already computed.
              await disconnect().catch(() => undefined)
              const raw = latestErrorRef.current ?? 'Failed to connect to XMTP for waitlist chat.'
              const { message, needsFreshSignIn: freshSignIn } = resolveConnectFailureDisplay(raw)
              setPrepareError(message)
              if (freshSignIn) setNeedsFreshSignIn(true)
              return
            }

            setMessagingEverConnected(true)

            if (!options?.skipJoinRetry && shouldRequestJoin) {
              retryJoin()
            }
            return
          } catch (connectError) {
            await disconnect().catch(() => undefined)

            const raw =
              connectError instanceof Error ? connectError.message : String(connectError)
            const authExpired = isPrivyEmbeddedSignerAuthError(raw)
            if (authExpired && !repairConsumed && repairSession) {
              const outcome = await runRepairOutcome()
              if (applyRepairDecision(resolveConnectAfterRepair(outcome))) {
                continue
              }
              return
            }
            throw connectError
          }
        }
      } catch (err) {
        await disconnect().catch(() => undefined)

        const raw = err instanceof Error ? err.message : String(err)
        const { message, needsFreshSignIn: freshSignIn } = resolveConnectFailureDisplay(raw)
        setPrepareError(message)
        if (freshSignIn) setNeedsFreshSignIn(true)
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
    needsFreshSignIn,
  }
}
