import { useCallback, useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

import {
  isTerminalWaitlistJoinStatus,
  mapJoinActionStatus,
  type WaitlistChatStatus,
  type WaitlistJoinActionStatus,
} from './waitlistChatCopy'
import { WAITLIST_JOIN_REQUEST_TIMEOUT_MS } from './waitlistGroupChatConstants'

export type { WaitlistChatStatus, WaitlistJoinActionStatus } from './waitlistChatCopy'
export {
  mapJoinActionStatus,
  waitlistChatBlockedMessage,
  waitlistChatStatusMessage,
} from './waitlistChatCopy'

function resolveJoinFailureStatus(reason: string): WaitlistChatStatus {
  if (reason === 'embedded_owner_not_installed' || reason === 'sub_account_not_registered') {
    return 'blocked'
  }
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
  return status === 'blocked' || status === 'config' || status === 'executed'
}

export function useWaitlistChatJoin(params: {
  xmtpMemberAddress: string | null | undefined
  chatReady: boolean
  enabled: boolean
  messagingReady: boolean
  serverJoinActionStatus?: WaitlistJoinActionStatus | null
}): { status: WaitlistChatStatus; retryJoin: () => void } {
  const { xmtpMemberAddress, chatReady, enabled, messagingReady, serverJoinActionStatus } = params
  const [status, setStatus] = useState<WaitlistChatStatus>('idle')
  const [joinRequestNonce, setJoinRequestNonce] = useState(0)
  const completedIdentityRef = useRef<string | null>(null)
  const joinRequestIdRef = useRef(0)
  const autoJoinScheduledRef = useRef<string | null>(null)
  const trackedIdentityRef = useRef<string | null>(null)

  const identity = xmtpMemberAddress?.toLowerCase() ?? null
  const serverMapped = mapJoinActionStatus(serverJoinActionStatus ?? null)

  const requestJoin = useCallback(() => {
    setJoinRequestNonce((value) => value + 1)
    setStatus((current) => (current === 'executed' ? current : 'joining'))
  }, [])

  const retryJoin = useCallback(() => {
    completedIdentityRef.current = null
    autoJoinScheduledRef.current = null
    requestJoin()
  }, [requestJoin])

  useEffect(() => {
    if (identity === trackedIdentityRef.current) return
    trackedIdentityRef.current = identity
    completedIdentityRef.current = null
    autoJoinScheduledRef.current = null
    setJoinRequestNonce(0)
    setStatus('idle')
  }, [identity])

  useEffect(() => {
    if (!enabled || !chatReady || !identity) {
      setStatus('idle')
      autoJoinScheduledRef.current = null
      return
    }

    if (serverMapped === 'executed' || serverMapped === 'failed') {
      setStatus(serverMapped)
      if (serverMapped === 'executed') {
        completedIdentityRef.current = identity
      }
      return
    }

    if (serverMapped === 'pending' || serverMapped === 'executing') {
      setStatus(serverMapped)
      return
    }

    if (completedIdentityRef.current === identity) {
      setStatus((current) =>
        current === 'awaiting_messaging' || current === 'idle' || current === 'joining' ? 'executed' : current,
      )
      return
    }

    if (!messagingReady) {
      setStatus((current) => (isTerminalWaitlistJoinStatus(current) ? current : 'awaiting_messaging'))
      return
    }

    if (autoJoinScheduledRef.current === identity) {
      return
    }

    autoJoinScheduledRef.current = identity
    requestJoin()
  }, [chatReady, enabled, identity, messagingReady, requestJoin, serverMapped])

  useEffect(() => {
    if (!enabled || !chatReady || !identity || !messagingReady || joinRequestNonce === 0) {
      return
    }

    if (serverMapped === 'executed' || serverMapped === 'failed') {
      return
    }
    if (serverMapped === 'pending' || serverMapped === 'executing') {
      return
    }
    if (completedIdentityRef.current === identity) {
      return
    }

    const requestId = ++joinRequestIdRef.current
    const controller = new AbortController()
    const timeoutId =
      typeof window !== 'undefined'
        ? window.setTimeout(() => controller.abort(), WAITLIST_JOIN_REQUEST_TIMEOUT_MS)
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

        const payload = (await response.json().catch(() => null)) as {
          data?: { execution?: 'executed' | 'deferred' | 'failed'; executionError?: string | null }
        } | null
        const execution = payload?.data?.execution ?? 'deferred'
        if (execution === 'executed') {
          setStatus('executed')
          completedIdentityRef.current = identity
          return
        }
        if (execution === 'failed') {
          setStatus('failed')
          return
        }
        setStatus('pending')
      } catch (err) {
        if (cancelled || requestId !== joinRequestIdRef.current) return
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
  }, [chatReady, enabled, identity, joinRequestNonce, messagingReady, serverMapped])

  return { status, retryJoin }
}
