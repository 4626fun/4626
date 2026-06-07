import { useCallback, useEffect, useState } from 'react'
import { isAddress } from 'viem'

/**
 * Manages the list of recently used token addresses for the swap token selector.
 * Persists to localStorage under 'swap.recentTokens' (max 12, deduped, lowercase).
 * Load is best-effort and runs once on mount.
 */
export function useSwapRecentTokens() {
  const [recentTokenAddresses, setRecentTokenAddresses] = useState<string[]>([])

  // Load recent tokens from localStorage on mount (client only).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('swap.recentTokens')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const normalized = parsed
        .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
        .filter((value) => isAddress(value))
        .slice(0, 10)
      setRecentTokenAddresses(Array.from(new Set(normalized)))
    } catch {
      // Ignore storage / parse errors; recent list just starts empty.
    }
  }, [])

  const persistRecentToken = useCallback((tokenAddress: string) => {
    const normalized = tokenAddress.toLowerCase()
    if (!isAddress(normalized)) return

    setRecentTokenAddresses((previous) => {
      const next = [normalized, ...previous.filter((candidate) => candidate !== normalized)].slice(0, 12)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('swap.recentTokens', JSON.stringify(next))
        } catch {
          // Storage may be unavailable (private mode, quota, etc.). State update still happened.
        }
      }
      return next
    })
  }, [])

  return { recentTokenAddresses, persistRecentToken }
}
