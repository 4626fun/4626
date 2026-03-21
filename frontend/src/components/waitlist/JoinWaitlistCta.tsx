import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { ArrowRight, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { getAppBaseUrl } from '@/lib/host'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'

import { buildWaitlistEmailLoginOptions } from './waitlistLoginOptions'

type JoinWaitlistCtaProps = {
  className?: string
  onPrivyDisabled?: () => void
  children?: ReactNode
  showArrow?: boolean
  busyContent?: ReactNode
  ariaLabel?: string
}

type WaitlistCtaAccountSummary = {
  emailVerified: boolean
  accountSignals: {
    canonicalCswAddress: string | null
  }
}

type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & WaitlistCtaAccountSummary)

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export type WaitlistEntryCtaState = 'join' | 'continue_setup' | 'open_app'

export function deriveWaitlistEntryCtaState(params: {
  authenticated: boolean
  account: WaitlistCtaAccountSummary | null
}): WaitlistEntryCtaState {
  if (!params.authenticated || !params.account?.emailVerified) return 'join'
  if (params.account.accountSignals.canonicalCswAddress) return 'open_app'
  return 'continue_setup'
}

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      getAccessToken: async () => null,
    } as any
  }
}

function useSafeLogin() {
  try {
    return useLogin({}) as any
  } catch {
    return {
      login: async () => {},
    } as any
  }
}

function JoinWaitlistCtaInner(props: JoinWaitlistCtaProps) {
  const { className, onPrivyDisabled, children, showArrow = true, busyContent, ariaLabel } = props
  const { login } = useSafeLogin()
  const privy = useSafePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const [busy, setBusy] = useState(false)
  const [loadingState, setLoadingState] = useState(false)
  const [account, setAccount] = useState<WaitlistCtaAccountSummary | null>(null)

  const privyAuthed = Boolean(privy?.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy?.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy],
  )

  const loadAccount = useCallback(async () => {
    if (!privyAuthed) {
      setAccount(null)
      setLoadingState(false)
      return
    }
    setLoadingState(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setAccount(null)
        return
      }
      await runCanonicalizationPipeline({ privyToken: token }).catch(() => null)
      const response = await apiFetch('/api/waitlist/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        },
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null
      if (!response.ok || !payload?.success || !payload.data || payload.data.requiresPrivyAuth) {
        setAccount(null)
        return
      }
      setAccount(payload.data)
    } catch {
      setAccount(null)
    } finally {
      setLoadingState(false)
    }
  }, [getAccessToken, privyAuthed])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  useEffect(() => {
    if (!privyAuthed || typeof window === 'undefined' || typeof document === 'undefined') return
    const refresh = () => {
      void loadAccount()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadAccount, privyAuthed])

  const ctaState = deriveWaitlistEntryCtaState({
    authenticated: privyAuthed,
    account,
  })

  const onClick = useCallback(async () => {
    if (busy || loadingState) return
    if (ctaState === 'join') {
      if (privyClientStatus === 'disabled') {
        onPrivyDisabled?.()
        return
      }
      setBusy(true)
      try {
        await login(buildWaitlistEmailLoginOptions() as any)
      } finally {
        setBusy(false)
      }
      return
    }

    if (typeof window === 'undefined') return

    if (ctaState === 'continue_setup') {
      window.location.assign('/#waitlist')
      return
    }

    window.location.assign(buildAppEntryUrl(getAppBaseUrl()))
  }, [busy, ctaState, loadingState, login, onPrivyDisabled, privyClientStatus])

  const idleContent = (() => {
    if (ctaState === 'continue_setup') {
      return (
        <>
          Continue setup
          {showArrow ? <ArrowRight className="w-4 h-4" /> : null}
        </>
      )
    }
    if (ctaState === 'open_app') {
      return (
        <>
          Open app
          {showArrow ? <ArrowRight className="w-4 h-4" /> : null}
        </>
      )
    }
    return (
      children ?? (
        <>
          Join waitlist
          {showArrow ? <ArrowRight className="w-4 h-4" /> : null}
        </>
      )
    )
  })()

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy || loadingState}
      className={className}
      aria-label={ariaLabel}
    >
      {busy ? (
        busyContent ?? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Opening email sign-in…
          </>
        )
      ) : loadingState ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking account…
        </>
      ) : (
        idleContent
      )}
    </button>
  )
}

export function JoinWaitlistCta(props: JoinWaitlistCtaProps) {
  return <JoinWaitlistCtaInner {...props} />
}

export function JoinWaitlistCtaWithProvider(props: JoinWaitlistCtaProps) {
  return (
    <PrivyClientProvider showWalletLoginFirst={false}>
      <JoinWaitlistCtaInner {...props} />
    </PrivyClientProvider>
  )
}
