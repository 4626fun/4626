import { useCallback, useState } from 'react'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { readPrivyAccessTokenWithRetries } from '@/features/waitlist/waitlistPrivyToken'

async function maybeCallMethod(target: unknown, methodNames: string[], args: unknown[] = []): Promise<boolean> {
  if (!target || typeof target !== 'object') return false
  const record = target as Record<string, unknown>
  for (const methodName of methodNames) {
    const method = record[methodName]
    if (typeof method === 'function') {
      await (method as (...params: unknown[]) => unknown).apply(target, args)
      return true
    }
  }
  return false
}

type SafePrivy = {
  authenticated?: boolean
  getAccessToken?: (() => Promise<string | null>) | null
}

export function useWaitlistTwitterLink(privy: SafePrivy, onSynced?: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncTwitterLink = useCallback(async () => {
    const readToken = privy.getAccessToken?.bind(privy) ?? null
    const token = await readPrivyAccessTokenWithRetries({ read: readToken })
    if (!token) throw new Error('Could not verify your session. Please try again.')

    const response = await apiFetch('/api/accounts/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Privy-Token': token,
      },
      body: JSON.stringify({ provider: 'twitter', value: null }),
    })
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Could not save Twitter to your 4626 account.')
    }
    onSynced?.()
  }, [onSynced, privy])

  const linkTwitter = useCallback(async () => {
    if (!privy.authenticated || busy) return
    setBusy(true)
    setError(null)
    try {
      const called = await maybeCallMethod(privy, ['linkTwitter', 'linkTwitterAccount'])
      if (!called) {
        throw new Error('Twitter linking is unavailable in this browser. Try again or use a private window.')
      }
      await syncTwitterLink()
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : 'Could not connect Twitter.')
    } finally {
      setBusy(false)
    }
  }, [busy, privy, syncTwitterLink])

  const unlinkTwitter = useCallback(
    async (linkedValue: string | null) => {
      if (!privy.authenticated || busy) return
      setBusy(true)
      setError(null)
      try {
        const called = await maybeCallMethod(
          privy,
          ['unlinkTwitter', 'unlinkTwitterAccount'],
          linkedValue ? [{ value: linkedValue }] : [],
        )
        if (!called) throw new Error('Twitter unlink is unavailable in this client.')

        const token = await readPrivyAccessTokenWithRetries({
          read: privy.getAccessToken?.bind(privy) ?? null,
        })
        if (!token) throw new Error('Could not verify your session. Please try again.')

        const response = await apiFetch('/api/accounts/unlink', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Privy-Token': token,
          },
          body: JSON.stringify({ provider: 'twitter', value: linkedValue }),
        })
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Could not disconnect Twitter.')
        }
        onSynced?.()
      } catch (unlinkError) {
        setError(unlinkError instanceof Error ? unlinkError.message : 'Could not disconnect Twitter.')
      } finally {
        setBusy(false)
      }
    },
    [busy, onSynced, privy],
  )

  return { busy, error, linkTwitter, unlinkTwitter, clearError: () => setError(null) }
}
