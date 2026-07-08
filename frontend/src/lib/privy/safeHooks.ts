import { useCallback, useEffect, useRef } from 'react'
import {
  useActiveWallet,
  useConnectWallet,
  useCreateWallet,
  useCrossAppAccounts,
  useLogin,
  useLoginWithEmail,
  usePrivy,
} from '@privy-io/react-auth'

export type SafePrivyClient = {
  ready?: boolean
  authenticated?: boolean
  user?: unknown
  getAccessToken?: (() => Promise<string | null>) | null
  logout?: (() => Promise<void>) | null
}

export type SafeLoginClient = {
  login: (input: { loginMethods: string[] | readonly string[] }) => void
}

export type SafeLoginWithEmailClient = {
  sendCode: (input: { email: string }) => Promise<unknown>
  loginWithCode: (input: { code: string }) => Promise<unknown>
}

export type SafeCreateWalletClient = {
  createWallet: (() => Promise<unknown>) | null
}

const DISABLED_PRIVY_CLIENT: SafePrivyClient = {
  ready: false,
  authenticated: false,
  user: null,
  getAccessToken: null,
  logout: null,
}

/**
 * `usePrivy()` (and `useSafePrivy()` above) returns a brand-new plain object
 * on every render — Privy's SDK builds it via `{...useContext(ctx), ...}`, not
 * a live/mutable reference. A `privy` value captured once (e.g. at the start of
 * an async flow) will never reflect a later `authenticated`/`ready` transition;
 * code that needs to *poll* for a state change (rather than read it once) must
 * go through a ref. This wraps a `{ current: SafePrivyClient }` ref in an
 * object whose fields are live getters/delegating calls, so repeated reads
 * always see the latest snapshot without the caller needing to re-derive it.
 */
export function createLivePrivyClientView(privyRef: { current: SafePrivyClient }): SafePrivyClient {
  return {
    get ready() {
      return privyRef.current.ready
    },
    get authenticated() {
      return privyRef.current.authenticated
    },
    get user() {
      return privyRef.current.user
    },
    getAccessToken: () => privyRef.current.getAccessToken?.() ?? Promise.resolve(null),
    logout: () => privyRef.current.logout?.() ?? Promise.resolve(),
  }
}

export function useSafePrivy(options?: {
  enabled?: boolean
  onUnavailable?: (error: unknown) => void
}): SafePrivyClient {
  try {
    const privy = usePrivy() as SafePrivyClient
    if (options?.enabled === false) return DISABLED_PRIVY_CLIENT
    return privy
  } catch (error) {
    options?.onUnavailable?.(error)
    return DISABLED_PRIVY_CLIENT
  }
}

export function useSafePrivyAccessToken(): (() => Promise<string | null>) | null {
  const privy = useSafePrivy()
  const privyRef = useRef(privy)

  useEffect(() => {
    privyRef.current = privy
  })

  const tokenReady =
    privy.ready !== false &&
    privy.authenticated !== false &&
    typeof privy.getAccessToken === 'function'

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = privyRef.current
    if (typeof current.getAccessToken !== 'function') return null
    return current.getAccessToken().catch(() => null)
  }, [])

  return tokenReady ? getAccessToken : null
}

export function useSafeLogin(): SafeLoginClient {
  try {
    const client = useLogin() as SafeLoginClient
    return {
      login: typeof client.login === 'function' ? client.login : () => {},
    }
  } catch {
    return { login: () => {} }
  }
}

export function useSafeLoginWithEmail(): SafeLoginWithEmailClient {
  try {
    return useLoginWithEmail() as unknown as SafeLoginWithEmailClient
  } catch {
    return {
      sendCode: async () => {},
      loginWithCode: async () => {},
    }
  }
}

export function useSafeCreateWallet(): SafeCreateWalletClient {
  try {
    const client = useCreateWallet() as SafeCreateWalletClient
    return {
      createWallet: typeof client.createWallet === 'function' ? client.createWallet : null,
    }
  } catch {
    return { createWallet: null }
  }
}

export function useSafeCrossApp() {
  try {
    return useCrossAppAccounts() as any
  } catch {
    return {
      loginWithCrossAppAccount: null,
      linkCrossAppAccount: null,
      unlinkCrossAppAccount: null,
    } as any
  }
}

export function useSafeConnectWallet() {
  try {
    return useConnectWallet() as any
  } catch {
    return { connectWallet: () => {} } as any
  }
}

export function useSafeActiveWallet() {
  try {
    return useActiveWallet() as any
  } catch {
    return {
      wallet: undefined,
      setActiveWallet: async () => {},
    } as any
  }
}
