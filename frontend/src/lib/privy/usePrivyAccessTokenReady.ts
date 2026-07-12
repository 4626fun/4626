import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'

import { decodeJwtExpiryMs } from '@/lib/auth/sessionRepair'
import { readPrivyAccessTokenOrNull } from '@/lib/privy/accessToken'

const TOKEN_SKEW_MS = 30_000
const POLL_MS = 250

export function isLivePrivyAccessToken(token: string | null | undefined): boolean {
  const trimmed = String(token ?? '').trim()
  if (!trimmed) return false
  const expiresAtMs = decodeJwtExpiryMs(trimmed)
  return expiresAtMs === null || expiresAtMs > Date.now() + TOKEN_SKEW_MS
}

/**
 * Polls until Privy `getAccessToken()` returns a live bearer.
 * Used to delay SmartWalletsProvider mount past the OTP→iframe race.
 */
export function usePrivyAccessTokenReady(options?: { enabled?: boolean }): boolean {
  const enabled = options?.enabled !== false
  const { authenticated, getAccessToken } = usePrivy()
  const shouldPoll = enabled && authenticated
  const [tokenReady, setTokenReady] = useState(false)

  // Reset during render when polling is off — avoids sync setState in an effect.
  if (!shouldPoll && tokenReady) {
    setTokenReady(false)
  }

  useEffect(() => {
    if (!shouldPoll) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      const token = await readPrivyAccessTokenOrNull({
        read: typeof getAccessToken === 'function' ? () => getAccessToken().catch(() => null) : null,
        attempts: 1,
        retryDelayMs: 0,
      })
      if (cancelled) return
      if (isLivePrivyAccessToken(token)) {
        setTokenReady(true)
        return
      }
      setTokenReady(false)
      timer = setTimeout(() => {
        void poll()
      }, POLL_MS)
    }

    // Defer the first poll so setState never runs synchronously in the effect body.
    timer = setTimeout(() => {
      void poll()
    }, 0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [getAccessToken, shouldPoll])

  return shouldPoll && tokenReady
}
