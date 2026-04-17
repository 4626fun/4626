import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { base } from 'wagmi/chains'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { useLogin, usePrivy } from '@privy-io/react-auth'

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
const AUTH_HANDOFF_QUERY_KEY = 'cv_handoff'

// FINDING-02 contract: auth endpoints convey session via HttpOnly cookie
// only. Response bodies expose just `address` so JS cannot exfiltrate
// session tokens. These types reflect the current server shape.
type PrivySessionResponse = { address: string; privyUserId?: string } | null
type AuthHandoffRedeemResponse = { address: string }

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
let autoPrivyBridgeInFlight = false
const AUTH_ME_CACHE_TTL_MS = 1_500
let authMeCacheToken: string | null = null
let authMeCacheAddress: string | null = null
let authMeCacheResolvedAt = 0
let authMeInFlightToken: string | null = null
let authMeInFlight: Promise<string | null> | null = null
let autoPrivyBridgeAttempted = false
let authHandoffRedeemInFlightCode: string | null = null
let authHandoffRedeemInFlight: Promise<AuthHandoffRedeemResponse | null> | null = null

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

function beginAutoPrivyBridgeAttempt(): boolean {
  if (shouldSkipAutoPrivyBridge()) return false
  if (autoPrivyBridgeAttempted) return false
  if (autoPrivyBridgeInFlight) return false
  autoPrivyBridgeAttempted = true
  lastPrivyBridgeAttemptAt = Date.now()
  autoPrivyBridgeInFlight = true
  return true
}

function endAutoPrivyBridgeAttempt() {
  autoPrivyBridgeInFlight = false
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

type ShouldAutoBridgeConnectedPrivySessionInput = {
  isConnected: boolean
  address: string | null | undefined
  authAddress: string | null | undefined
  busy: boolean
  privyReady: boolean
  privyAuthenticated: boolean
  hasPrivyAccessTokenReader: boolean
  skipAutoBridge: boolean
  attemptedForAddress: string
}

export function shouldAutoBridgeConnectedPrivySession(
  input: ShouldAutoBridgeConnectedPrivySessionInput,
): boolean {
  if (!input.isConnected || !input.address) return false
  if (input.busy) return false
  if (!input.privyReady || !input.privyAuthenticated || !input.hasPrivyAccessTokenReader) return false
  if (input.skipAutoBridge) return false
  if (typeof input.authAddress === 'string' && input.authAddress.trim().length > 0) return false

  const key = input.address.toLowerCase()
  if (input.attemptedForAddress === key) return false
  return true
}

type ShouldAutoBridgeRestoredPrivySessionInput = {
  authAddress: string | null | undefined
  busy: boolean
  privyReady: boolean
  privyAuthenticated: boolean
  hasPrivyAccessTokenReader: boolean
  skipAutoBridge: boolean
  hasStoredSessionToken: boolean
  alreadyAttempted: boolean
}

export function shouldAutoBridgeRestoredPrivySession(input: ShouldAutoBridgeRestoredPrivySessionInput): boolean {
  if (!input.authAddress || input.authAddress.trim().length === 0) return false
  if (input.busy) return false
  if (!input.privyReady || !input.privyAuthenticated || !input.hasPrivyAccessTokenReader) return false
  if (input.skipAutoBridge) return false
  if (input.hasStoredSessionToken) return false
  if (input.alreadyAttempted) return false
  return true
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

function readAuthHandoffCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const code = new URLSearchParams(window.location.search).get(AUTH_HANDOFF_QUERY_KEY)
  const normalized = typeof code === 'string' ? code.trim() : ''
  return normalized.length > 0 ? normalized : null
}

function clearAuthHandoffCodeFromLocation() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(AUTH_HANDOFF_QUERY_KEY)) return
  url.searchParams.delete(AUTH_HANDOFF_QUERY_KEY)
  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  try {
    window.history.replaceState(window.history.state, document.title, nextUrl)
  } catch {
    // ignore
  }
}

async function redeemAuthHandoffCode(code: string): Promise<AuthHandoffRedeemResponse | null> {
  const normalized = String(code ?? '').trim()
  if (!normalized) return null

  if (authHandoffRedeemInFlight && authHandoffRedeemInFlightCode === normalized) {
    return authHandoffRedeemInFlight
  }

  let requestPromise!: Promise<AuthHandoffRedeemResponse | null>
  requestPromise = (async () => {
    try {
      // `withCredentials: true` so the Set-Cookie issued by the redeem
      // response (which carries the 4626 session per FINDING-02) is
      // accepted on this origin and included on subsequent /api/auth/me
      // calls.
      const res = await apiFetch('/api/auth/handoff/redeem', {
        method: 'POST',
        withCredentials: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ code: normalized }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AuthHandoffRedeemResponse> | null
      if (!res.ok || !json?.success || !json.data) return null

      const address = typeof json.data.address === 'string' ? json.data.address.trim() : ''
      if (!address) return null
      return { address }
    } catch {
      return null
    } finally {
      if (authHandoffRedeemInFlight === requestPromise) {
        authHandoffRedeemInFlight = null
        authHandoffRedeemInFlightCode = null
      }
    }
  })()

  authHandoffRedeemInFlight = requestPromise
  authHandoffRedeemInFlightCode = normalized
  return requestPromise
}

function invalidateAuthMeCache() {
  authMeCacheToken = null
  authMeCacheAddress = null
  authMeCacheResolvedAt = 0
  authMeInFlightToken = null
  authMeInFlight = null
}

function primeAuthMeCache(token: string | null, address: string | null) {
  authMeCacheToken = token
  authMeCacheAddress = address
  authMeCacheResolvedAt = Date.now()
}

function primeAuthMeCacheIfFresh(token: string | null, address: string | null) {
  if (getStoredSessionToken() !== token) return
  primeAuthMeCache(token, address)
}

async function fetchAuthMeAddress(): Promise<string | null> {
  const token = getStoredSessionToken()
  const now = Date.now()

  if (authMeInFlight && authMeInFlightToken === token) {
    return authMeInFlight
  }

  if (authMeCacheToken === token && now - authMeCacheResolvedAt < AUTH_ME_CACHE_TTL_MS) {
    return authMeCacheAddress
  }

  let requestPromise!: Promise<string | null>
  requestPromise = (async () => {
    try {
      const res = await apiFetch('/api/auth/me', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : null),
        },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MeResponse> | null
      const nextAddress =
        json?.data && typeof (json.data as any)?.address === 'string' ? String((json.data as any).address) : null
      primeAuthMeCacheIfFresh(token, nextAddress)
      return nextAddress
    } catch {
      primeAuthMeCacheIfFresh(token, null)
      return null
    } finally {
      if (authMeInFlight === requestPromise) {
        authMeInFlight = null
        authMeInFlightToken = null
      }
    }
  })()

  authMeInFlight = requestPromise
  authMeInFlightToken = token
  return requestPromise
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
  if (persisted && !nextToken) autoPrivyBridgeAttempted = false
  if (persisted) invalidateAuthMeCache()
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
  const supersedePendingRefresh = useCallback(() => {
    refreshRequestIdRef.current += 1
  }, [])

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
    const nextAddress = await fetchAuthMeAddress()

    if (requestId === refreshRequestIdRef.current) {
      setAuthAddress(nextAddress)
    }

    return nextAddress
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const handoffCode = readAuthHandoffCodeFromLocation()
      if (handoffCode) {
        clearAuthHandoffCodeFromLocation()
        const redeemed = await redeemAuthHandoffCode(handoffCode)
        if (redeemed?.address) {
          // Cookie was issued by the redeem response. Clear any stale
          // sessionStorage token from a prior session so apiBase.ts does
          // not inject a mismatched Authorization header that would
          // override the fresh cookie on subsequent /api/* calls.
          writeStoredSessionToken(null)
          // Prime the /api/auth/me cache keyed by the same null token
          // that `fetchAuthMeAddress` will look up once the sessionStorage
          // is cleared above.
          primeAuthMeCache(null, redeemed.address)
          supersedePendingRefresh()
          setAuthAddress(redeemed.address)
          setCswOwnership(null)
          if (!cancelled) setSessionHydrated(true)
          return
        }
      }

      await refresh()
      if (!cancelled) setSessionHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, supersedePendingRefresh])

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
    async (privyAccessToken: string | null, opts?: { background?: boolean }): Promise<string | null> => {
      const background = opts?.background === true
      const token = typeof privyAccessToken === 'string' ? privyAccessToken.trim() : ''
      if (!token) return null

      if (!background) {
        setBusy(true)
        setError(null)
      }
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

        // FINDING-02 contract: /api/auth/privy returns only `address` and
        // sets the session as an HttpOnly cookie. Drop any stale
        // sessionStorage token so apiBase.ts doesn't inject a mismatched
        // Authorization header that would override the fresh cookie on
        // same-origin requests.
        const address = json?.data && typeof (json.data as any)?.address === 'string' ? String((json.data as any).address) : ''
        if (!address) throw new Error('Privy sign-in failed')

        writeStoredSessionToken(null)
        primeAuthMeCache(null, address)
        supersedePendingRefresh()
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
          supersedePendingRefresh()
          setAuthAddress(null)
          setCswOwnership(null)
          autoPrivyAttemptKeyRef.current = ''
          autoPrivyGlobalAttemptRef.current = false
        }
        if (!background) setError(message)
        return null
      } finally {
        if (!background) setBusy(false)
      }
    },
    [supersedePendingRefresh],
  )

  // If Privy is authenticated, ensure we have a stored bearer token session.
  // This covers cases where:
  // - wagmi isn't connected yet
  // - cookies are present but embedded contexts block them
  // - sessionStorage was cleared mid-session
  useEffect(() => {
    if (busy) return
    if (!privyReady || !privyAuthenticated || !getPrivyAccessToken) return
    const existing = getStoredSessionToken()
    if (existing) return
    if (autoPrivyGlobalAttemptRef.current) return
    if (!beginAutoPrivyBridgeAttempt()) return
    autoPrivyGlobalAttemptRef.current = true
    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token, { background: true })
      } catch {
        // ignore; user can always click "Sign in"
      } finally {
        endAutoPrivyBridgeAttempt()
      }
    })()
  }, [busy, getPrivyAccessToken, privyAuthenticated, privyReady, signInWithPrivyToken])

  // If we learned from `/api/auth/me` that a cookie/bearer session exists but sessionStorage is missing,
  // re-bridge via Privy to restore the bearer token for environments where cookies won't be used.
  useEffect(() => {
    const shouldAutoBridge = shouldAutoBridgeRestoredPrivySession({
      authAddress,
      busy,
      privyReady,
      privyAuthenticated,
      hasPrivyAccessTokenReader: Boolean(getPrivyAccessToken),
      skipAutoBridge: false,
      hasStoredSessionToken: Boolean(getStoredSessionToken()),
      alreadyAttempted: autoPrivyGlobalAttemptRef.current,
    })
    if (!shouldAutoBridge || !getPrivyAccessToken) return
    if (!beginAutoPrivyBridgeAttempt()) return

    autoPrivyGlobalAttemptRef.current = true
    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token, { background: true })
      } catch {
        // ignore
      } finally {
        endAutoPrivyBridgeAttempt()
      }
    })()
  }, [authAddress, busy, getPrivyAccessToken, privyAuthenticated, privyReady, signInWithPrivyToken])

  // Auto-bridge a Privy-authenticated user into a 4626 session only when no
  // app session exists yet. Do not chase connected-wallet/session mismatches
  // here: canonical flows intentionally use an owner EOA plus a canonical CSW,
  // and re-bridging on every mismatch rotates the bearer token, which forces
  // repeated session rehydration across the app.
  useEffect(() => {
    const shouldAutoBridge = shouldAutoBridgeConnectedPrivySession({
      isConnected,
      address,
      authAddress,
      busy,
      privyReady,
      privyAuthenticated,
      hasPrivyAccessTokenReader: Boolean(getPrivyAccessToken),
      skipAutoBridge: false,
      attemptedForAddress: autoPrivyAttemptKeyRef.current,
    })
    if (!shouldAutoBridge || !getPrivyAccessToken || !address) return
    if (!beginAutoPrivyBridgeAttempt()) return

    autoPrivyAttemptKeyRef.current = address.toLowerCase()

    void (async () => {
      try {
        const token = await getPrivyAccessToken()
        if (!token) return
        await signInWithPrivyToken(token, { background: true })
      } catch {
        // ignore; user can always click "Sign in"
      } finally {
        endAutoPrivyBridgeAttempt()
      }
    })()
  }, [address, authAddress, autoPrivyAttemptKeyRef, busy, getPrivyAccessToken, isConnected, privyAuthenticated, privyReady, signInWithPrivyToken])

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
        // Check if Privy already has a valid session before calling login().
        // The `authenticated` flag can lag behind the actual session state,
        // causing Privy to reject the login() call with "already logged in".
        let alreadyHasPrivySession = privyAuthenticated
        if (privyReady && !alreadyHasPrivySession && getPrivyAccessToken) {
          try {
            const existingToken = await getPrivyAccessToken()
            if (existingToken) alreadyHasPrivySession = true
          } catch { /* no existing session */ }
        }

        if (privyReady && !alreadyHasPrivySession && typeof login === 'function') {
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
      // FINDING-02 contract: /api/auth/verify conveys the session via
      // HttpOnly cookie only; no sessionToken in JSON body.
      const verifyJson = (await verifyRes.json().catch(() => null)) as ApiEnvelope<{
        address: string
        cswOwnership?: CswOwnershipAttestation | null
      }> | null
      if (!verifyRes.ok || !verifyJson?.success) {
        const apiErr = coerceErrorMessage((verifyJson as any)?.error, '')
        throw new Error(apiErr || 'Sign-in failed')
      }

      const signed = verifyJson?.data?.address
      // Clear any stale sessionStorage so the fresh cookie isn't shadowed
      // by a mismatched Authorization header on subsequent /api/* calls.
      writeStoredSessionToken(null)
      const resolved = typeof signed === 'string' ? signed : null
      supersedePendingRefresh()
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
  }, [address, getPrivyAccessToken, login, privyAuthenticated, privyReady, signInWithPrivyToken, signMessageAsync, supersedePendingRefresh])

  const signOut = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
      writeStoredSessionToken(null)
      primeAuthMeCache(null, null)
      supersedePendingRefresh()
      setAuthAddress(null)
      setCswOwnership(null)
    } finally {
      setBusy(false)
    }
  }, [supersedePendingRefresh])

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
