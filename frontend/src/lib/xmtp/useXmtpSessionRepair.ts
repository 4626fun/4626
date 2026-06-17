import { useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { attemptSessionRepair } from '@/lib/auth/sessionRepair'

function isRecoveryRequiredBridgeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { recoveryRequired?: unknown; code?: unknown }
  if (record.recoveryRequired === true) return true
  const code = typeof record.code === 'string' ? record.code : ''
  return code.toUpperCase().includes('RECOVERY_REQUIRED')
}

/**
 * Bounded chat session-repair callback for `XmtpChatProvider`.
 *
 * Wraps the shared `attemptSessionRepair` primitive with Privy's
 * `getAccessToken`, the SIWE Privy→4626 bridge, and the live-cookie signal so
 * the chat connect path can self-heal a transient embedded-signer token miss
 * exactly once before surfacing "expired".
 *
 * MUST only be used inside a tree that has PrivyProvider (and the SIWE/wagmi
 * context useSiweAuth depends on) — i.e. the app interactive layout, not
 * marketing shells.
 */
export function useXmtpSessionRepair(): () => Promise<boolean> {
  const { getAccessToken } = usePrivy()
  const { signInWithPrivyToken, hasSession } = useSiweAuth()

  return useCallback(async (): Promise<boolean> => {
    const outcome = await attemptSessionRepair({
      getToken: () => getAccessToken().catch(() => null),
      bridge: async (token) => Boolean(await signInWithPrivyToken(token, { background: true })),
      hasLiveCookie: () => hasSession,
      isRecoveryRequiredError: isRecoveryRequiredBridgeError,
      onTransition: (event) => {
        console.info('[auth-repair]', { surface: 'chat', ...event })
      },
    })
    return outcome === 'repaired'
  }, [getAccessToken, signInWithPrivyToken, hasSession])
}
