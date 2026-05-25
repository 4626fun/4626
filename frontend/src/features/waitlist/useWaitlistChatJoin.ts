import { useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

export type WaitlistChatStatus = 'idle' | 'joining' | 'queued' | 'blocked' | 'config' | 'error'

const JOIN_REQUEST_TIMEOUT_MS = 30_000

export function waitlistChatStatusMessage(status: WaitlistChatStatus): string {
  switch (status) {
    case 'joining':
      return 'Adding your wallet to waitlist chat...'
    case 'queued':
      return 'Queued for waitlist chat. You should appear in the group shortly.'
    case 'blocked':
      return 'Enable 4626 signing to join waitlist chat.'
    case 'config':
      return 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
    case 'error':
      return 'Chat join is temporarily unavailable. Refresh the page to retry.'
    default:
      return 'Waiting to join waitlist chat.'
  }
}

function resolveJoinFailureStatus(reason: string): WaitlistChatStatus {
  if (reason === 'embedded_owner_not_installed') return 'blocked'
  if (reason === 'waitlist_chat_not_configured' || reason === 'waitlist_chat_vault_not_configured') {
    return 'config'
  }
  if (
    reason === 'canonical_csw_missing' ||
    reason === 'embedded_eoa_missing' ||
    reason === 'Authentication required'
  ) {
    return 'blocked'
  }
  return 'error'
}

function shouldPersistJoinOutcome(status: WaitlistChatStatus): boolean {
  return status === 'blocked' || status === 'config' || status === 'queued'
}

export function useWaitlistChatJoin(params: {
  canonicalCswAddress: string | null | undefined
  enabled: boolean
}): WaitlistChatStatus {
  const { canonicalCswAddress, enabled } = params
  const [status, setStatus] = useState<WaitlistChatStatus>('idle')
  const completedIdentityRef = useRef<string | null>(null)
  const joinRequestIdRef = useRef(0)

  useEffect(() => {
    const identity = canonicalCswAddress?.toLowerCase() ?? null
    if (!enabled || !identity) return
    if (completedIdentityRef.current === identity) return

    const requestId = ++joinRequestIdRef.current
    const controller = new AbortController()
    const timeoutId =
      typeof window !== 'undefined'
        ? window.setTimeout(() => controller.abort(), JOIN_REQUEST_TIMEOUT_MS)
        : null
    let cancelled = false

    void (async () => {
      setStatus('joining')
      try {
        const response = await apiFetch('/api/waitlist/xmtp-join', {
          method: 'POST',
          signal: controller.signal,
        })
        if (cancelled || requestId !== joinRequestIdRef.current) return

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          const reason = String(payload?.error ?? '')
          const nextStatus = resolveJoinFailureStatus(reason)
          setStatus(nextStatus)
          if (shouldPersistJoinOutcome(nextStatus)) {
            completedIdentityRef.current = identity
          }
          return
        }

        setStatus('queued')
        completedIdentityRef.current = identity
      } catch (err) {
        if (cancelled || requestId !== joinRequestIdRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('error')
          return
        }
        setStatus('error')
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [canonicalCswAddress, enabled])

  return status
}
