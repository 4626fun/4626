import { useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'

export type WaitlistChatStatus = 'idle' | 'joining' | 'queued' | 'blocked' | 'config' | 'error'

export function waitlistChatStatusMessage(status: WaitlistChatStatus): string {
  switch (status) {
    case 'joining':
      return 'Queueing your Zora CSW identity for the XMTP waitlist group...'
    case 'queued':
      return 'Queued. Your Zora CSW will be added to the waitlist group shortly.'
    case 'blocked':
      return 'Enable 4626 signing to join waitlist chat.'
    case 'config':
      return 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
    case 'error':
      return 'Chat join is temporarily unavailable. It will retry when this page refreshes.'
    default:
      return 'Waiting to join waitlist chat.'
  }
}

export function useWaitlistChatJoin(params: {
  canonicalCswAddress: string | null | undefined
  enabled: boolean
}): WaitlistChatStatus {
  const { canonicalCswAddress, enabled } = params
  const [status, setStatus] = useState<WaitlistChatStatus>('idle')
  const completedIdentityRef = useRef<string | null>(null)
  const inFlightIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    const identity = canonicalCswAddress?.toLowerCase() ?? null
    if (!enabled || !identity) return
    if (completedIdentityRef.current === identity) return
    if (inFlightIdentityRef.current === identity) return

    inFlightIdentityRef.current = identity
    let cancelled = false

    void (async () => {
      if (!cancelled) setStatus('joining')
      try {
        const response = await apiFetch('/api/waitlist/xmtp-join', { method: 'POST' })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          const reason = String(payload?.error ?? '')
          if (reason === 'embedded_owner_not_installed') {
            if (!cancelled) setStatus('blocked')
            completedIdentityRef.current = identity
            return
          }
          if (reason === 'waitlist_chat_not_configured' || reason === 'waitlist_chat_vault_not_configured') {
            if (!cancelled) setStatus('config')
            completedIdentityRef.current = identity
            return
          }
          if (!cancelled) setStatus('error')
          return
        }
        if (!cancelled) setStatus('queued')
        completedIdentityRef.current = identity
      } catch {
        if (!cancelled) setStatus('error')
      } finally {
        if (inFlightIdentityRef.current === identity) inFlightIdentityRef.current = null
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress, enabled])

  return status
}
