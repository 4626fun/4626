import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { base } from 'wagmi/chains'
import { apiFetch } from '@/lib/apiBase'
import { useLogin, usePrivy } from '@privy-io/react-auth'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type MeResponse = { address: string } | null
type CswOwnershipAttestation = {
  cswAddress: string
  ownerAddress: string
  verified: boolean
}

type DerivedSiweSessionStateInput = {
  connectedAddress: string | null | undefined
  authAddress: string | null | undefined
}

type DerivedSiweSessionState = {
  sessionAddress: string | null
  hasSession: boolean
  walletMatchesSession: boolean
}

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'
const SESSION_TOKEN_CHANGED_EVENT = 'cv-siwe-session-token-change'

type PrivySessionResponse = { address: string; sessionToken: string; privyUserId?: string } | null

/**
 * Explicit user-initiated Privy sign-in should prefer identity-first methods.
 * Wallet-first in this path can accidentally create a new Privy identity and
 * then collide with an existing email-bound account.
 */
export const PRIVY_INTERACTIVE_LOGIN_METHODS = ['email', 'wallet'] as const

// Prevent request storms:
// `useSiweAuth()` can be mounted in multiple places; without a shared guard each instance can auto-bridge.
let lastPrivyBridgeAttemptAt = 0
let lastPrivyBridgeFailureAt = 0
let lastPrivyBridgeFailureReason = ''

function shouldSkipAutoPrivyBridge(): boolean {
  const now = Date.now()
  // Throttle repeated attempts across hook instances.
  if (now - lastPrivyBridgeAttemptAt < 10_000) return true

  // Back off harder on terminal-ish failures (e.g. user has no Base Account linked).
  const reason = String(lastPrivyBridgeFailureReason || '').toLowerCase()
  if (
    reason.includes('recovery required') ||
    reason.includes('already linked to another account') ||
    reason.includes('recovery_required_email_bound')
  ) {
    return now - lastPrivyBridgeFailureAt < 10 * 60_000
  }
  if (reason.includes('no base account wallet is linked') || reason.includes('link coinbase smart wallet')) {
    return now - lastPrivyBridgeFailureAt < 5 * 60_000
  }
  if (reason.includes('invalid privy auth token')) {
    return now - lastPrivyBridgeFailureAt < 60_000
  }
  return false
}

export function shouldResetPrivyBridgeState(message: string): boolean {
  const lower = String(message || '').trim().toLowerCase()
  if (!lower) return false
  return (
    lower.includes('invalid privy auth token') ||
    lower.includes('missing privy auth token') ||
    lower.includes('privy token expired') ||
    lower.includes('privy verification failed')
  )
}

export function deriveSiweSessionState(input: DerivedSiweSessionStateInput): DerivedSiweSessionState {
  const sessionAddress =
    typeof input.authAddress === 'string' && input.authAddress.trim().length > 0 ? input.authAddress : null
  const connectedAddress =
    typeof input.connectedAddress === 'string' && input.connectedAddress.trim().length > 0 ? input.connectedAddress : null
  const hasSession = Boolean(sessionAddress)
  const walletMatchesSession =
    Boolean(sessionAddress) &&
    Boolean(connectedAddress) &&
    String(sessionAddress).toLowerCase() === String(connectedAddress).toLowerCase()

  return {
    sessionAddress,
    hasSession,
    walletMatchesSession,
  }
}

function coerceErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string' && e.trim().length > 0) return e
  if (e instanceof Error && typeof e.message === 'string' && e.message.trim().length > 0) return e.message
  const maybeObj = e as any
  const shortMessage = typeof maybeObj?.shortMessage === 'string' ? maybeObj.shortMessage.trim() : ''
  if (shortMessage) return shortMessage
  const message = typeof maybeObj?.message === 'string' ? maybeObj.message.trim() : ''
  if (message) return message
  try {
    const s = JSON.stringify(e)
    if (typeof s === 'string' && s.length > 0 && s !== '{}' && s !== 'null') return s
  } catch {
    // ignore
  }
  return fallback
}

function getStoredSessionToken(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

function notifyStoredSessionTokenChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT))
}

export function writeStoredSessionToken(token: string | null) {
  const normalized = typeof token === 'string' ? token.trim() : ''
  const nextToken = normalized.length > 0 ? normalized : null
  const prevToken = getStoredSessionToken()
  if (prevToken === nextToken) return

  let persisted = false
  try {
    if (!nextToken) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
    } else {
      sessionStorage.setItem(SESSION_TOKEN_KEY, nextToken)
    }
    persisted = true
  } catch {
    // ignore
  }
  if (persisted) notifyStoredSessionTokenChanged()
}

async function readPrivyAccessTokenWithRetry(
  getPrivyAccessToken: (() => Promise<string | null>) | null,
  opts?: { attempts?: number; delayMs?: number },
): Promise<string | null> {
  if (typeof getPrivyAccessToken !== 'function') return null
  const attempts = Math.max(1, Number(opts?.attempts ?? 1))
  const delayMs = Math.max(0, Number(opts?.delayMs ?? 0))
  for (let i = 0; i < attempts; i++) {
    try {
      const token = await getPrivyAccessToken()
      const normalized = typeof token === 'string' ? token.trim() : ''
      if (normalized) return normalized
    } catch {
      // Ignore transient token-read failures and retry below.
    }
    if (i < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return null
}

function useSafePrivyHook() {
  try {
    return usePrivy() as any
  } catch {
    return {
      ready: false,
      authenticated: false,
      getAccessToken: null as null | (() => Promise<string | null>),
    } as any
  }
}

function useSafeLoginHook() {
  try {
    return useLogin() as any
  } catch {
    return { login: async () => {} } as any
  }
}

export function useSiweAuth() {
  // IMPORTANT:
  // This hook implements an app-local SIWE session ("Sign in with Ethereum") used for:
  // - creator access requests (/api/creator-access/*)
  // - admin gating (/api/admin/*)
  //
  // It is NOT a social identity signal and should not be mapped to any external profile ID.
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const privyAny = useSafePrivyHook()
  const { login } = useSafeLoginHook()
  const privyReady = Boolean(privyAny?.ready)
  const privyAuthenticated = Boolean(privyAny?.authenticated)
  const getPrivyAccessToken: (() => Promise<string | null>) | null =
    typeof privyAny?.getAccessToken === 'function' ? privyAny.getAccessToken.bind(privyAny) : null

  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [cswOwnership, setCswOwnership] = useState<CswOwnershipAttestation | null>(null)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoPrivyAttemptKeyRef = useRef<string>('')
  const autoPrivyGlobalAttemptRef = useRef(false)
  const refreshRequestIdRef = useRef(0)

  const sessionState = useMemo(
    () =>
      deriveSiweSessionState({
        connectedAddress: address,
        authAddress,
      }),
    [address, authAddress],
  )
  const isSignedIn = sessionState.walletMatchesSession

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current
    let nextAddress: string | null = null
    try {
      const token = getStoredSessionToken()
      const res = await apiFetch('/api/auth/me', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : null),
        },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MeResponse> | null
      nextAddress = json?.data && typeof (json.data as any)?.address === 'string' ? String((json.data as any).address) : null
    } catch {
      nextAddress = null
    }

    if (requestId === refreshRequestIdRef.current) {
      setAuthAddress(nextAddress)
    }

    return nextAddress
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refresh()
      if (!cancelled) setSessionHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    const handleSessionTokenChanged = () => {
      setSessionHydrated(false)
      void (async () => {
        await refresh()
        if (!cancelled) setSessionHydrated(true)
      })()
    }

    window.addEventListener(SESSION_TOKEN_CHANGED_EVENT, handleSessionTokenChanged)
    return () => {
      cancelled = true
      window.removeEventListener(SESSION_TOKEN_CHANGED_EVENT, handleSessionTokenChanged)
    }
  }, [refresh])

  const signInWithPrivyToken = useCallback(
    async (privyAccessToken: string | null): Promise<string | null> => {
      const token = typeof privyAccessToken === 'string' ? privyAccessToken.trim() : ''
      if (!token) return null

      setBusy(true)
      setError(null)
      try {
        lastPrivyBridgeAttemptAt = Date.now()
        const res = await apiFetch('/api/auth/privy', {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
        const json = (await res.json().catch(() => null)) as ApiEnvelope<PrivySessionResponse> | null
        const recoveryRequired =
          res.status === 409 ||
          Boolean((json as any)?.recoveryRequired) ||
          String((json as any)?.code ?? '')
            .toUpperCase()
            .includes('RECOVERY_REQUIRED')
        if (!res.ok || !json?.success) {
          const apiErr = coerceErrorMessage((json as any)?.error, '')
          const message =
            apiErr ||
            (recoveryRequired
              ? 'Recovery required: this email is already linked to another account. Use account recovery to continue.'
              : 'Privy sign-in failed')
          if (recoveryRequired) {
            // Keep manual sign-in available, but stop background auto-bridge retry storms.
            autoPrivyGlobalAttemptRef.current = true
          }
          lastPrivyBridgeFailureAt = Date.now()
          lastPrivyBridgeFailureReason = message
          throw new Error(message)
        }

        const sessionToken =
          json?.data && typeof (json.data as any)?.sessionToken === 'string' ? String((json.data as any).sessionToken) : ''
        const address = json?.data && typeof (json.data as any)?.address === 'string' ? String((json.data as any).address) : ''
        if (!sessionToken || !address) throw new Error('Privy sign-in failed')

        writeStoredSessionToken(sessionToken)
        setAuthAddress(address)
        setCswOwnership(null)
        try {
          localStorage.setItem('cv:privy:lastAuthAt', String(Date.now()))
        } catch {
          // ignore
        }
        return address
      } catch (e: unknown) {
        const message = coerceErrorMessage(e, 'Privy sign-in failed')
        if (shouldResetPrivyBridgeState(message)) {
          writeStoredSessionToken(null)
          setAuthAddress(null)
          setCswOwnership(null)
          autoPrivyAttemptKeyRef.current = ''
          autoPrivyGlobalAttemptRef.current = false
        }
        setError(message)
        return null
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  // If Privy is authenticated, ensure we have a stored bearer token session.
  // This covers cases where:
  // - wagmi isn't connected yet
  // - cookies are present but embedded contexts block them
  // - sessionStorage was cleared mid-session
  useEffect(() => {
    if (busy) return
    if (!privyReady || !privyAuthenticated || !getPrivyAccessToken) return
    if (shouldSkipAutoPrivyBridge()) return
    const existing = getStoredSessionToken()
    if (existing) return
    if (autoPrivyGlobalAttemptRef.current) return
    autoPrivyGlobalAttemptRef.current = true
    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token)
      } catch {
        // ignore; user can always click "Sign in"
      }
    })()
  }, [busy, getPrivyAccessToken, privyAuthenticated, privyReady, signInWithPrivyToken])

  // If we learned from `/api/auth/me` that a cookie/bearer session exists but sessionStorage is missing,
  // re-bridge via Privy to restore the bearer token for environments where cookies won't be used.
  useEffect(() => {
    if (busy) return
    if (!privyReady || !privyAuthenticated || !getPrivyAccessToken) return
    if (!authAddress) return
    if (shouldSkipAutoPrivyBridge()) return
    const existing = getStoredSessionToken()
    if (existing) return
    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token)
      } catch {
        // ignore
      }
    })()
  }, [authAddress, busy, getPrivyAccessToken, privyAuthenticated, privyReady, signInWithPrivyToken])

  // Auto-bridge a Privy-authenticated user into a 4626 session (no SIWE signing),
  // so `/api/auth/me` and other gated API routes work seamlessly.
  useEffect(() => {
    if (!isConnected || !address) return
    if (busy) return
    if (!privyReady || !privyAuthenticated || !getPrivyAccessToken) return
    if (isSignedIn) return
    if (shouldSkipAutoPrivyBridge()) return

    const key = address.toLowerCase()
    if (autoPrivyAttemptKeyRef.current === key) return
    autoPrivyAttemptKeyRef.current = key

    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token)
      } catch {
        // ignore; user can always click "Sign in"
      }
    })()
  }, [address, autoPrivyAttemptKeyRef, busy, getPrivyAccessToken, isConnected, isSignedIn, privyAuthenticated, privyReady, signInWithPrivyToken])

  type SignInMethod = 'auto' | 'siwe' | 'privy'

  const signIn = useCallback(async (opts?: { method?: SignInMethod; attestCswAddress?: string | null }): Promise<string | null> => {
    const method: SignInMethod = opts?.method ?? 'auto'
    const attestCswAddressRaw = typeof opts?.attestCswAddress === 'string' ? opts.attestCswAddress.trim() : ''
    const attestCswAddress =
      /^0x[a-fA-F0-9]{40}$/.test(attestCswAddressRaw) ? attestCswAddressRaw : ''
    setBusy(true)
    setError(null)
    try {
      const allowPrivy = method === 'auto' || method === 'privy'

      if (allowPrivy) {
        if (privyReady && !privyAuthenticated && typeof login === 'function') {
          try {
            await login({ loginMethods: [...PRIVY_INTERACTIVE_LOGIN_METHODS] })
          } catch {
            // If Privy auth fails/cancels, fall back to SIWE below (only for method=auto).
          }
        }

        if (privyReady && getPrivyAccessToken) {
          try {
            // Privy auth state can lag for a short moment after login/cross-app return.
            // Retry a few times for explicit methods so we don't surface false "cancelled".
            const privyToken = await readPrivyAccessTokenWithRetry(getPrivyAccessToken, {
              attempts: method === 'auto' ? 1 : 8,
              delayMs: method === 'auto' ? 0 : 250,
            })
            if (privyToken) {
              const addr = await signInWithPrivyToken(privyToken)
              if (addr) return addr
            }
          } catch {
            // fall through (only for method=auto)
          }
        }

        // If caller explicitly requested Privy, do not attempt SIWE.
        // Surface an actionable message so the UI never feels like a dead click.
        if (method === 'privy') {
          if (!privyReady) {
            setError('Wallet login is still initializing. Try again in a moment.')
          } else if (privyAuthenticated) {
            setError('Sign-in is still finalizing. Please try once more.')
          } else {
            setError('Sign-in was cancelled. Try again.')
          }
          return null
        }
      }

      if (!address) {
        setError('Connect wallet first, then sign in.')
        return null
      }

      const nonceRes = await apiFetch('/api/auth/nonce', { headers: { Accept: 'application/json' } })
      if (!nonceRes.ok) {
        const errJson = (await nonceRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
        const apiErr = coerceErrorMessage((errJson as any)?.error, '')
        throw new Error(apiErr || `Failed to start sign-in (HTTP ${nonceRes.status})`)
      }
      const nonceJson = (await nonceRes.json().catch(() => null)) as
        | ApiEnvelope<{ nonce: string; nonceToken: string; issuedAt: string; domain: string; uri: string; chainId: number }>
        | null

      const nonce = typeof nonceJson?.data?.nonce === 'string' ? nonceJson.data.nonce : ''
      const nonceToken = typeof nonceJson?.data?.nonceToken === 'string' ? nonceJson.data.nonceToken : ''
      const issuedAt = typeof nonceJson?.data?.issuedAt === 'string' ? nonceJson.data.issuedAt : new Date().toISOString()
      const domain = typeof nonceJson?.data?.domain === 'string' ? nonceJson.data.domain : window.location.host
      const uri = typeof nonceJson?.data?.uri === 'string' ? nonceJson.data.uri : window.location.origin
      const chainId = typeof nonceJson?.data?.chainId === 'number' ? nonceJson.data.chainId : base.id

      if (!nonce) throw new Error('Failed to start sign-in (missing nonce)')
      if (!nonceToken) throw new Error('Failed to start sign-in (missing nonce token)')

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to 4626.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`
      const signature = await signMessageAsync({ message })

      const verifyRes = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          message,
          signature,
          nonceToken,
          ...(attestCswAddress ? { cswAddress: attestCswAddress } : null),
        }),
      })
      const verifyJson = (await verifyRes.json().catch(() => null)) as ApiEnvelope<{
        address: string
        sessionToken: string
        cswOwnership?: CswOwnershipAttestation | null
      }> | null
      if (!verifyRes.ok || !verifyJson?.success) {
        const apiErr = coerceErrorMessage((verifyJson as any)?.error, '')
        throw new Error(apiErr || 'Sign-in failed')
      }

      const signed = verifyJson?.data?.address
      const sessionToken = verifyJson?.data?.sessionToken
      if (typeof sessionToken === 'string' && sessionToken.trim().length > 0) {
        writeStoredSessionToken(sessionToken.trim())
      }
      const resolved = typeof signed === 'string' ? signed : null
      setAuthAddress(resolved)
      const csw = (verifyJson?.data as any)?.cswOwnership
      if (
        csw &&
        typeof csw === 'object' &&
        typeof csw.cswAddress === 'string' &&
        typeof csw.ownerAddress === 'string' &&
        typeof csw.verified === 'boolean'
      ) {
        setCswOwnership({
          cswAddress: csw.cswAddress,
          ownerAddress: csw.ownerAddress,
          verified: csw.verified,
        })
      } else {
        setCswOwnership(null)
      }

      return resolved
    } catch (e: unknown) {
      setError(coerceErrorMessage(e, 'Sign-in failed'))
      return null
    } finally {
      setBusy(false)
    }
  }, [address, getPrivyAccessToken, login, privyAuthenticated, privyReady, signInWithPrivyToken, signMessageAsync])

  const signOut = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
      writeStoredSessionToken(null)
      setAuthAddress(null)
      setCswOwnership(null)
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    authAddress,
    hasSession: sessionState.hasSession,
    walletMatchesSession: sessionState.walletMatchesSession,
    isSignedIn,
    cswOwnership,
    busy,
    error,
    signIn,
    signInWithPrivyToken,
    signOut,
    refresh,
    sessionHydrated,
  }
}
