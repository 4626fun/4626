import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveWallet, useConnectWallet, useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'
import { getAddress } from 'viem'
import { base } from 'viem/chains'
import { useAccount, useConnections, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { mergeAccountMeWithBootstrap } from '@/lib/account/mergeAccountMeBootstrap'
import { apiFetch } from '@/lib/api/apiBase'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { extractPrivyWalletsFromUser, useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import {
  performZoraCrossAppAuth,
  isRecoverableCrossAppAuthError,
  isUserRejectedCrossAppAuthError,
} from '@/lib/privy/zoraCrossApp'
import { isInjectedWalletCollisionMessage } from '@/lib/auth/sessionRepair'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { isTelegramMiniAppContext, readPrivyTelegramLaunchParams } from '@/lib/telegram/telegramWebApp'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'

/**
 * Exhaustive-deps is disabled for this file.
 *
 * This controller (used by WaitlistFlow + AccountSetupWorkspaceView) must remain stable
 * while wagmi (usePublicClient, useConnections, useWalletClient, useAccount) and Privy
 * hook objects change identity rapidly during long async flows:
 *   - email OTP + Privy session finalization
 *   - Zora cross-app linking
 *   - embedded wallet provisioning
 *   - Base App wallet_sendCalls + parent CSW addOwnerAddress (the validated 2026
 *     EntryPoint self-call path)
 *   - on-chain owner checks and CSW ownership probes
 *
 * We use the same proven pattern as useAddUserOpOwnerInstall:
 *   - stable refs for all noisy external objects
 *   - guarded setters (set*Guarded) that only update state on actual change
 *   - callbacks read latest values via refs and never list the unstable objects in deps
 *
 * This is required to prevent React #185 max-update-depth loops on waitlist and
 * account setup surfaces.
 */
/* eslint-disable react-hooks/exhaustive-deps */

import {
  type OwnerDelegationFlags,
  deriveOwnerDelegationFlags,
  readApiError,
  shouldRefreshOwnerDelegationOnForeground,
} from '@/lib/wallet/onboardingWalletDelegation'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { checkEoaOwnershipOfCsw } from '@/wallet/accountContext/ownership'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { submitOwnerViaPreparedCallsWithEoaOwner } from '@/lib/wallet/eoaOwnerPreparedCalls'
import type { PreparedOwnerTxRequest } from '@/lib/wallet/zoraAddOwnerApi'
import { buildOwnerWalletConnectList, mapOwnerWalletConnectError } from './ownerWalletConnectOptions'

import { PROVIDER_ROWS, deriveOwnerAuthorityState, hasResolvedZoraSignals, isMobileWalletEnvironment, shortValue, sleep } from './shared'
import type {
  AccountSetupInitialData,
  AccountSetupMe,
  ConnectedOwnerState,
  CswOwnersState,
  OwnerChecklistItem,
  OwnerInstallResumeState,
  ZoraLinkStatusResponse,
  ZoraResolveResponse,
} from './types'

function resolveDirectPreparedCallsPaymasterUrl(): string | null {
  const direct = String(import.meta.env.VITE_CDP_SENDCALLS_PAYMASTER_URL ?? '').trim()
  if (/^https?:\/\//i.test(direct)) return direct
  return null
}

function parseChainId(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.includes(':')) {
    const [, suffix] = trimmed.split(':')
    const parsed = Number(suffix)
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const ZORA_CROSSAPP_BACKOFF_KEY = 'cv:zora-crossapp-backoff'

function readZoraCrossAppBackoff(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(ZORA_CROSSAPP_BACKOFF_KEY) === '1'
  } catch {
    return false
  }
}

function writeZoraCrossAppBackoff(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      window.sessionStorage.setItem(ZORA_CROSSAPP_BACKOFF_KEY, '1')
    } else {
      window.sessionStorage.removeItem(ZORA_CROSSAPP_BACKOFF_KEY)
    }
  } catch {
    // best effort
  }
}

async function withOperationTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId))
  })
}

async function resolvePrivyAccessTokenWithRetry(
  readToken: () => Promise<string | null>,
  options?: { attempts?: number; delayMs?: number },
): Promise<string | null> {
  const attempts = Math.max(1, Number(options?.attempts ?? 6))
  const delayMs = Math.max(0, Number(options?.delayMs ?? 200))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const token = await readToken()
      if (typeof token === 'string' && token.trim().length > 0) return token
    } catch {
      // Privy token hydration can race briefly after OAuth return.
      // Retry before surfacing a blocking auth-token error.
    }
    if (attempt < attempts - 1 && delayMs > 0) {
      await sleep(delayMs)
    }
  }

  return null
}

function isPrivyExternalEthereumWallet(wallet: any): boolean {
  if (!wallet || typeof wallet !== 'object') return false
  const chainType = String(wallet.chainType ?? wallet.chain_type ?? wallet.type ?? '').toLowerCase().trim()
  if (chainType.includes('solana')) return false
  const walletClientType = String(wallet.walletClientType ?? wallet.wallet_client_type ?? '').toLowerCase().trim()
  if (walletClientType === 'privy' || walletClientType === 'privy-v2' || walletClientType.includes('embedded')) {
    return false
  }
  return /^0x[a-fA-F0-9]{40}$/.test(String(wallet.address ?? '').trim())
}

async function maybeCallMethod(target: any, methodNames: string[], args: unknown[] = []): Promise<boolean> {
  if (!target) return false
  for (const methodName of methodNames) {
    if (typeof target[methodName] === 'function') {
      await target[methodName](...args)
      return true
    }
  }
  return false
}

function selectLinkedValues(me: AccountSetupMe | null, provider: string): string[] {
  if (!me) return []
  return Array.isArray(me.linkedMethods?.[provider]) ? me.linkedMethods[provider] : []
}

export function shouldRefreshAccountsOnForeground(input: {
  privyAuthed: boolean
  ownerDelegationFlags: OwnerDelegationFlags | null
  advancedBusy: boolean
}): boolean {
  return shouldRefreshOwnerDelegationOnForeground({
    privyAuthed: input.privyAuthed,
    ownerDelegationFlags: input.ownerDelegationFlags,
    busy: input.advancedBusy,
  })
}

export function readOptionalZoraStatus(params: {
  responseOk: boolean
  payload: ApiEnvelope<ZoraLinkStatusResponse> | null
}): ZoraLinkStatusResponse | null {
  if (!params.responseOk) return null
  if (!params.payload?.success || !params.payload.data) return null
  return params.payload.data
}

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      ready: false,
      getAccessToken: async () => null,
      linkWallet: null,
    } as any
  }
}

function useSafeLogin() {
  try {
    return useLogin() as any
  } catch {
    return { login: async () => {} } as any
  }
}

function useSafeCrossApp() {
  try {
    return useCrossAppAccounts() as any
  } catch {
    return {
      loginWithCrossAppAccount: null,
      linkCrossAppAccount: null,
    } as any
  }
}

function useSafeConnectWallet() {
  try {
    return useConnectWallet() as any
  } catch {
    return { connectWallet: () => {} } as any
  }
}

function useSafeActiveWallet() {
  try {
    return useActiveWallet() as any
  } catch {
    return { wallet: undefined, setActiveWallet: async () => {} } as any
  }
}

export function useAccountSetupController(params: {
  initialData?: AccountSetupInitialData
  zoraReturnPath?: string
}) {
  const location = useLocation()
  const privy = useSafePrivy()
  const { login } = useSafeLogin()
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()
  const { connectWallet } = useSafeConnectWallet()
  const { wallet: activePrivyWallet, setActiveWallet } = useSafeActiveWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address: connectedAddress, chainId } = useAccount()
  const wagmiConnections = useConnections()
  const { switchChainAsync } = useSwitchChain()
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const ownerInstallSectionRef = useRef<HTMLElement | null>(null)
  const hasInitialDataRef = useRef(Boolean(params.initialData))
  const ownerApprovalRunIdRef = useRef(0)
  const pendingOwnerInstallHashRef = useRef<string | null>(null)

  // Pending owner install state (especially for the long Base App wallet_sendCalls +
  // EntryPoint self-call addOwnerAddress path). When set, the waitlist accordion and
  // other setup surfaces can show the same high-quality "Waiting for Base App signature…",
  // hash + copy, "Check now (refresh gas)" UX that the dedicated AddOwnerBaseApp page has.
  const [pendingOwnerInstallHash, setPendingOwnerInstallHash] = useState<string | null>(null)
  const setPendingOwnerInstallHashGuarded = useCallback((next: string | null) => {
    pendingOwnerInstallHashRef.current = next
    setPendingOwnerInstallHash((prev) => (prev === next ? prev : next))
  }, [])

  // Phase for the current owner install operation (awaiting_signature, broadcasting,
  // confirming, etc.). Powered by the modern Base App self-call hook when active.
  // Allows waitlist banners to show precise copy during long signature + bundle waits.
  const [ownerInstallPhase, setOwnerInstallPhase] = useState<string | null>(null)
  const ownerInstallPhaseRef = useRef<string | null>(null)
  const setOwnerInstallPhaseGuarded = useCallback((next: string | null) => {
    ownerInstallPhaseRef.current = next
    setOwnerInstallPhase((prev) => (prev === next ? prev : next))
  }, [])

  // Refs for unstable external objects (wagmi/Privy) to prevent React #185 max-update-depth
  // during long async flows (Zora cross-app, owner install wallet_sendCalls signature prompts,
  // embedded wallet ensure, CSW owner checks). Mirrors the stabilization pattern used in
  // useAddUserOpOwnerInstall for the validated Base App parent-CSW EntryPoint self-call path.
  const publicClientRef = useRef(publicClient)
  const walletClientRef = useRef(walletClient)
  const connectionsRef = useRef(wagmiConnections)
  const connectedAddressRef = useRef(connectedAddress)
  const chainIdRef = useRef(chainId)
  const privyRef = useRef(privy)
  const activePrivyWalletRef = useRef(activePrivyWallet)
  const switchChainAsyncRef = useRef(switchChainAsync)
  const ensureEmbeddedWalletRef = useRef(ensureEmbeddedWallet)

  // Keep refs current without adding the objects themselves to any callback/effect deps.
  useEffect(() => {
    publicClientRef.current = publicClient
  }, [publicClient])
  useEffect(() => {
    walletClientRef.current = walletClient
  }, [walletClient])
  useEffect(() => {
    connectionsRef.current = wagmiConnections
  }, [wagmiConnections])
  useEffect(() => {
    connectedAddressRef.current = connectedAddress
  }, [connectedAddress])
  useEffect(() => {
    chainIdRef.current = chainId
  }, [chainId])
  useEffect(() => {
    privyRef.current = privy
  }, [privy])
  useEffect(() => {
    activePrivyWalletRef.current = activePrivyWallet
  }, [activePrivyWallet])
  useEffect(() => {
    switchChainAsyncRef.current = switchChainAsync
  }, [switchChainAsync])
  useEffect(() => {
    ensureEmbeddedWalletRef.current = ensureEmbeddedWallet
  }, [ensureEmbeddedWallet])

  const privyAuthed = Boolean(privy?.authenticated)
  const privyWallets = useMemo(() => extractPrivyWalletsFromUser(privy?.user), [privy?.user])
  const getAccessToken = useMemo(
    () =>
      typeof privy?.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy],
  )

  const [me, setMe] = useState<AccountSetupMe | null>(params.initialData?.me ?? null)
  const [zoraStatus, setZoraStatus] = useState<ZoraLinkStatusResponse | null>(params.initialData?.zoraStatus ?? null)
  const [loading, setLoading] = useState(!params.initialData)
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Guarded setters — only call React setState when the value actually changes.
  // Prevents unnecessary re-renders during long wallet/OTP/Privy-sync flows (same pattern
  // as setSubmitPhaseGuarded / appendEvent dedup in the Base App owner install hook).
  const setMeGuarded = useCallback((next: AccountSetupMe | null) => {
    setMe((prev) => (prev === next ? prev : next))
  }, [])
  const setLoadingGuarded = useCallback((next: boolean) => {
    setLoading((prev) => (prev === next ? prev : next))
  }, [])
  const setBusyProviderGuarded = useCallback((next: string | null) => {
    setBusyProvider((prev) => (prev === next ? prev : next))
  }, [])
  const setErrorGuarded = useCallback((next: string | null) => {
    setError((prev) => (prev === next ? prev : next))
  }, [])
  const setNoticeGuarded = useCallback((next: string | null) => {
    setNotice((prev) => (prev === next ? prev : next))
  }, [])

  const [advancedBusy, setAdvancedBusy] = useState(false)
  const [ownerDelegationFlags, setOwnerDelegationFlags] = useState<OwnerDelegationFlags | null>(null)
  const [connectedOwnerState, setConnectedOwnerState] = useState<ConnectedOwnerState>({ value: null, reason: 'idle' })
  const [cswOwnersState, setCswOwnersState] = useState<CswOwnersState>({ status: 'idle', owners: [], error: null })

  const canonicalCswAddress = me?.accountSignals?.canonicalCswAddress ?? null
  const zoraLinked = Boolean(zoraStatus?.zoraLinked || me?.accountSignals?.linked)
  const telegramLaunchParamsAvailable = useMemo(() => Boolean(readPrivyTelegramLaunchParams()?.initDataRaw), [])
  const inTelegramMiniApp = useMemo(() => isTelegramMiniAppContext(), [])
  const ownerInstallResumeState = useMemo<OwnerInstallResumeState>(() => {
    const searchParams = new URLSearchParams(location.search)
    const setup = (searchParams.get('setup') ?? '').trim().toLowerCase()
    if (setup !== 'owner-install') {
      return { requested: false, source: null }
    }
    const source = (searchParams.get('source') ?? '').trim().toLowerCase()
    return {
      requested: true,
      source: source || null,
    }
  }, [location.search])
  const prefersWalletConnectQr = useMemo(() => !isMobileWalletEnvironment(), [])
  const activeExternalOwnerWallet = useMemo(() => {
    if (isPrivyExternalEthereumWallet(activePrivyWallet)) return activePrivyWallet
    const externalWallets = Array.isArray(privyWallets) ? privyWallets.filter(isPrivyExternalEthereumWallet) : []
    if (externalWallets.length === 0) return null
    return (
      externalWallets
        .slice()
        .sort((a: any, b: any) => Number(b?.connectedAt ?? 0) - Number(a?.connectedAt ?? 0))[0] ?? null
    )
  }, [activePrivyWallet, privyWallets])
  const activeExternalOwnerWalletMatchesConnectedAddress = useMemo(() => {
    if (!activeExternalOwnerWallet?.address || !connectedAddress) return false
    return activeExternalOwnerWallet.address.toLowerCase() === connectedAddress.toLowerCase()
  }, [activeExternalOwnerWallet?.address, connectedAddress])
  const ownerSignerAddress = connectedAddress ?? activeExternalOwnerWallet?.address ?? null
  const ownerSignerChainId =
    typeof chainId === 'number'
      ? chainId
      : !connectedAddress || activeExternalOwnerWalletMatchesConnectedAddress
        ? parseChainId(activeExternalOwnerWallet?.chainId)
        : null
  const connectedCanonicalWalletSelected = Boolean(
    canonicalCswAddress &&
      ownerSignerAddress &&
      canonicalCswAddress.toLowerCase() === ownerSignerAddress.toLowerCase(),
  )

  const authHeaders = useCallback(
    async (): Promise<Record<string, string>> => {
      const token = await resolvePrivyAccessTokenWithRetry(() => getAccessToken(), {
        attempts: 6,
        delayMs: 200,
      })
      if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')
      return {
        'Content-Type': 'application/json',
        'X-Privy-Token': token,
      }
    },
    [getAccessToken],
  )

  const loadMe = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      // Read unstable objects via refs so the callback does not need them in its dependency array.
      const privyAuthedNow = Boolean(privyRef.current?.authenticated)
      const getAccessTokenNow = typeof privyRef.current?.getAccessToken === 'function'
        ? (privyRef.current.getAccessToken as () => Promise<string | null>)
        : async () => null
      const ensureEmbeddedWalletNow = ensureEmbeddedWalletRef.current

      if (!privyAuthedNow) {
        setMeGuarded(null)
        setZoraStatus(null)
        setLoadingGuarded(false)
        return
      }

      if (options?.showSpinner !== false) {
        setLoadingGuarded(true)
      }
      setErrorGuarded(null)
      try {
        const token = await resolvePrivyAccessTokenWithRetry(getAccessTokenNow, {
          attempts: 8,
          delayMs: 250,
        })
        if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')
        let canonicalization = await runCanonicalizationPipeline({
          privyToken: token,
        })
        if (!canonicalization.onboardingBootstrapped && canonicalization.flags.needsEmbeddedWallet) {
          await ensureEmbeddedWalletNow()
          canonicalization = await runCanonicalizationPipeline({
            privyToken: token,
          })
        }
        const actionableDelegationFlags = deriveOwnerDelegationFlags(canonicalization.flags)
        setOwnerDelegationFlags(actionableDelegationFlags)

        const headers = {
          'Content-Type': 'application/json',
          'X-Privy-Token': token,
        }
        const [meResult, zoraResult] = await Promise.allSettled([
          apiFetch('/api/accounts/me', { method: 'GET', headers }),
          apiFetch('/api/zora/link/status', { method: 'POST', headers, body: JSON.stringify({}) }),
        ])
        if (meResult.status !== 'fulfilled') {
          throw meResult.reason instanceof Error ? meResult.reason : new Error('Failed to load account state.')
        }
        const meRes = meResult.value

        const mePayload = (await meRes.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
        if (!meRes.ok || !mePayload?.success || !mePayload.data) {
          throw new Error(readApiError(mePayload, 'Failed to load account state.'))
        }

        const mergedMe = await mergeAccountMeWithBootstrap(mePayload.data, getAccessTokenNow)
        setMeGuarded(mergedMe)
        if (zoraResult.status !== 'fulfilled') {
          setZoraStatus(null)
        } else {
          const zoraPayload = (await zoraResult.value.json().catch(() => null)) as ApiEnvelope<ZoraLinkStatusResponse> | null
          setZoraStatus(readOptionalZoraStatus({ responseOk: zoraResult.value.ok, payload: zoraPayload }))
        }
      } catch (loadError: any) {
        setErrorGuarded(typeof loadError?.message === 'string' ? loadError.message : 'Failed to load account state.')
      } finally {
        setLoadingGuarded(false)
      }
    },
    // Intentionally stable — all external objects are read via refs inside the callback.
    []
  )

  useEffect(() => {
    if (hasInitialDataRef.current) return
    void loadMe({ showSpinner: true })
  }, [loadMe])

  useEffect(() => {
    if (!shouldRefreshAccountsOnForeground({ privyAuthed, ownerDelegationFlags, advancedBusy })) return

    const refresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      void loadMe({ showSpinner: false })
    }

    const onVisibilityChange = () => refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [advancedBusy, loadMe, ownerDelegationFlags, privyAuthed])

  useEffect(() => {
    let cancelled = false

    if (!canonicalCswAddress) {
      setConnectedOwnerState({ value: null, reason: 'idle' })
      return
    }

    const hasOnchainEoaOwner = cswOwnersState.owners.some(
      (owner) => owner.isAddressOwner && owner.ownerAddress,
    )
    const passkeyOnlyCanonicalCsw =
      cswOwnersState.status === 'ready' && cswOwnersState.owners.length > 0 && !hasOnchainEoaOwner

    if (connectedCanonicalWalletSelected) {
      // Passkey-owned Zora CSWs cannot complete owner install from a desktop
      // browser session — WebAuthn RP IDs are Coinbase-scoped. Steer to Base App
      // or an on-chain EOA owner instead of treating CSW connect as signing-ready.
      if (passkeyOnlyCanonicalCsw && !isMobileWalletEnvironment()) {
        setConnectedOwnerState({ value: null, reason: 'passkey_requires_base_app' })
      } else if (!isMobileWalletEnvironment() && !isBaseAppInAppContext()) {
        // Desktop browsers: the CSW address itself is custody, not an owner signing key.
        setConnectedOwnerState({ value: null, reason: 'csw_not_owner_signer' })
      } else {
        setConnectedOwnerState({ value: true, reason: 'ok' })
      }
      return
    }

    const run = async () => {
      // Read via ref — the effect still legitimately depends on the derived ownerSigner* values,
      // but we avoid putting the wagmi publicClient object itself in the dep array.
      const pc = publicClientRef.current
      const result = await checkEoaOwnershipOfCsw({
        publicClient: pc,
        chainId: ownerSignerChainId,
        cswAddress: canonicalCswAddress,
        ownerAddress: ownerSignerAddress ?? null,
      })
      if (cancelled) return
      setConnectedOwnerState(result)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    canonicalCswAddress,
    connectedCanonicalWalletSelected,
    cswOwnersState.owners,
    cswOwnersState.status,
    ownerSignerAddress,
    ownerSignerChainId,
    // publicClient intentionally omitted — read from ref inside run()
  ])

  const refreshCswOwners = useCallback(async () => {
    if (!canonicalCswAddress) {
      setCswOwnersState({ status: 'idle', owners: [], error: null })
      return
    }

    setCswOwnersState((current) => ({ status: 'loading', owners: current.owners, error: null }))

    try {
      const res = await apiFetch('/api/deploy/smartWalletOwners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smartWallet: canonicalCswAddress }),
      })
      const payload = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
      if (!res.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, 'Failed to load current smart wallet owners.'))
      }
      setCswOwnersState({
        status: 'ready',
        owners: Array.isArray(payload.data.owners) ? payload.data.owners : [],
        error: null,
      })
    } catch (ownerListError: any) {
      setCswOwnersState({
        status: 'error',
        owners: [],
        error:
          typeof ownerListError?.message === 'string'
            ? ownerListError.message
            : 'Failed to load current smart wallet owners.',
      })
    }
  }, [canonicalCswAddress])

  useEffect(() => {
    void refreshCswOwners()
  }, [refreshCswOwners])

  const connectOwnerWallet = useCallback(async () => {
    // Read via refs so we do not close over unstable wagmi/Privy objects.
    const connectWalletNow = connectWallet
    const setActiveWalletNow = activePrivyWalletRef.current
      ? (activePrivyWalletRef.current as any).setActiveWallet ?? setActiveWallet
      : setActiveWallet

    setErrorGuarded(null)
    setNoticeGuarded(null)
    setBusyProviderGuarded('owner_wallet')
    try {
      const walletList = buildOwnerWalletConnectList({
        prefersWalletConnectQr,
      })

      const connectPromise = Promise.resolve(
        connectWalletNow({
          walletList,
          walletChainType: 'ethereum-only',
          description: 'Connect your Base Account or one of the current owners of your Coinbase Smart Wallet on Base.',
        }),
      ).catch((connectError: unknown) => {
        const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
        if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) return null
        throw connectError
      })

      const result = await withOperationTimeout(connectPromise, 25_000, 'Owner wallet connect')
      const selectedWallet =
        result && typeof result === 'object' && 'wallet' in (result as Record<string, unknown>)
          ? ((result as { wallet?: unknown }).wallet ?? null)
          : result ?? null
      if (selectedWallet && typeof setActiveWalletNow === 'function') {
        await Promise.resolve(setActiveWalletNow(selectedWallet)).catch(() => null)
      }
      await sleep(120)
    } catch (connectError: any) {
      setErrorGuarded(mapOwnerWalletConnectError(connectError))
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [connectWallet, prefersWalletConnectQr, setActiveWallet])

  const callLinkEndpoint = useCallback(
    async (provider: string, value?: string | null) => {
      const headers = await authHeaders()
      const response = await apiFetch('/api/accounts/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, value: value ?? null }),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, `Failed to link ${provider}.`))
      }
      setMeGuarded(payload.data)
      setNoticeGuarded(`${provider.replace(/_/g, ' ')} linked.`)
    },
    [authHeaders],
  )

  const callUnlinkEndpoint = useCallback(
    async (provider: string, value?: string | null) => {
      const headers = await authHeaders()
      const response = await apiFetch('/api/accounts/unlink', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, value: value ?? null }),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, `Failed to unlink ${provider}.`))
      }
      setMeGuarded(payload.data)
      setNoticeGuarded(`${provider.replace(/_/g, ' ')} unlinked in 4626.`)
    },
    [authHeaders],
  )

  const resolveZoraReadOnlySignals = useCallback(
    async (headers: Record<string, string>) => {
      const response = await withOperationTimeout(
        apiFetch('/api/zora/resolve', {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        }),
        15_000,
        'Zora signal resolve',
      )
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, 'Failed to resolve Zora signals.'))
      }
      return payload.data
    },
    [],
  )

  const performClientSideLink = useCallback(
    async (provider: string) => {
      if (provider === 'zora_cross_app') {
        // Read-only mode: no Privy cross-app linking for Zora.
        return
      }

      if (provider === 'external_eoa') {
        const called = await maybeCallMethod(privy, ['linkWallet'])
        if (!called && typeof login === 'function') {
          await login({ loginMethods: ['wallet'] } as any)
        }
        return
      }

      if (provider === 'telegram') {
        const launchParams = readPrivyTelegramLaunchParams()
        if (!launchParams?.initDataRaw) {
          throw new Error('Telegram linking must start from Telegram. Run /link in the bot, then open the Mini App.')
        }
        const calledWithLaunchParams = await maybeCallMethod(privy, ['linkTelegram'], [{ launchParams }])
        if (!calledWithLaunchParams) {
          throw new Error('Telegram linking is unavailable in this client. Re-open from Telegram and retry.')
        }
        return
      }

      const linkMethods: Record<string, string[]> = {
        email: ['linkEmail', 'linkEmailAccount'],
        google: ['linkGoogle', 'linkGoogleAccount'],
        apple: ['linkApple', 'linkAppleAccount'],
        twitter: ['linkTwitter', 'linkTwitterAccount'],
        telegram: ['linkTelegram'],
        tiktok: ['linkTiktok', 'linkTikTok', 'linkTiktokAccount', 'linkTikTokAccount'],
        external_eoa: ['linkWallet'],
        zora_cross_app: [],
      }
      const called = await maybeCallMethod(privy, linkMethods[provider] ?? [])
      if (!called && typeof login === 'function') {
        if (provider === 'email') {
          await login({ loginMethods: ['email'] } as any)
        } else {
          throw new Error(`${provider.replace(/_/g, ' ')} linking is unavailable in this client.`)
        }
      }
    },
    [login, privy],
  )

  const performClientSideUnlink = useCallback(async (provider: string, value?: string | null) => {
    const unlinkMethods: Record<string, string[]> = {
      email: ['unlinkEmail', 'unlinkEmailAccount'],
      google: ['unlinkGoogle', 'unlinkGoogleAccount'],
      apple: ['unlinkApple', 'unlinkAppleAccount'],
      twitter: ['unlinkTwitter', 'unlinkTwitterAccount'],
      telegram: ['unlinkTelegram'],
      tiktok: ['unlinkTiktok', 'unlinkTikTok', 'unlinkTiktokAccount', 'unlinkTikTokAccount'],
      external_eoa: ['unlinkWallet'],
      zora_cross_app: [],
    }
    await maybeCallMethod(privy, unlinkMethods[provider] ?? [], value ? [{ value }] : [])
  }, [privy])

  const onLinkProvider = useCallback(async (provider: string) => {
    // Read via ref; guarded sets for the long link flow.
    const privyAuthedNow = Boolean(privyRef.current?.authenticated)
    if (!privyAuthedNow) return
    setBusyProviderGuarded(provider)
    setErrorGuarded(null)
    setNoticeGuarded(null)
    try {
      if (provider === 'zora_cross_app') {
        let crossAppAuthCompleted = false
        let crossAppAuthFallbackMessage: string | null = null
        if (readZoraCrossAppBackoff()) {
          crossAppAuthFallbackMessage =
            'Zora OAuth was unstable in this browser. Checking existing Zora read-only signals instead.'
        } else {
          try {
            await withOperationTimeout(
              performZoraCrossAppAuth({
                privyAuthed: Boolean(privyRef.current?.authenticated),
                appId: ZORA_PRIVY_APP_ID,
                linkCrossAppAccount,
                loginWithCrossAppAccount,
              }),
              20_000,
              'Zora cross-app auth',
            )
            crossAppAuthCompleted = true
            writeZoraCrossAppBackoff(false)
          } catch (zoraAuthError: unknown) {
            const message =
              typeof (zoraAuthError as { message?: unknown })?.message === 'string'
                ? String((zoraAuthError as { message: string }).message)
                : ''
            if (isUserRejectedCrossAppAuthError(zoraAuthError)) {
              crossAppAuthFallbackMessage = 'Zora auth canceled. Checking your existing Zora read-only signals instead.'
            } else if (isInjectedWalletCollisionMessage(message)) {
              // Injected wallet-extension collision is cosmetic environment noise.
              // Degrade to read-only signal detection without flipping the
              // Zora-OAuth backoff (the OAuth path itself was not unstable).
              console.info('[auth-repair]', { surface: 'zora', transition: 'collision-degrade', outcome: 'transient' })
              crossAppAuthFallbackMessage =
                'Could not complete Zora OAuth in this browser. Checking existing Zora read-only signals instead.'
            } else if (
              isRecoverableCrossAppAuthError(zoraAuthError) ||
              message.toLowerCase().includes('timed out') ||
              message.toLowerCase().includes('authentication failed')
            ) {
              writeZoraCrossAppBackoff(true)
              crossAppAuthFallbackMessage =
                'Could not complete Zora OAuth in this browser. Checking existing Zora read-only signals instead.'
            } else {
              throw zoraAuthError
            }
          }
        }

        const headers = await authHeaders()
        const resolvedSignals = await resolveZoraReadOnlySignals(headers)
        const hasSignals = hasResolvedZoraSignals(resolvedSignals)
        if (hasSignals) {
          setNoticeGuarded(crossAppAuthFallbackMessage ?? 'Zora read-only signals detected.')
        } else {
          setNoticeGuarded(
            crossAppAuthFallbackMessage ??
              (crossAppAuthCompleted
                ? 'No Zora read-only signals found yet. Open your Zora profile once, then retry detection.'
                : 'Zora auth did not complete and no existing signals were found yet. Open your Zora profile once, then retry detection.'),
          )
        }
        await loadMe({ showSpinner: false })
        return
      }
      await performClientSideLink(provider)
      if (provider === 'external_eoa') {
        let linked = false
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            await callLinkEndpoint(provider)
            linked = true
            break
          } catch (linkError: any) {
            const message = typeof linkError?.message === 'string' ? linkError.message : ''
            if (!/No linked value found for provider "external_eoa"\./i.test(message)) {
              throw linkError
            }
            await sleep(500)
          }
        }
        if (!linked) {
          await loadMe({ showSpinner: false })
          throw new Error(
            'External wallet link is still syncing. Connect Base App (or your external wallet) again and retry in a moment.',
          )
        }
      } else {
        await callLinkEndpoint(provider)
      }
      await loadMe({ showSpinner: false })
    } catch (linkError: any) {
      if (provider === 'zora_cross_app') {
        setErrorGuarded(
          typeof linkError?.message === 'string'
            ? linkError.message
            : 'Failed to resolve Zora read-only signals.',
        )
      } else {
        setErrorGuarded(typeof linkError?.message === 'string' ? linkError.message : `Failed to link ${provider}.`)
      }
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [authHeaders, callLinkEndpoint, loadMe, performClientSideLink, resolveZoraReadOnlySignals, linkCrossAppAccount, loginWithCrossAppAccount])

  const onUnlinkProvider = useCallback(async (provider: string) => {
    const privyAuthedNow = Boolean(privyRef.current?.authenticated)
    if (!privyAuthedNow) return
    setBusyProviderGuarded(provider)
    setErrorGuarded(null)
    setNoticeGuarded(null)
    try {
      const currentValue = selectLinkedValues(me, provider)[0] ?? null
      await performClientSideUnlink(provider, currentValue)
      await callUnlinkEndpoint(provider, currentValue)
      await loadMe({ showSpinner: false })
    } catch (unlinkError: any) {
      setErrorGuarded(typeof unlinkError?.message === 'string' ? unlinkError.message : `Failed to unlink ${provider}.`)
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [callUnlinkEndpoint, loadMe, me, performClientSideUnlink, privyAuthed])

  const onLinkZora = useCallback(async () => {
    setBusyProviderGuarded('zora_cross_app')
    setErrorGuarded(null)
    setNoticeGuarded(null)
    try {
      const headers = await authHeaders()
      const resolvedSignals = await resolveZoraReadOnlySignals(headers)
      setNoticeGuarded(
        hasResolvedZoraSignals(resolvedSignals)
          ? 'Zora read-only signals detected.'
          : 'No Zora read-only signals found yet. Open your Zora profile once, then retry detection.',
      )
      await loadMe({ showSpinner: false })
    } catch (zoraError: any) {
      if (isUserRejectedCrossAppAuthError(zoraError)) {
        setNoticeGuarded('Zora read-only detection canceled.')
        return
      }
      setErrorGuarded(
        typeof zoraError?.message === 'string'
          ? zoraError.message
          : 'Failed to resolve Zora read-only signals.',
      )
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [authHeaders, loadMe, resolveZoraReadOnlySignals])

  const onRefreshZora = useCallback(async () => {
    setBusyProviderGuarded('zora_cross_app')
    setErrorGuarded(null)
    setNoticeGuarded(null)
    try {
      const headers = await authHeaders()
      const response = await withOperationTimeout(
        apiFetch('/api/zora/refresh', {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        }),
        15_000,
        'Zora signal refresh',
      )
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, 'Failed to refresh Zora signals.'))
      }
      const refreshLimited = response.headers.get('X-Zora-Refresh-Limited') === '1'
      setNoticeGuarded(refreshLimited ? 'Zora refresh is rate-limited. Using your latest saved signals.' : 'Zora signals refreshed.')
      await loadMe({ showSpinner: false })
    } catch (refreshError: any) {
      setErrorGuarded(typeof refreshError?.message === 'string' ? refreshError.message : 'Failed to refresh Zora signals.')
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [authHeaders, loadMe])

  const onSwitchAccount = useCallback(async () => {
    // Read logout via ref so the callback stays stable.
    const privyNow = privyRef.current
    setBusyProviderGuarded('email')
    setErrorGuarded(null)
    setNoticeGuarded(null)
    try {
      await runWaitlistPrivyLogout({
        logout: async () => {
          await (privyNow?.logout ? privyNow.logout().catch(() => null) : Promise.resolve())
        },
        readToken: typeof privyNow?.getAccessToken === 'function' ? (() => privyNow.getAccessToken()) : undefined,
        shouldLogout: true,
      })
      if (typeof window !== 'undefined') {
        window.location.assign('/waitlist')
      }
    } catch (switchError: any) {
      setErrorGuarded(typeof switchError?.message === 'string' ? switchError.message : 'Failed to switch account.')
    } finally {
      setBusyProviderGuarded(null)
    }
  }, [])

  const sendPreparedOwnerTx = useCallback(async () => {
    throw new Error(
      'User owner-mutation setup is paused. Use /swap with an external wallet (EOA mode), or wait for wallet onboarding to return.',
    )
  }, [])

  const onchainEoaOwnerCandidates = useMemo(
    () =>
      cswOwnersState.owners
        .filter((owner) => owner.isAddressOwner && owner.ownerAddress)
        .map((owner) => ({
          index: owner.index,
          ownerAddress: getAddress(owner.ownerAddress as `0x${string}`) as `0x${string}`,
        })),
    [cswOwnersState.owners],
  )
  const connectedOnchainEoaOwner = useMemo(() => {
    if (!connectedAddress) return null
    const lower = connectedAddress.toLowerCase()
    return onchainEoaOwnerCandidates.find((c) => c.ownerAddress.toLowerCase() === lower) ?? null
  }, [connectedAddress, onchainEoaOwnerCandidates])
  const passkeyOnlyCanonicalCsw = useMemo(
    () =>
      Boolean(
        canonicalCswAddress &&
          cswOwnersState.status === 'ready' &&
          cswOwnersState.owners.length > 0 &&
          onchainEoaOwnerCandidates.length === 0,
      ),
    [canonicalCswAddress, cswOwnersState.owners.length, cswOwnersState.status, onchainEoaOwnerCandidates.length],
  )
  const requiresBaseAppForOwnerInstall = useMemo(
    () => passkeyOnlyCanonicalCsw && !isMobileWalletEnvironment() && !connectedOnchainEoaOwner,
    [connectedOnchainEoaOwner, passkeyOnlyCanonicalCsw],
  )

  const submitOwnerInstallViaOnchainEoa = useCallback(
    async (txRequest: PreparedOwnerTxRequest): Promise<`0x${string}`> => {
      if (!canonicalCswAddress) {
        throw new Error('No canonical Coinbase Smart Wallet selected.')
      }
      if (!connectedOnchainEoaOwner) {
        const expected = onchainEoaOwnerCandidates.map((c) => c.ownerAddress).join(', ')
        throw new Error(
          expected
            ? `Connect one of these on-chain EOA owners to use this lane: ${expected}.`
            : 'No on-chain EOA owners are available on this Coinbase Smart Wallet.',
        )
      }
      if (txRequest.to.toLowerCase() !== canonicalCswAddress.toLowerCase()) {
        throw new Error('Prepared transaction target does not match the canonical Coinbase Smart Wallet.')
      }

      const ownerLower = connectedOnchainEoaOwner.ownerAddress.toLowerCase()
      const signerConnection = wagmiConnections.find((conn) =>
        conn.accounts.some((acct) => String(acct).toLowerCase() === ownerLower),
      )
      if (!signerConnection) {
        throw new Error(
          `No connected wagmi account matches on-chain EOA owner ${connectedOnchainEoaOwner.ownerAddress}. ` +
            'Connect that wallet directly and retry.',
        )
      }
      const signerProvider = (await (signerConnection.connector as { getProvider?: () => Promise<unknown> })
        .getProvider?.()) as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null
      if (!signerProvider || typeof signerProvider.request !== 'function') {
        throw new Error('EOA-owner connector does not expose a request() surface for personal_sign.')
      }
      const signerRequest = async (args: { method: string; params?: unknown[] }) =>
        await signerProvider.request!(args)

      const isCoinbaseLikeConnector = (connectorId: unknown): boolean => {
        const id = String(connectorId ?? '').toLowerCase()
        return id === 'coinbasewalletsdk' || id === 'base-account' || id.includes('coinbase')
      }
      let cswRequest: typeof signerRequest = signerRequest
      if (!isCoinbaseLikeConnector(signerConnection.connector?.id)) {
        const coinbaseConnection = wagmiConnections.find((conn) =>
          isCoinbaseLikeConnector(conn.connector?.id),
        )
        if (coinbaseConnection) {
          const coinbaseProvider = (await (coinbaseConnection.connector as {
            getProvider?: () => Promise<unknown>
          }).getProvider?.()) as
            | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
            | null
          if (coinbaseProvider && typeof coinbaseProvider.request === 'function') {
            cswRequest = async (args: { method: string; params?: unknown[] }) =>
              await coinbaseProvider.request!(args)
          }
        }
      }

      if (chainId !== base.id && typeof switchChainAsync === 'function') {
        await switchChainAsync({ chainId: base.id })
      }
      const paymasterUrl = resolveDirectPreparedCallsPaymasterUrl()
      if (!paymasterUrl) {
        throw new Error(
          'Sponsored owner approval requires `VITE_CDP_SENDCALLS_PAYMASTER_URL` to be set to a direct CDP RPC URL.',
        )
      }

      return await submitOwnerViaPreparedCallsWithEoaOwner({
        cswRequest,
        signerRequest,
        eoaOwnerAddress: connectedOnchainEoaOwner.ownerAddress,
        eoaOwnerIndex: connectedOnchainEoaOwner.index,
        chainId: base.id,
        sender: canonicalCswAddress as `0x${string}`,
        to: txRequest.to,
        data: txRequest.data,
        paymasterUrl,
      })
    },
    [
      canonicalCswAddress,
      chainId,
      connectedOnchainEoaOwner,
      onchainEoaOwnerCandidates,
      switchChainAsync,
      wagmiConnections,
    ],
  )

  const retryOwnerCheck = useCallback(async () => {
    if (!canonicalCswAddress) return
    const pc = publicClientRef.current
    const result = await checkEoaOwnershipOfCsw({
      publicClient: pc,
      chainId: ownerSignerChainId,
      cswAddress: canonicalCswAddress,
      ownerAddress: ownerSignerAddress ?? null,
    })
    setConnectedOwnerState(result)
  }, [canonicalCswAddress, ownerSignerAddress, ownerSignerChainId])

  const onResetOwnerApproval = useCallback(async () => {
    ownerApprovalRunIdRef.current += 1
    setAdvancedBusy(false)
    setErrorGuarded(null)
    setNoticeGuarded(null)
    setConnectedOwnerState({ value: null, reason: 'idle' })
    setOwnerDelegationFlags(null)

    // Also clear any pending modern owner install state on explicit reset
    // (symmetry with the auto-clear we added on successful completion).
    setPendingOwnerInstallHashGuarded(null)
    setOwnerInstallPhaseGuarded(null)

    await retryOwnerCheck()
    setNoticeGuarded('Signing state reset. Reconnect or switch owner wallet if needed.')
  }, [retryOwnerCheck, setPendingOwnerInstallHashGuarded, setOwnerInstallPhaseGuarded])

  const onAddRabbyCoOwner = useCallback(async (_advancedOwnerAddress: string) => {
    setError(
      'Add co-owner setup is paused. Use /swap with an external wallet (EOA mode), or wait for wallet onboarding to return.',
    )
  }, [])

  const zoraHandoffUrl = useMemo(
    () => buildZoraHandoffUrl({ returnPath: params.zoraReturnPath ?? '/accounts', context: 'signup' }),
    [params.zoraReturnPath],
  )
  const zoraCrossAppCount = zoraStatus?.zoraCrossAppAccounts?.length ?? 0
  const canShowAdvanced = Boolean(canonicalCswAddress)
  const baseAppUrl = ownerDelegationFlags?.baseAppUrl ?? null
  const needsBaseAppSetup = Boolean(ownerDelegationFlags?.needsBaseAppSetup)
  const needsEmbeddedWallet = Boolean(ownerDelegationFlags?.needsEmbeddedWallet)
  const connectedOwnerReady = connectedOwnerState.value === true
  const signerClientReady = Boolean(
    walletClient?.account &&
      (typeof walletClient?.sendTransaction === 'function' || typeof (walletClient as any)?.request === 'function'),
  )
  const privySignerClientReady = Boolean(
    activeExternalOwnerWallet &&
      ownerSignerAddress &&
      (!connectedAddress || activeExternalOwnerWalletMatchesConnectedAddress),
  )
  const ownerApprovalReady = connectedOwnerReady && (signerClientReady || privySignerClientReady) && !needsEmbeddedWallet

  // When a modern owner install (Base App self-call path) is actively running,
  // surface this so the waitlist accordion and other surfaces can show consistent
  // "in progress" language instead of offering to start the same operation again.
  const ownerInstallInProgress = Boolean(pendingOwnerInstallHash) || (ownerInstallPhase != null && ownerInstallPhase !== 'idle')
  const ownerAuthorityState = useMemo(
    () =>
      deriveOwnerAuthorityState({
        canonicalCswAddress,
        connectedAddress: ownerSignerAddress,
        connectedCanonicalWalletSelected,
        connectedOwnerState,
      }),
    [canonicalCswAddress, connectedCanonicalWalletSelected, connectedOwnerState, ownerSignerAddress],
  )
  const connectedSignerLabel = ownerSignerAddress ? shortValue(ownerSignerAddress) : 'No wallet connected'
  const connectedSignerDetail = ownerApprovalReady
    ? 'On-chain owner connected. Enable 4626 signing when your embedded signer is not yet installed.'
    : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
      ? 'Wallet connection is still finishing. Wait for the signer session to hydrate.'
      : ownerAuthorityState.detail
  const readableCswOwners = useMemo(
    () => cswOwnersState.owners.filter((owner) => owner.ownerAddress),
    [cswOwnersState.owners],
  )
  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const providerCards = useMemo(() => {
    return PROVIDER_ROWS.map((row) => {
      const values = selectLinkedValues(me, row.provider)
      return { ...row, values, linked: values.length > 0 }
    })
  }, [me])
  const ownerChecklist = useMemo<OwnerChecklistItem[]>(
    () => [
      {
        title: 'Connect owner',
        description: ownerSignerAddress
          ? `Wallet ${shortValue(ownerSignerAddress)} is connected.`
          : 'Connect one of the current CSW owners.',
        state: ownerSignerAddress ? 'complete' : 'active',
      },
      {
        title: 'Verify authority',
        description: ownerAuthorityState.hint,
        state: connectedOwnerReady ? 'complete' : ownerSignerAddress ? 'active' : 'blocked',
      },
      {
        title: 'Wallet signing',
        description: ownerInstallInProgress
          ? ownerInstallPhase === 'awaiting_signature'
            ? 'Confirm the request in Base App. This can take up to 3 minutes.'
            : 'Owner install running — waiting for signature or bundle confirmation.'
          : ownerApprovalReady
            ? 'Run Enable 4626 signing to add your embedded signer as a CSW owner.'
            : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
              ? 'Wait for the signer client to finish hydrating.'
              : 'Connect and verify a current CSW owner first.',
        state: ownerInstallInProgress ? 'active' : connectedOwnerReady ? 'active' : 'blocked',
      },
    ],
    [
      connectedOwnerReady,
      ownerApprovalReady,
      ownerAuthorityState.hint,
      ownerSignerAddress,
      privySignerClientReady,
      signerClientReady,
      ownerInstallInProgress,
      ownerInstallPhase,
    ],
  )
  const ownerPrimaryCtaLabel = ownerInstallInProgress
    ? ownerInstallPhase === 'awaiting_signature'
      ? 'Waiting for Base App signature…'
      : 'Owner install in progress…'
    : ownerApprovalReady
      ? 'Ready to enable signing'
      : needsEmbeddedWallet
        ? 'Provisioning embedded wallet…'
        : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
          ? 'Finishing wallet session…'
          : 'Connect owner wallet'

  // Global auto-clear of pending owner install state once the step is complete.
  // This prevents stale "Waiting for signature…" banners and in-progress labels
  // after a successful modern Base App owner install (or any other path that
  // results in the embedded EOA becoming an on-chain owner).
  useEffect(() => {
    if (ownerInstallInProgress && ownerApprovalReady) {
      setPendingOwnerInstallHashGuarded(null);
      setOwnerInstallPhaseGuarded(null);
    }
  }, [ownerInstallInProgress, ownerApprovalReady, setPendingOwnerInstallHashGuarded, setOwnerInstallPhaseGuarded]);

  useEffect(() => {
    if (!ownerInstallResumeState.requested) return
    const section = ownerInstallSectionRef.current
    if (!section) return
    const timer = window.setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      section.focus({ preventScroll: true })
    }, 120)
    return () => {
      window.clearTimeout(timer)
    }
  }, [canonicalCswAddress, ownerApprovalReady, ownerInstallResumeState.requested])

  return {
    activePrivyWallet,
    activeExternalOwnerWallet,
    advancedBusy,
    authHeaders,
    baseAppUrl,
    busyProvider,
    canShowAdvanced,
    canonicalCswAddress,
    chainId,
    connectedAddress,
    connectedCanonicalWalletSelected,
    connectedOwnerReady,
    connectedOwnerState,
    connectedSignerDetail,
    connectedSignerLabel,
    connectOwnerWallet,
    connectWallet,
    cswOwnersState,
    ensureEmbeddedWallet,
    error,
    getAccessToken,
    inTelegramMiniApp,
    linkCrossAppAccount,
    loadMe,
    loading,
    login,
    loginWithCrossAppAccount,
    me,
    needsBaseAppSetup,
    needsEmbeddedWallet,
    notice,
    onLinkProvider,
    onLinkZora,
    onUnlinkProvider,
    onRefreshZora,
    onResetOwnerApproval,
    onSwitchAccount,
    onAddRabbyCoOwner,
    onchainEoaOwnerCandidates,
    connectedOnchainEoaOwner,
    ownerApprovalReady,
    ownerAuthorityState,
    ownerChecklist,
    ownerDelegationFlags,
    ownerInstallResumeState,
    ownerInstallSectionRef,
    pendingOwnerInstallHash,
    setPendingOwnerInstallHash: setPendingOwnerInstallHashGuarded,
    ownerInstallPhase,
    setOwnerInstallPhase: setOwnerInstallPhaseGuarded,
    ownerInstallInProgress,
    ownerPrimaryCtaLabel,
    ownerSignerAddress,
    ownerSignerChainId,
    prefersWalletConnectQr,
    privy,
    privyAuthed,
    privySignerClientReady,
    privyWallets,
    providerCollision,
    providerCards,
    publicClient,
    refreshCswOwners,
    requiresBaseAppForOwnerInstall,
    readableCswOwners,
    retryOwnerCheck,
    sendPreparedOwnerTx,
    submitOwnerInstallViaOnchainEoa,
    setAdvancedBusy,
    setBusyProvider,
    setConnectedOwnerState,
    setError,
    setMe,
    setNotice,
    setOwnerDelegationFlags,
    setZoraStatus,
    // Explicit guarded variants (stable during long flows; prefer these from waitlist/setup UI)
    setMeGuarded,
    setLoadingGuarded,
    setBusyProviderGuarded,
    setErrorGuarded,
    setNoticeGuarded,
    signerClientReady,
    switchChainAsync,
    telegramLaunchParamsAvailable,
    walletClient,
    zoraCrossAppCount,
    zoraHandoffUrl,
    zoraLinked,
    zoraStatus,
  }
}
