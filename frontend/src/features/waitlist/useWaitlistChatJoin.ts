import { useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

import type { WaitlistChatExecutionTrack } from './useWaitlistXmtpStatus'

export type WaitlistChatStatus =
  | 'idle'
  | 'awaiting_messaging'
  | 'joining'
  | 'pending'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'config'
  | 'error'

const JOIN_REQUEST_TIMEOUT_MS = 30_000
const JOIN_STATUS_POLL_MS = 3_000

type WaitlistJoinActionStatus = 'pending' | 'executing' | 'executed' | 'failed' | 'retry' | null

type WaitlistXmtpStatusPayload = {
  joinAction?: {
    status: WaitlistJoinActionStatus
    lastError?: string | null
  } | null
}

function mapJoinActionStatus(status: WaitlistJoinActionStatus): WaitlistChatStatus | null {
  switch (status) {
    case 'pending':
    case 'retry':
      return 'pending'
    case 'executing':
      return 'executing'
    case 'executed':
      return 'executed'
    case 'failed':
      return 'failed'
    default:
      return null
  }
}

export function waitlistChatBlockedMessage(params: {
  executionTrack?: WaitlistChatExecutionTrack | null
  joinBlockedReason?: string | null
}): string {
  if (params.joinBlockedReason === 'sub_account_not_registered') {
    return 'Connect Base App and finish app-wallet setup to join waitlist chat.'
  }
  if (params.executionTrack === 'sub-account') {
    return 'Connect messaging with your 4626 app wallet to join waitlist chat.'
  }
  return 'Enable 4626 signing to join waitlist chat.'
}

export function waitlistChatStatusMessage(status: WaitlistChatStatus): string {
  switch (status) {
    case 'awaiting_messaging':
      return 'Connect messaging first so your waitlist inbox exists, then we can add you to the group.'
    case 'joining':
      return 'Adding your wallet to waitlist chat…'
    case 'pending':
      return 'Adding you to the waitlist group…'
    case 'executing':
      return 'Finalizing your waitlist group membership…'
    case 'executed':
      return 'You were added. Syncing the group into this browser…'
    case 'failed':
      return 'Could not add you to waitlist chat yet. Refresh and try Connect messaging again.'
    case 'blocked':
      return 'Finish wallet setup to join waitlist chat.'
    case 'config':
      return 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
    case 'error':
      return 'Chat join is temporarily unavailable. Refresh the page to retry.'
    default:
      return 'Waiting to join waitlist chat.'
  }
}

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
  return status === 'blocked' || status === 'config' || status === 'executed' || status === 'failed'
}

export function useWaitlistChatJoin(params: {
  xmtpMemberAddress: string | null | undefined
  chatReady: boolean
  enabled: boolean
  messagingReady: boolean
}): WaitlistChatStatus {
  const { xmtpMemberAddress, chatReady, enabled, messagingReady } = params
  const [status, setStatus] = useState<WaitlistChatStatus>('idle')
  const completedIdentityRef = useRef<string | null>(null)
  const joinRequestIdRef = useRef(0)

  useEffect(() => {
    const identity = xmtpMemberAddress?.toLowerCase() ?? null
    if (!enabled || !chatReady || !identity) {
      setStatus('idle')
      return
    }
    if (!messagingReady) {
      setStatus((current) =>
        completedIdentityRef.current === identity && (current === 'executed' || current === 'failed')
          ? current
          : 'awaiting_messaging',
      )
      return
    }
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
          completedIdentityRef.current = identity
          return
        }
        setStatus('pending')
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
  }, [chatReady, enabled, messagingReady, xmtpMemberAddress])

  useEffect(() => {
    if (!enabled || !chatReady || !messagingReady) return
    if (status !== 'pending' && status !== 'executing' && status !== 'joining') return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await apiFetch('/api/waitlist/xmtp-status')
        if (!response.ok || cancelled) return
        const payload = (await response.json()) as { data?: WaitlistXmtpStatusPayload }
        const next = mapJoinActionStatus(payload.data?.joinAction?.status ?? null)
        if (!next || cancelled) return
        setStatus(next)
        const identity = xmtpMemberAddress?.toLowerCase() ?? null
        if (identity && shouldPersistJoinOutcome(next)) {
          completedIdentityRef.current = identity
        }
      } catch {
        // keep polling
      }
    }

    void poll()
    const intervalId = window.setInterval(() => {
      void poll()
    }, JOIN_STATUS_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [chatReady, enabled, messagingReady, status, xmtpMemberAddress])

  return status
}
