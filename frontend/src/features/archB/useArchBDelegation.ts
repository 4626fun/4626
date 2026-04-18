/**
 * Architecture B Phase 2 — client-side delegation hook.
 *
 * Drives the user through the consent + provisioning flow:
 *   1. Privy `delegateWallet()` — user-facing consent modal (Option 1 from design doc §Decision)
 *   2. POST /api/arch-b/enroll  — backend verifies delegation and provisions execution context
 *
 * Revocation is the mirror path:
 *   1. POST /api/arch-b/revoke  — backend soft-revokes the execution context row first
 *   2. Privy `revokeWallets()` — removes the backend quorum from the wallet's signer set
 *
 * Order matters for revocation: context is revoked before Privy delegation so that
 * even if the Privy call fails, the backend stops routing Arch-B send commands.
 *
 * Status is fetched on mount, after enable()/disable(), and on window focus.
 * No polling intervals (per 4626-product-frontend invariant).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useDelegatedActions, usePrivy, useWallets } from '@privy-io/react-auth'

import { apiFetch } from '@/lib/api/apiBase'

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Maps one-to-one with backend `GET /api/arch-b/status` outcomes plus
 * client-side transient states.
 *
 * - `loading`        initial fetch or refetch in progress
 * - `unlinked`       no authenticated session / no profile
 * - `not_delegated`  authenticated but not yet provisioned (includes post-revoke)
 * - `delegating`     `delegateWallet()` call in flight (waiting for Privy modal)
 * - `delegated`      delegation confirmed on Privy, `enroll` POST in flight
 * - `provisioned`    execution context row written; backend can sign UserOps
 * - `revoked`        previously provisioned; user or admin revoked
 * - `error`          non-retryable error surfaced from Privy or backend
 */
export type ArchBDelegationStatus =
  | 'loading'
  | 'unlinked'
  | 'not_delegated'
  | 'delegating'
  | 'delegated'
  | 'provisioned'
  | 'revoked'
  | 'error'

export type ArchBDelegationCaps = {
  /** Wei, as string to preserve precision. */
  perTxCapWei: string
  dailyCapWei: string
}

export type ArchBDelegationError = {
  /** Machine-readable code from backend or Privy. */
  code: string
  message: string
}

/**
 * Result shape returned by enable()/disable(). Callers should inspect
 * `ok` before claiming success to the user — the hook never throws for
 * backend/network failures; it surfaces them via state and this result.
 */
export type ArchBActionResult =
  | { ok: true }
  | { ok: false; error: ArchBDelegationError }

export type UseArchBDelegationReturn = {
  status: ArchBDelegationStatus
  caps: ArchBDelegationCaps | null
  error: ArchBDelegationError | null
  /** Trigger delegation consent + backend enroll. No-op if not ready. */
  enable: () => Promise<ArchBActionResult>
  /** Backend revoke + Privy wallet revoke. No-op if not provisioned. */
  disable: () => Promise<ArchBActionResult>
  /** Manually refresh status (e.g. after returning from external browser). */
  refresh: () => void
}

// ── Internal state machine ─────────────────────────────────────────────────────

type State = {
  status: ArchBDelegationStatus
  caps: ArchBDelegationCaps | null
  error: ArchBDelegationError | null
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_DONE'; status: ArchBDelegationStatus; caps: ArchBDelegationCaps | null }
  | { type: 'FETCH_ERROR'; error: ArchBDelegationError }
  | { type: 'ENABLE_START' }
  | { type: 'DELEGATING' }
  | { type: 'DELEGATED' }
  | { type: 'DISABLE_START' }
  | { type: 'ERROR'; error: ArchBDelegationError }

const INITIAL_STATE: State = {
  status: 'loading',
  caps: null,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading', error: null }
    case 'FETCH_DONE':
      return { ...state, status: action.status, caps: action.caps, error: null }
    case 'FETCH_ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'ENABLE_START':
    case 'DELEGATING':
      return { ...state, status: 'delegating', error: null }
    case 'DELEGATED':
      return { ...state, status: 'delegated', error: null }
    case 'DISABLE_START':
      return { ...state, status: 'loading', error: null }
    case 'ERROR':
      return { ...state, status: 'error', error: action.error }
    default:
      return state
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function backendStatusToHookStatus(
  backendStatus: string,
  delegated: boolean | null,
): ArchBDelegationStatus {
  if (backendStatus === 'ready') return 'provisioned'
  if (backendStatus === 'revoked') return 'revoked'
  // not_provisioned — check whether delegation is at least present
  if (delegated === false) return 'not_delegated'
  // delegated but not provisioned (enroll incomplete), or delegated unknown
  return 'not_delegated'
}

function toArchBError(code: string, fallbackMessage?: string): ArchBDelegationError {
  return {
    code,
    message: fallbackMessage ?? code,
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useArchBDelegation(): UseArchBDelegationReturn {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { delegateWallet, revokeWallets } = useDelegatedActions()

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  // Stable ref to avoid stale-closure issues in callbacks — updated in effect,
  // not during render, to avoid react-hooks/refs lint warnings.
  const readyRef = useRef(ready)
  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  // ── Resolve owner EOA from embedded Privy wallet ──────────────────────────

  const ownerEoa = useMemo<string | null>(() => {
    if (!wallets || wallets.length === 0) return null
    // Filter for the user-scoped embedded Privy wallet (not cross-app wallets)
    const embedded = wallets.find((w) => {
      const clientType =
        typeof (w as { walletClientType?: unknown }).walletClientType === 'string'
          ? ((w as { walletClientType: string }).walletClientType as string).toLowerCase()
          : ''
      return (
        clientType === 'privy' ||
        clientType.includes('embedded') ||
        clientType.includes('privy')
      )
    })
    const addr =
      embedded && typeof (embedded as { address?: unknown }).address === 'string'
        ? ((embedded as { address: string }).address as string)
        : null
    return addr && addr.trim() ? addr.trim() : null
  }, [wallets])

  // ── Status fetch ──────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    // Unauthenticated — skip the network call
    if (!authenticated) {
      dispatch({ type: 'FETCH_DONE', status: 'unlinked', caps: null })
      return
    }

    dispatch({ type: 'FETCH_START' })
    try {
      const res = await apiFetch('/api/arch-b/status', { method: 'GET' })

      if (res.status === 503) {
        dispatch({
          type: 'FETCH_ERROR',
          error: toArchBError('db_unavailable', 'Service is temporarily unavailable.'),
        })
        return
      }

      if (!res.ok) {
        dispatch({
          type: 'FETCH_ERROR',
          error: toArchBError('status_fetch_failed', `Status check failed (${res.status}).`),
        })
        return
      }

      const json = await res.json() as {
        success: boolean
        data: {
          executionReady: string
          delegated: boolean | null
          caps: { perTxCapWei: string; dailyCapWei: string } | null
        } | null
      }

      if (!json.success || !json.data) {
        // Unauthenticated response from backend
        dispatch({ type: 'FETCH_DONE', status: 'unlinked', caps: null })
        return
      }

      const { executionReady, delegated, caps } = json.data
      const hookStatus = backendStatusToHookStatus(executionReady, delegated)
      dispatch({ type: 'FETCH_DONE', status: hookStatus, caps: caps ?? null })
    } catch {
      dispatch({
        type: 'FETCH_ERROR',
        error: toArchBError('network_error', 'Could not reach the server.'),
      })
    }
  }, [authenticated])

  // ── enable() ──────────────────────────────────────────────────────────────

  const enable = useCallback(async (): Promise<ArchBActionResult> => {
    if (!readyRef.current) return { ok: false, error: toArchBError('not_ready', 'Privy not ready.') }
    if (!authenticated) return { ok: false, error: toArchBError('unauthenticated', 'Not signed in.') }

    dispatch({ type: 'ENABLE_START' })

    // Step 1: Privy delegateWallet consent modal
    const address = ownerEoa
    if (!address) {
      const error = toArchBError('no_embedded_wallet', 'No embedded wallet found.')
      dispatch({ type: 'ERROR', error })
      return { ok: false, error }
    }

    try {
      await delegateWallet({ address: address as `0x${string}`, chainType: 'ethereum' })
      dispatch({ type: 'DELEGATED' })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Delegation declined or unavailable.'
      const error = toArchBError('delegation_declined', message)
      dispatch({ type: 'ERROR', error })
      return { ok: false, error }
    }

    // Step 2: POST /api/arch-b/enroll
    try {
      const res = await apiFetch('/api/arch-b/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })

      if (res.status === 409) {
        // delegation_not_configured — delegation present but quorum mismatch
        const error = toArchBError(
          'delegation_not_found',
          'Delegation was not recognized. Please try again or contact support.',
        )
        dispatch({ type: 'ERROR', error })
        return { ok: false, error }
      }

      if (res.status === 400) {
        const body = await res.json().catch(() => ({ error: 'enroll_failed' })) as { error?: string }
        const error = toArchBError(body.error ?? 'enroll_failed', 'Enrollment failed. Please try again.')
        dispatch({ type: 'ERROR', error })
        return { ok: false, error }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'enroll_failed' })) as { error?: string }
        const error = toArchBError(body.error ?? 'enroll_failed', 'Enrollment request failed.')
        dispatch({ type: 'ERROR', error })
        return { ok: false, error }
      }

      // Success — refetch canonical status
      await fetchStatus()
      return { ok: true }
    } catch {
      const error = toArchBError('network_error', 'Could not reach the server during enrollment.')
      dispatch({ type: 'ERROR', error })
      return { ok: false, error }
    }
  }, [authenticated, ownerEoa, delegateWallet, fetchStatus])

  // ── disable() ─────────────────────────────────────────────────────────────

  const disable = useCallback(async (): Promise<ArchBActionResult> => {
    if (!readyRef.current) return { ok: false, error: toArchBError('not_ready', 'Privy not ready.') }
    if (!authenticated) return { ok: false, error: toArchBError('unauthenticated', 'Not signed in.') }

    dispatch({ type: 'DISABLE_START' })

    // Step 1: revoke backend execution context first (hard-fail guard)
    try {
      const res = await apiFetch('/api/arch-b/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'revoke_failed' })) as { error?: string }
        const error = toArchBError(body.error ?? 'revoke_failed', 'Revoke request failed.')
        dispatch({ type: 'ERROR', error })
        return { ok: false, error }
      }
    } catch {
      const error = toArchBError('network_error', 'Could not reach the server during revoke.')
      dispatch({ type: 'ERROR', error })
      return { ok: false, error }
    }

    // Step 2: revoke Privy delegation (best-effort — context is already revoked)
    try {
      await revokeWallets()
    } catch {
      // Non-fatal: context is already revoked server-side; log and continue
    }

    await fetchStatus()
    return { ok: true }
  }, [authenticated, revokeWallets, fetchStatus])

  // ── Effects ───────────────────────────────────────────────────────────────

  // Fetch on mount and when auth changes
  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // Fetch on window focus (no polling intervals)
  useEffect(() => {
    function handleFocus() {
      void fetchStatus()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchStatus])

  return {
    status: state.status,
    caps: state.caps,
    error: state.error,
    enable,
    disable,
    refresh: () => void fetchStatus(),
  }
}
