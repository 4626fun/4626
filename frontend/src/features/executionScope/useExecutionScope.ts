import { useEffect, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

/**
 * Client-side hook over the extended `GET /api/arch-b/status` endpoint.
 * Powers the `/accounts` "Execution scopes" card (read-only surface for
 * the Arch B sub-account — address, spend caps, current-period usage,
 * and revocation state).
 *
 * Fetches on mount and on window focus. No polling intervals — matches
 * the 4626 product-frontend invariant.
 */

export type ExecutionScopeSpendPermission = {
  allowanceWei: string
  periodSeconds: number
  endAt: string
  revokedAt: string | null
  currentPeriod: {
    startUnix: number
    endUnix: number
    spendWei: string
    remainingWei: string
  } | null
}

export type ExecutionScopeData = {
  profileId: number
  delegated: boolean | null
  executionReady: 'ready' | 'revoked' | 'not_provisioned'
  caps: { perTxCapWei: string; dailyCapWei: string } | null
  revokedAt: string | null
  quorumId: string
  subAccount: {
    address: `0x${string}`
    parentCsw: `0x${string}`
    spendPermission: ExecutionScopeSpendPermission
  } | null
}

export type ExecutionScopeStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not_provisioned'
  | 'active'
  | 'revoked'
  | 'expired'
  | 'error'

export type UseExecutionScopeReturn = {
  status: ExecutionScopeStatus
  data: ExecutionScopeData | null
  error: string | null
  refresh: () => void
}

function deriveStatus(data: ExecutionScopeData | null): ExecutionScopeStatus {
  if (!data) return 'unauthenticated'
  if (!data.subAccount) {
    return data.executionReady === 'revoked' ? 'revoked' : 'not_provisioned'
  }
  const sp = data.subAccount.spendPermission
  if (sp.revokedAt) return 'revoked'
  const endMs = new Date(sp.endAt).getTime()
  if (Number.isFinite(endMs) && Date.now() >= endMs) return 'expired'
  return 'active'
}

export function useExecutionScope(): UseExecutionScopeReturn {
  const [data, setData] = useState<ExecutionScopeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshCounter, setRefreshCounter] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await apiFetch('/api/arch-b/status', { method: 'GET' })
        if (!res.ok) {
          if (cancelled) return
          setError(`status ${res.status}`)
          setLoading(false)
          return
        }
        const body = (await res.json()) as {
          success: boolean
          data: ExecutionScopeData | null
          error?: string
        }
        if (cancelled) return
        if (!body.success) {
          setError(body.error ?? 'unknown_error')
          setData(null)
        } else {
          setData(body.data ?? null)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refreshCounter])

  // Refresh on window focus so returning from Basescan / wallet / another
  // tab reflects any manual state changes.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setRefreshCounter((c) => c + 1)
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [])

  const status: ExecutionScopeStatus = loading ? 'loading' : error ? 'error' : deriveStatus(data)

  return {
    status,
    data,
    error,
    refresh: () => setRefreshCounter((c) => c + 1),
  }
}
