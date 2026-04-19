import { useCallback, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

/**
 * Client-side hook that drives `POST /api/arch-b/sub-account/revoke`.
 *
 * One-shot action: calls the endpoint, surfaces loading + error state,
 * returns a typed result so the card can both display success feedback
 * and refresh the execution scope afterwards.
 *
 * DB-only in v1. See `docs/design/sub-account-lifecycle-spec.md` for
 * why on-chain revoke is deferred to v1.1.
 */

export type RevokeSubAccountResult =
  | {
      ok: true
      profileId: number
      revokedAt: string
      alreadyRevoked: boolean
    }
  | {
      ok: false
      code: string
      message: string
    }

export type UseRevokeSubAccountReturn = {
  /** True while the revoke request is in flight. */
  busy: boolean
  /** Last error shown to the user; cleared on the next `revoke()` call. */
  error: string | null
  /** Last successful revoke, persisted until the next call. */
  lastResult: RevokeSubAccountResult | null
  /** Trigger the revoke. `reason` is optional and capped to 256 chars server-side. */
  revoke: (reason?: string) => Promise<RevokeSubAccountResult>
}

export function useRevokeSubAccount(): UseRevokeSubAccountReturn {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<RevokeSubAccountResult | null>(null)

  const revoke = useCallback(async (reason?: string): Promise<RevokeSubAccountResult> => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/arch-b/sub-account/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      })
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean
        data?: { profileId: number; revokedAt: string; alreadyRevoked: boolean }
        error?: string
      }
      if (!res.ok || !body.success || !body.data) {
        const code = body.error ?? `status_${res.status}`
        const message = humanizeRevokeError(code)
        setError(message)
        const failure: RevokeSubAccountResult = { ok: false, code, message }
        setLastResult(failure)
        return failure
      }
      const success: RevokeSubAccountResult = {
        ok: true,
        profileId: body.data.profileId,
        revokedAt: body.data.revokedAt,
        alreadyRevoked: body.data.alreadyRevoked,
      }
      setLastResult(success)
      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      const failure: RevokeSubAccountResult = { ok: false, code: 'network_error', message }
      setLastResult(failure)
      return failure
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, lastResult, revoke }
}

function humanizeRevokeError(code: string): string {
  switch (code) {
    case 'not_provisioned':
      return 'No sub-account is currently provisioned for your account.'
    case 'context_row_missing':
      return "We couldn't find your execution context. Try refreshing the page."
    case 'db_unavailable':
      return 'Database is temporarily unavailable. Please try again in a minute.'
    case 'db_write_failed':
      return "Something went wrong writing the revoke record. Please retry; if it persists, contact support."
    case 'Too many requests':
      return "You're clicking a little too fast. Give it a few seconds and retry."
    default:
      return `Revoke failed (${code}). Please retry or contact support if it persists.`
  }
}
