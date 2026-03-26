import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { ArrowRight, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import { buildAppEntryUrl } from '@/lib/auth/appEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/host'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'

import { buildWaitlistEmailLoginOptions } from './waitlistLoginOptions'
import { isRecoveryRequiredAuthError } from './waitlistAuthState'

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
  appAccessStatus: string | null
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
type WaitlistBootstrapErrorEnvelope = ApiEnvelope<WaitlistBootstrapResponse> & {
  code?: string
  recoveryRequired?: boolean
}

export type WaitlistEntryCtaState = 'join' | 'continue_setup' | 'open_app'
export type WaitlistEntryPrivyClientStatus = 'disabled' | 'loading' | 'ready'

export function deriveWaitlistEntryCtaState(params: {
  authenticated: boolean
  account: WaitlistCtaAccountSummary | null
  ownerDelegationReady: boolean
}): WaitlistEntryCtaState {
  if (!params.authenticated || !params.account?.emailVerified) return 'join'
  const appAccessStatus = String(params.account.appAccessStatus ?? '').trim().toLowerCase()
  if (appAccessStatus === 'approved' && params.account.accountSignals.canonicalCswAddress && params.ownerDelegationReady) {
    return 'open_app'
  }
  return 'continue_setup'
}

export function shouldFallbackJoinWaitlistEntry(params: {
  ctaState: WaitlistEntryCtaState
  privyClientStatus: WaitlistEntryPrivyClientStatus
}): boolean {
  return params.ctaState === 'join' && params.privyClientStatus !== 'ready'
}

export function shouldEscalateBootstrapErrorToWaitlist(params: {
  status: number
  payload: WaitlistBootstrapErrorEnvelope | null
}): boolean {
  const { status, payload } = params
  const code = typeof payload?.code === 'string' ? payload.code : undefined
  const message = typeof payload?.error === 'string' ? payload.error : undefined
  return isRecoveryRequiredAuthError({
    status,
    code,
    message,
    recoveryRequired: payload?.recoveryRequired === true,
  })
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
  const [ownerDelegationReady, setOwnerDelegationReady] = useState(false)
  const routeToWaitlist = useCallback(() => {
    if (typeof onPrivyDisabled === 'function') {
      onPrivyDisabled()
      return
    }
    if (typeof window === 'undefined') return
    const target = getMarketingWaitlistEntryUrl()
    const current = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
    if (target === current) return
    window.location.assign(target)
  }, [onPrivyDisabled])

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
      setOwnerDelegationReady(false)
      setLoadingState(false)
      return
    }
    setLoadingState(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setAccount(null)
        setOwnerDelegationReady(false)
        return
      }
      const canonicalization = await runCanonicalizationPipeline({ privyToken: token }).catch(() => null)
      setOwnerDelegationReady(Boolean(canonicalization?.onboardingBootstrapped && canonicalization.onboarding?.privyIsOwner))
      const response = await apiFetch('/api/waitlist/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        },
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as WaitlistBootstrapErrorEnvelope | null
      if (!response.ok || !payload?.success || !payload.data || payload.data.requiresPrivyAuth) {
        setAccount(null)
        if (
          !response.ok &&
          shouldEscalateBootstrapErrorToWaitlist({
            status: response.status,
            payload,
          })
        ) {
          routeToWaitlist()
        }
        return
      }
      setAccount(payload.data)
    } catch {
      setAccount(null)
      setOwnerDelegationReady(false)
    } finally {
      setLoadingState(false)
    }
  }, [getAccessToken, privyAuthed, routeToWaitlist])

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
    ownerDelegationReady,
  })

  const onClick = useCallback(async () => {
    if (busy || loadingState) return
    if (ctaState === 'join') {
      if (
        shouldFallbackJoinWaitlistEntry({
          ctaState,
          privyClientStatus,
        })
      ) {
        routeToWaitlist()
        return
      }
      setBusy(true)
      try {
        await login(buildWaitlistEmailLoginOptions() as any)
      } catch {
        routeToWaitlist()
      } finally {
        setBusy(false)
      }
      return
    }

    if (typeof window === 'undefined') return

    if (ctaState === 'continue_setup') {
      window.location.assign(getMarketingWaitlistEntryUrl())
      return
    }

    window.location.assign(buildAppEntryUrl(getAppBaseUrl()))
  }, [busy, ctaState, loadingState, login, privyClientStatus, routeToWaitlist])

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
