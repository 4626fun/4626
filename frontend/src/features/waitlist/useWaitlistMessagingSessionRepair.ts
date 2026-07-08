import { useCallback, useEffect, useRef } from 'react'
import { useActiveWallet, usePrivy, useWallets } from '@privy-io/react-auth'

import {
  attemptSessionRepair,
  type SessionRepairOutcome,
} from '@/lib/auth/sessionRepair'
import {
  extractPrivyWalletsFromUser,
  useEnsurePrivyEmbeddedWallet,
} from '@/lib/privy/embeddedWallet'
import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'

import { bridgePrivySession } from './waitlistHandoff'
import { readAuthSessionAddress } from './waitlistPrivySession'
import { findLiveEmbeddedPrivyWallet } from './prepareWaitlistMessagingWallet'

function isRecoveryRequiredBridgeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { recoveryRequired?: unknown; code?: unknown }
  if (record.recoveryRequired === true) return true
  const code = typeof record.code === 'string' ? record.code : ''
  return code.toUpperCase().includes('RECOVERY_REQUIRED')
}

/**
 * Bounded Privy + embedded-signer repair for waitlist XMTP connect.
 * Bridges Privy → 4626 cookie when needed, then re-hydrates the embedded wallet provider.
 */
export function useWaitlistMessagingSessionRepair(): () => Promise<SessionRepairOutcome> {
  const privy = usePrivy()
  const { wallets } = useWallets()
  const { setActiveWallet } = useActiveWallet()
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const liveCookieRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void readAuthSessionAddress().then((address) => {
      if (!cancelled) liveCookieRef.current = Boolean(address)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const getToken = useCallback(
    () => (typeof privy.getAccessToken === 'function' ? privy.getAccessToken() : Promise.resolve(null)).catch(() => null),
    [privy],
  )

  return useCallback(async (): Promise<SessionRepairOutcome> => {
    const outcome = await attemptSessionRepair({
      getToken,
      bridge: async (token) => {
        const result = await bridgePrivySession(token)
        if (result.ok) {
          liveCookieRef.current = true
          return true
        }
        return false
      },
      hasLiveCookie: () => liveCookieRef.current,
      isRecoveryRequiredError: isRecoveryRequiredBridgeError,
      onTransition: (event) => {
        console.info('[auth-repair]', { surface: 'waitlist-chat', ...event })
      },
    })

    if (outcome === 'recovery-required' || outcome === 'true-stale' || outcome === 'no-privy') {
      return outcome
    }

    try {
      const ensured = await ensureEmbeddedWallet()
      const mergedWallets = [...(wallets as unknown[]), ...extractPrivyWalletsFromUser(privy.user)]
      const embeddedWallet = findLiveEmbeddedPrivyWallet(mergedWallets, ensured.address)
      if (!embeddedWallet) {
        return outcome === 'repaired' ? 'transient' : outcome
      }
      await refreshPrivyEmbeddedSignerSession({
        wallet: embeddedWallet,
        setActiveWallet: (wallet) => setActiveWallet(wallet as Parameters<typeof setActiveWallet>[0]),
        getToken,
        logLabel: 'waitlist-messaging-repair',
      })
      return 'repaired'
    } catch (error) {
      console.warn('[waitlist-messaging-repair] embedded signer refresh failed:', error)
      return outcome === 'repaired' ? 'transient' : outcome
    }
  }, [ensureEmbeddedWallet, getToken, privy.user, setActiveWallet, wallets])
}
