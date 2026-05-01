import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveWallet, useConnectWallet, useCrossAppAccounts, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, formatEther, getAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import { trackEvent } from '@/lib/analytics/analytics'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { logger } from '@/lib/observability/logger'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { extractPrivyWalletsFromUser, useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { isUnauthorizedCrossAppLinkError, performZoraCrossAppAuth } from '@/lib/privy/zoraCrossApp'
import { isTelegramMiniAppContext, readPrivyTelegramLaunchParams } from '@/lib/telegram/telegramWebApp'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import {
  type ApiEnvelope,
  type OnboardingBootstrapResponse,
  type OwnerInstallIntent,
  type OwnerDelegationFlags,
  type OwnerApprovalStageEvent,
  type PrepareOwnerResponse,
  type PreparedOwnerTxRequest,
  buildOwnerDelegationError,
  deriveOwnerDelegationFlags,
  readApiError,
  sendPreparedOwnerTx as submitPreparedOwnerTx,
  shouldRefreshOwnerDelegationOnForeground,
} from '@/lib/wallet/onboardingWallet'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { ensureWalletAlignedPaymasterSessionDetailed } from '@/lib/paymaster/paymasterSession'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'
import { selectCrossAppAuthAction } from '@/features/waitlist/crossAppWalletUtils'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { checkEoaOwnershipOfCsw } from '@/wallet/accountContext/ownership'

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

async function getPrivyEthereumProvider(wallet: any): Promise<any | null> {
  if (!wallet) return null
  if (wallet?.provider && typeof wallet.provider.request === 'function') return wallet.provider
  if (typeof wallet.getEthereumProvider === 'function') {
    const provider = await wallet.getEthereumProvider().catch(() => null)
    if (provider && typeof provider.request === 'function') return provider
  }
  if (typeof wallet.request === 'function') {
    return { request: wallet.request.bind(wallet) }
  }
  return null
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

type OwnerInstallGasPreflight = {
  payerAddress: `0x${string}`
  estimatedGas: bigint
  maxFeePerGas: bigint
  requiredWei: bigint
  balanceWei: bigint
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

function useSafeWallets() {
  try {
    return useWallets() as any
  } catch {
    return { wallets: [] } as any
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
  const { wallets: privyLiveWallets } = useSafeWallets()
  const siwe = useSiweAuth()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address: connectedAddress, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const ownerInstallSectionRef = useRef<HTMLElement | null>(null)
  const hasInitialDataRef = useRef(Boolean(params.initialData))
  const ownerApprovalRunIdRef = useRef(0)

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

  const [advancedBusy, setAdvancedBusy] = useState(false)
  const [ownerDelegationFlags, setOwnerDelegationFlags] = useState<OwnerDelegationFlags | null>(null)
  const [connectedOwnerState, setConnectedOwnerState] = useState<ConnectedOwnerState>({ value: null, reason: 'idle' })
  const [cswOwnersState, setCswOwnersState] = useState<CswOwnersState>({ status: 'idle', owners: [], error: null })
  const [ownerInstallIntent, setOwnerInstallIntent] = useState<OwnerInstallIntent>('embeddedOwner')
  const [customOwnerGasPreflight, setCustomOwnerGasPreflight] = useState<OwnerInstallGasPreflight | null>(null)
  const [customOwnerPreparedTxRequest, setCustomOwnerPreparedTxRequest] = useState<PreparedOwnerTxRequest | null>(null)
  const [customOwnerPreparedAddress, setCustomOwnerPreparedAddress] = useState<string | null>(null)

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
  const shouldUsePrivyExternalOwnerWallet = Boolean(
    activeExternalOwnerWallet &&
      ownerSignerAddress &&
      (!connectedAddress || activeExternalOwnerWalletMatchesConnectedAddress),
  )
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
      const token = await getAccessToken()
      if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')
      return {
        'Content-Type': 'application/json',
        'X-Privy-Token': token,
      }
    },
    [getAccessToken],
  )

  const postOnboardingBootstrap = useCallback(
    async (
      headers: Record<string, string>,
    ): Promise<{ response: Response; payload: ApiEnvelope<OnboardingBootstrapResponse> | null }> => {
      const response = await apiFetch('/api/onboarding/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<OnboardingBootstrapResponse> | null
      return { response, payload }
    },
    [],
  )

  const runOnboardingBootstrapPreflight = useCallback(async (): Promise<{
    headers: Record<string, string>
    response: Response
    payload: ApiEnvelope<OnboardingBootstrapResponse> | null
  }> => {
    let headers = await authHeaders()
    let { response, payload } = await postOnboardingBootstrap(headers)
    if ((!response.ok || !payload?.success) && response.status === 401) {
      await sleep(150)
      headers = await authHeaders()
      const retry = await postOnboardingBootstrap(headers)
      response = retry.response
      payload = retry.payload
    }
    return { headers, response, payload }
  }, [authHeaders, postOnboardingBootstrap])

  const ensurePaymasterSession = useCallback(async (): Promise<boolean> => {
    const result = await ensureWalletAlignedPaymasterSessionDetailed({
      hasMatchingSiweSession: Boolean(siwe.hasSession),
      preferWalletSession: true,
      allowPrivyBridgeFallback: false,
      signIn:
        typeof siwe.signIn === 'function'
          ? async () =>
              await siwe.signIn({
                method: 'siwe',
              })
          : null,
      signInWithPrivyToken:
        typeof siwe.signInWithPrivyToken === 'function' ? siwe.signInWithPrivyToken : null,
      getPrivyAccessToken: getAccessToken,
    })
    if (result.ok) return true
    const reason = result.reason ?? 'unknown_session_bootstrap_failure'
    throw new Error(`Paymaster session bootstrap failed: ${reason}`)
  }, [getAccessToken, siwe])

  const emitOwnerApprovalStageEvent = useCallback(
    (event: OwnerApprovalStageEvent) => {
      const payload = {
        runId: event.runId,
        stage: event.stage,
        status: event.status,
        attempt: event.attempt ?? null,
        executionMode: event.executionMode,
        signerAddress: event.signerAddress ?? null,
        canonicalCswAddress: event.canonicalCswAddress ?? null,
        txHash: event.txHash ?? null,
        code: event.code ?? null,
        message: event.message ?? null,
      }
      trackEvent('owner_approval_stage', payload)
      logger.info('[OwnerApproval] stage', payload)
    },
    [],
  )

  const loadMe = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (!privyAuthed) {
        setMe(null)
        setZoraStatus(null)
        setLoading(false)
        return
      }

      if (options?.showSpinner !== false) {
        setLoading(true)
      }
      setError(null)
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('Missing Privy auth token. Sign in and retry.')
        let canonicalization = await runCanonicalizationPipeline({
          privyToken: token,
        })
        if (!canonicalization.onboardingBootstrapped && canonicalization.flags.needsEmbeddedWallet) {
          await ensureEmbeddedWallet()
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

        setMe(mePayload.data)
        if (zoraResult.status !== 'fulfilled') {
          setZoraStatus(null)
        } else {
          const zoraPayload = (await zoraResult.value.json().catch(() => null)) as ApiEnvelope<ZoraLinkStatusResponse> | null
          setZoraStatus(readOptionalZoraStatus({ responseOk: zoraResult.value.ok, payload: zoraPayload }))
        }
      } catch (loadError: any) {
        setError(typeof loadError?.message === 'string' ? loadError.message : 'Failed to load account state.')
      } finally {
        setLoading(false)
      }
    },
    [ensureEmbeddedWallet, getAccessToken, privyAuthed],
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

    if (connectedCanonicalWalletSelected) {
      setConnectedOwnerState({ value: true, reason: 'ok' })
      return
    }

    const run = async () => {
      const result = await checkEoaOwnershipOfCsw({
        publicClient,
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
  }, [canonicalCswAddress, connectedCanonicalWalletSelected, ownerSignerAddress, ownerSignerChainId, publicClient])

  useEffect(() => {
    let cancelled = false

    if (!canonicalCswAddress) {
      setCswOwnersState({ status: 'idle', owners: [], error: null })
      return
    }

    setCswOwnersState((current) => ({ status: 'loading', owners: current.owners, error: null }))

    const run = async () => {
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
        if (cancelled) return
        setCswOwnersState({
          status: 'ready',
          owners: Array.isArray(payload.data.owners) ? payload.data.owners : [],
          error: null,
        })
      } catch (ownerListError: any) {
        if (cancelled) return
        setCswOwnersState({
          status: 'error',
          owners: [],
          error:
            typeof ownerListError?.message === 'string'
              ? ownerListError.message
              : 'Failed to load current smart wallet owners.',
        })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress])

  const connectOwnerWallet = useCallback(async () => {
    setError(null)
    setNotice(null)
    setBusyProvider('owner_wallet')
    try {
      const result = await Promise.resolve(
        connectWallet({
          walletList: [
            'coinbase_wallet',
            'base_account',
            prefersWalletConnectQr ? 'wallet_connect_qr' : 'wallet_connect',
            'detected_ethereum_wallets',
            'metamask',
          ],
          walletChainType: 'ethereum-only',
          description: 'Connect your Base Account or one of the current owners of your Coinbase Smart Wallet on Base.',
        }),
      ).catch((connectError: unknown) => {
        const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
        if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) return null
        throw connectError
      })
      const selectedWallet =
        result && typeof result === 'object' && 'wallet' in (result as Record<string, unknown>)
          ? ((result as { wallet?: unknown }).wallet ?? null)
          : result ?? null
      if (selectedWallet && typeof setActiveWallet === 'function') {
        await Promise.resolve(setActiveWallet(selectedWallet)).catch(() => null)
      }
      await sleep(120)
    } catch (connectError: any) {
      setError(typeof connectError?.message === 'string' ? connectError.message : 'Failed to connect owner wallet.')
    } finally {
      setBusyProvider(null)
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
      setMe(payload.data)
      setNotice(`${provider.replace(/_/g, ' ')} linked.`)
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
      setMe(payload.data)
      setNotice(`${provider.replace(/_/g, ' ')} unlinked in 4626.`)
    },
    [authHeaders],
  )

  const performClientSideLink = useCallback(
    async (provider: string) => {
      if (provider === 'zora_cross_app') {
        const action = selectCrossAppAuthAction({
          privyAuthed,
          linkCrossAppAccount,
          loginWithCrossAppAccount,
        })
        if (!action) throw new Error('Zora linking is unavailable in this client.')
        await performZoraCrossAppAuth({
          privyAuthed,
          appId: ZORA_PRIVY_APP_ID,
          linkCrossAppAccount,
          loginWithCrossAppAccount,
          sanitizeRedirect: sanitizeCrossAppRedirectUrlForAuth,
          isRedirectUrlNotAllowedError: isPrivyRedirectUrlNotAllowedError,
        })
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
    [linkCrossAppAccount, login, loginWithCrossAppAccount, privy, privyAuthed],
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
    if (!privyAuthed) return
    setBusyProvider(provider)
    setError(null)
    setNotice(null)
    try {
      await performClientSideLink(provider)
      if (provider === 'external_eoa') {
        let linked = false
        let lastError: Error | null = null
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
            lastError = linkError instanceof Error ? linkError : new Error(message)
            await sleep(500)
          }
        }
        if (!linked) {
          await loadMe({ showSpinner: false })
          throw (
            lastError ??
            new Error('No external owner wallet was linked in Privy yet. Connect a real Base wallet and retry.')
          )
        }
      } else {
        await callLinkEndpoint(provider)
      }
      await loadMe({ showSpinner: false })
    } catch (linkError: any) {
      setError(typeof linkError?.message === 'string' ? linkError.message : `Failed to link ${provider}.`)
    } finally {
      setBusyProvider(null)
    }
  }, [callLinkEndpoint, loadMe, performClientSideLink, privyAuthed])

  const onUnlinkProvider = useCallback(async (provider: string) => {
    if (!privyAuthed) return
    setBusyProvider(provider)
    setError(null)
    setNotice(null)
    try {
      const currentValue = selectLinkedValues(me, provider)[0] ?? null
      await performClientSideUnlink(provider, currentValue)
      await callUnlinkEndpoint(provider, currentValue)
      await loadMe({ showSpinner: false })
    } catch (unlinkError: any) {
      setError(typeof unlinkError?.message === 'string' ? unlinkError.message : `Failed to unlink ${provider}.`)
    } finally {
      setBusyProvider(null)
    }
  }, [callUnlinkEndpoint, loadMe, me, performClientSideUnlink, privyAuthed])

  const onLinkZora = useCallback(async () => {
    setBusyProvider('zora_cross_app')
    setError(null)
    setNotice(null)
    try {
      const headers = await authHeaders()
      const resolveSignals = async () => {
        const resolveRes = await apiFetch('/api/zora/resolve', {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        })
        const resolvePayload = (await resolveRes.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
        if (!resolveRes.ok || !resolvePayload?.success || !resolvePayload.data) {
          const resolveError = new Error(readApiError(resolvePayload, 'Failed to resolve Zora signals.')) as Error & {
            status?: number
          }
          resolveError.status = resolveRes.status
          throw resolveError
        }
        return resolvePayload.data
      }

      const existingSignals = await resolveSignals()
      if (hasResolvedZoraSignals(existingSignals)) {
        setNotice('Zora signals were detected from your current account. Cross-app login was not needed.')
        await loadMe({ showSpinner: false })
        return
      }
      if (existingSignals?.zoraHandle || existingSignals?.creatorCoin?.address) {
        setNotice('Zora profile found, but wallet detection is still pending. Open Base app and retry detection.')
        await loadMe({ showSpinner: false })
        return
      }

      const action = selectCrossAppAuthAction({
        privyAuthed,
        linkCrossAppAccount,
        loginWithCrossAppAccount,
      })
      if (!action) throw new Error('Zora linking is unavailable in this client.')

      await performZoraCrossAppAuth({
        privyAuthed,
        appId: ZORA_PRIVY_APP_ID,
        linkCrossAppAccount,
        loginWithCrossAppAccount,
        sanitizeRedirect: sanitizeCrossAppRedirectUrlForAuth,
        isRedirectUrlNotAllowedError: isPrivyRedirectUrlNotAllowedError,
      })

      const linkResponse = await apiFetch('/api/accounts/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: 'zora_cross_app', value: null }),
      })
      const linkPayload = (await linkResponse.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
      if (!linkResponse.ok || !linkPayload?.success || !linkPayload.data) {
        throw new Error(readApiError(linkPayload, 'Failed to link zora_cross_app.'))
      }
      setMe(linkPayload.data)

      const resolvedSignals = await resolveSignals()
      setNotice(
        hasResolvedZoraSignals(resolvedSignals)
          ? 'Zora linked and signals resolved.'
          : 'Zora linked. Open Zora once if needed, then refresh signals here.',
      )
      await loadMe({ showSpinner: false })
    } catch (zoraError: any) {
      if (isPrivyRedirectUrlNotAllowedError(zoraError)) {
        setError('Privy redirect URL is not allowed for this origin. Add this app URL in Privy settings and retry.')
      } else if (
        isUnauthorizedCrossAppLinkError(zoraError) ||
        Number(zoraError?.status) === 401 ||
        String(zoraError?.message ?? '').toLowerCase().includes('oauth/init')
      ) {
        setError('Privy cross-app Zora auth is unavailable right now. Open Zora, confirm your wallet there, then return here and use Refresh Zora signals.')
      } else {
        setError(typeof zoraError?.message === 'string' ? zoraError.message : 'Failed to link Zora.')
      }
    } finally {
      setBusyProvider(null)
    }
  }, [authHeaders, linkCrossAppAccount, loadMe, loginWithCrossAppAccount, privyAuthed])

  const onRefreshZora = useCallback(async () => {
    setBusyProvider('zora_cross_app')
    setError(null)
    setNotice(null)
    try {
      const headers = await authHeaders()
      const response = await apiFetch('/api/zora/refresh', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, 'Failed to refresh Zora signals.'))
      }
      const refreshLimited = response.headers.get('X-Zora-Refresh-Limited') === '1'
      setNotice(refreshLimited ? 'Zora refresh is rate-limited. Using your latest saved signals.' : 'Zora signals refreshed.')
      await loadMe({ showSpinner: false })
    } catch (refreshError: any) {
      setError(typeof refreshError?.message === 'string' ? refreshError.message : 'Failed to refresh Zora signals.')
    } finally {
      setBusyProvider(null)
    }
  }, [authHeaders, loadMe])

  const onSwitchAccount = useCallback(async () => {
    setBusyProvider('email')
    setError(null)
    setNotice(null)
    try {
      await runWaitlistPrivyLogout({
        logout: async () => {
          await privy.logout().catch(() => null)
        },
        shouldLogout: true,
      })
      if (typeof window !== 'undefined') {
        window.location.assign('/waitlist')
      }
    } catch (switchError: any) {
      setError(typeof switchError?.message === 'string' ? switchError.message : 'Failed to switch account.')
    } finally {
      setBusyProvider(null)
    }
  }, [privy])

  const sendPreparedOwnerTx = useCallback(
    async (
      txRequest: { chainId: 8453; to: `0x${string}`; data: `0x${string}`; value: '0x0' },
      ownerAddress?: string | null,
      ownerIndexLookupAddress?: string | null,
      opts?: {
        approvalRunId?: string | null
        onStageEvent?: ((event: OwnerApprovalStageEvent) => void) | null
        ownerInstallIntent?: OwnerInstallIntent
        customOwnerPolicyToken?: string | null
        preferSponsoredFirst?: boolean
        signerAddressOverride?: string | null
        signerWalletOverride?: any
      },
    ) => {
      let effectiveWalletClient = walletClient
      let effectiveChainId = chainId
      let effectiveSwitchChain = switchChainAsync
      let effectiveSignerAddress = ownerSignerAddress

      if (typeof opts?.signerAddressOverride === 'string' && opts.signerAddressOverride.trim()) {
        try {
          effectiveSignerAddress = getAddress(opts.signerAddressOverride.trim())
        } catch {
          // Ignore malformed override and keep existing signer.
        }
      }

      const signerWalletOverride = opts?.signerWalletOverride ?? null
      if (signerWalletOverride && effectiveSignerAddress) {
        let provider = await getPrivyEthereumProvider(signerWalletOverride)
        if (!provider?.request && typeof setActiveWallet === 'function') {
          await Promise.resolve(setActiveWallet(signerWalletOverride as any)).catch(() => null)
          provider = await getPrivyEthereumProvider(signerWalletOverride)
        }
        if (!provider?.request) {
          throw new Error('Embedded owner signer is unavailable. Reconnect your embedded wallet and retry.')
        }
        effectiveWalletClient = createWalletClient({
          account: effectiveSignerAddress as Address,
          chain: base,
          transport: custom(provider),
        }) as any
        effectiveChainId = parseChainId((signerWalletOverride as any)?.chainId) ?? effectiveChainId
        effectiveSwitchChain =
          typeof (signerWalletOverride as any)?.switchChain === 'function'
            ? ({ chainId: targetChainId }: { chainId: number }) =>
                (signerWalletOverride as any).switchChain(targetChainId)
            : switchChainAsync
      } else if (shouldUsePrivyExternalOwnerWallet) {
        if (!effectiveSignerAddress) {
          throw new Error('Connect an owner wallet signer before submitting owner approval.')
        }
        const provider = await getPrivyEthereumProvider(activeExternalOwnerWallet)
        if (!provider?.request) {
          throw new Error('Connected owner wallet signer is unavailable. Reconnect the wallet and retry.')
        }
        effectiveWalletClient = createWalletClient({
          account: effectiveSignerAddress as Address,
          chain: base,
          transport: custom(provider),
        }) as any
        effectiveChainId = parseChainId(activeExternalOwnerWallet.chainId) ?? effectiveChainId
        effectiveSwitchChain =
          typeof activeExternalOwnerWallet.switchChain === 'function'
            ? ({ chainId: targetChainId }: { chainId: number }) => activeExternalOwnerWallet.switchChain(targetChainId)
            : switchChainAsync
      }

      if (!effectiveSignerAddress) {
        throw new Error('Connect an owner wallet signer before submitting owner approval.')
      }

      await submitPreparedOwnerTx({
        txRequest,
        walletClient: effectiveWalletClient,
        chainId: typeof effectiveChainId === 'number' ? effectiveChainId : undefined,
        switchChainAsync: effectiveSwitchChain,
        authHeaders,
        ownerAddress,
        ownerIndexLookupAddress,
        signerAddress: effectiveSignerAddress,
        executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
        canonicalSmartWalletAddress: canonicalCswAddress,
        publicClient,
        ensurePaymasterSession,
        approvalRunId: opts?.approvalRunId ?? null,
        onStageEvent: opts?.onStageEvent ?? null,
        ownerInstallIntent: opts?.ownerInstallIntent ?? 'embeddedOwner',
        customOwnerPolicyToken: opts?.customOwnerPolicyToken ?? null,
        preferSponsoredFirst: opts?.preferSponsoredFirst === true,
      })
    },
    [
      activeExternalOwnerWallet,
      authHeaders,
      canonicalCswAddress,
      chainId,
      ensurePaymasterSession,
      ownerSignerAddress,
      publicClient,
      setActiveWallet,
      shouldUsePrivyExternalOwnerWallet,
      switchChainAsync,
      walletClient,
    ],
  )

  const runCustomOwnerGasPreflight = useCallback(
    async (input: {
      txRequest: { chainId: 8453; to: `0x${string}`; data: `0x${string}`; value: '0x0' }
      payerAddress: `0x${string}`
    }): Promise<OwnerInstallGasPreflight> => {
      if (!publicClient) {
        throw new Error('Base RPC client is unavailable. Reload and retry.')
      }
      const payerAddress = getAddress(input.payerAddress) as `0x${string}`
      const client = publicClient as any
      const [estimatedGasRaw, feesRaw, balanceWei] = await Promise.all([
        client.estimateGas({
          account: payerAddress,
          to: input.txRequest.to,
          data: input.txRequest.data,
          value: 0n,
        }),
        typeof client.estimateFeesPerGas === 'function'
          ? client.estimateFeesPerGas()
          : typeof client.getGasPrice === 'function'
            ? client.getGasPrice().then((gasPrice: bigint) => ({ gasPrice }))
            : Promise.resolve(null),
        client.getBalance({
          address: payerAddress,
        }),
      ])
      const estimatedGas = BigInt(estimatedGasRaw ?? 0n)
      const fees = feesRaw as { maxFeePerGas?: bigint; gasPrice?: bigint } | null
      const maxFeePerGas = BigInt(fees?.maxFeePerGas ?? fees?.gasPrice ?? 0n)
      if (estimatedGas <= 0n || maxFeePerGas <= 0n) {
        throw new Error('Could not estimate Base gas requirements for co-owner install.')
      }
      return {
        payerAddress,
        estimatedGas,
        maxFeePerGas,
        requiredWei: estimatedGas * maxFeePerGas,
        balanceWei: BigInt(balanceWei ?? 0n),
      }
    },
    [publicClient],
  )

  const onEnable4626Signing = useCallback(async () => {
    if (!canonicalCswAddress) return
    const runId = ++ownerApprovalRunIdRef.current
    const approvalRunId = `owner-approval-${Date.now()}-${runId}`
    setOwnerInstallIntent('embeddedOwner')
    setCustomOwnerGasPreflight(null)
    setAdvancedBusy(true)
    setError(null)
    setNotice(null)
    setOwnerDelegationFlags(null)
    try {
      // ── Owner-approval path ─────────────────────────────────────────
      const ownerCheck = await checkEoaOwnershipOfCsw({
        publicClient,
        chainId: ownerSignerChainId,
        cswAddress: canonicalCswAddress,
        ownerAddress: connectedCanonicalWalletSelected ? canonicalCswAddress : ownerSignerAddress ?? null,
      })
      const effectiveOwnerCheck = connectedCanonicalWalletSelected ? { value: true, reason: 'ok' as const } : ownerCheck
      setConnectedOwnerState(effectiveOwnerCheck)
      if (effectiveOwnerCheck.value !== true) {
        if (ownerCheck.reason === 'network_mismatch') {
          throw new Error('Switch the connected wallet to Base, then retry owner approval.')
        }
        if (ownerSignerAddress) {
          throw new Error('Connected wallet is not a current owner of your Coinbase Smart Wallet. Connect an existing owner and retry.')
        }
        throw new Error('Connect a wallet that is already an owner of your Coinbase Smart Wallet before enabling 4626 signing.')
      }

      let { headers, response: preflightRes, payload: preflightPayload } = await runOnboardingBootstrapPreflight()
      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'preflight',
        status: 'start',
        attempt: 1,
        executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      if ((!preflightRes.ok || !preflightPayload?.success) && (preflightPayload as any)?.needsEmbeddedWallet === true) {
        await ensureEmbeddedWallet()
        const embeddedRetry = await runOnboardingBootstrapPreflight()
        headers = embeddedRetry.headers
        preflightRes = embeddedRetry.response
        preflightPayload = embeddedRetry.payload
        if (!preflightRes.ok || !preflightPayload?.success) {
          emitOwnerApprovalStageEvent({
            runId: approvalRunId,
            stage: 'preflight',
            status: 'error',
            executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
            signerAddress: ownerSignerAddress ?? null,
            canonicalCswAddress,
            code: 'preflight_failed_after_embedded_retry',
            message: readApiError(preflightPayload, 'Signer preflight failed.'),
          })
          throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
        }
      }
      if (!preflightRes.ok || !preflightPayload?.success) {
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'preflight',
          status: 'error',
          executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'preflight_failed',
          message: readApiError(preflightPayload, 'Signer preflight failed.'),
        })
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }
      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'preflight',
        status: 'success',
        executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      const preflightOwnerLookupAddress =
        connectedCanonicalWalletSelected && preflightPayload?.data?.privyIsOwner === true
          ? preflightPayload?.data?.privyEmbeddedEoaAddress ?? null
          : null

      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'prepare',
        status: 'start',
        attempt: 1,
        executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      const prepareRes = await apiFetch('/api/wallet/prepare-add-privy-owner', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const preparePayload = (await prepareRes.json().catch(() => null)) as ApiEnvelope<PrepareOwnerResponse> | null
      if (!prepareRes.ok || !preparePayload?.success || !preparePayload.data) {
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'prepare',
          status: 'error',
          executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'prepare_failed',
          message: readApiError(preparePayload, 'Failed to prepare owner install.'),
        })
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare owner install.')
      }
      if (preparePayload.data.alreadyOwner) {
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'prepare',
          status: 'success',
          executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'already_owner',
        })
        setNotice('4626 signing is already enabled.')
        return
      }
      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'prepare',
        status: 'success',
        executionMode: canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect',
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      // In self-auth mode (CSW signing for itself), pass the Privy embedded
      // EOA address so canonical4337 can install/confirm it as the sponsored
      // smart-wallet signer. We do not create a sub-account during waitlist
      // onboarding.
      const ownerAddressForTx = connectedCanonicalWalletSelected
        ? preflightPayload?.data?.privyEmbeddedEoaAddress ?? null
        : ownerSignerAddress ?? null
      await sendPreparedOwnerTx(
        preparePayload.data.txRequest,
        ownerAddressForTx,
        preflightOwnerLookupAddress,
        {
          approvalRunId,
          onStageEvent: emitOwnerApprovalStageEvent,
          ownerInstallIntent: 'embeddedOwner',
        },
      )
      setNotice('4626 signing is enabled on your canonical CSW.')
      await loadMe({ showSpinner: false })
    } catch (ownerError: any) {
      if (runId !== ownerApprovalRunIdRef.current) return
      const flags = {
        ...(ownerError?.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
        ...(ownerError?.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
        ...(typeof ownerError?.baseAppUrl === 'string' && ownerError.baseAppUrl.trim()
          ? { baseAppUrl: ownerError.baseAppUrl.trim() }
          : null),
      }
      setOwnerDelegationFlags(Object.keys(flags).length > 0 ? flags : null)
      setError(typeof ownerError?.message === 'string' ? ownerError.message : 'Failed to enable 4626 signing.')
    } finally {
      if (runId !== ownerApprovalRunIdRef.current) return
      setAdvancedBusy(false)
    }
  }, [
    canonicalCswAddress,
    connectedCanonicalWalletSelected,
    emitOwnerApprovalStageEvent,
    ensureEmbeddedWallet,
    loadMe,
    ownerSignerAddress,
    ownerSignerChainId,
    publicClient,
    runOnboardingBootstrapPreflight,
    sendPreparedOwnerTx,
  ])

  const retryOwnerCheck = useCallback(async () => {
    if (!canonicalCswAddress) return
    const result = await checkEoaOwnershipOfCsw({
      publicClient,
      chainId: ownerSignerChainId,
      cswAddress: canonicalCswAddress,
      ownerAddress: ownerSignerAddress ?? null,
    })
    setConnectedOwnerState(result)
  }, [canonicalCswAddress, ownerSignerAddress, ownerSignerChainId, publicClient])

  const onResetOwnerApproval = useCallback(async () => {
    ownerApprovalRunIdRef.current += 1
    setAdvancedBusy(false)
    setError(null)
    setNotice(null)
    setConnectedOwnerState({ value: null, reason: 'idle' })
    setOwnerInstallIntent('embeddedOwner')
    setCustomOwnerGasPreflight(null)
    setCustomOwnerPreparedTxRequest(null)
    setCustomOwnerPreparedAddress(null)
    setOwnerDelegationFlags(null)
    await retryOwnerCheck()
    setNotice('Signing state reset. Reconnect or switch owner wallet if needed.')
  }, [retryOwnerCheck])

  const onAddRabbyCoOwner = useCallback(async (advancedOwnerAddress: string) => {
    const raw = String(advancedOwnerAddress ?? '').trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      setError('Enter a valid Rabby EOA address.')
      return
    }
    let normalized: `0x${string}`
    try {
      normalized = getAddress(raw) as `0x${string}`
    } catch {
      setError('Enter a valid Rabby EOA address.')
      return
    }
    // In mobile in-app browsers (Base App / Telegram WebView), native confirm
    // dialogs can be suppressed or auto-cancelled, which makes this button look
    // like a no-op. Keep the explicit confirmation on desktop browsers only.
    const requireDesktopConfirm = typeof window !== 'undefined' && !isMobileWalletEnvironment()
    if (requireDesktopConfirm) {
      const confirmed = window.confirm('Add this Rabby EOA as a co-owner? This is advanced and never automatic.')
      if (!confirmed) return
    }

    const runId = ++ownerApprovalRunIdRef.current
    const approvalRunId = `co-owner-approval-${Date.now()}-${runId}`
    const executionMode = canonicalCswAddress ? 'canonicalSmartWallet' : 'ownerDirect'
    setOwnerInstallIntent('customCoOwner')
    setCustomOwnerGasPreflight(null)
    setCustomOwnerPreparedTxRequest(null)
    setCustomOwnerPreparedAddress(null)
    setAdvancedBusy(true)
    setError(null)
    setNotice(null)
    setOwnerDelegationFlags(null)
    try {
      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'preflight',
        status: 'start',
        attempt: 1,
        executionMode,
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      const { headers, response: preflightRes, payload: preflightPayload } = await runOnboardingBootstrapPreflight()
      if (!preflightRes.ok || !preflightPayload?.success) {
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'preflight',
          status: 'error',
          executionMode,
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'preflight_failed',
          message: readApiError(preflightPayload, 'Signer preflight failed.'),
        })
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }
      const preflightOwnerLookupAddress =
        connectedCanonicalWalletSelected && preflightPayload?.data?.privyIsOwner === true
          ? preflightPayload?.data?.privyEmbeddedEoaAddress ?? null
          : null
      const liveEmbeddedOwnerWalletCandidate =
        preflightOwnerLookupAddress && Array.isArray(privyLiveWallets)
          ? ((privyLiveWallets as any[]).find((wallet) => {
              const walletAddress =
                typeof wallet?.address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(wallet.address)
                  ? wallet.address.toLowerCase()
                  : null
              if (!walletAddress || walletAddress !== preflightOwnerLookupAddress.toLowerCase()) return false
              const walletType = String(
                wallet?.walletClientType ?? wallet?.wallet_client_type ?? wallet?.connector_type ?? wallet?.type ?? '',
              )
                .toLowerCase()
                .trim()
              const looksEmbedded = walletType === 'privy' || walletType.includes('embedded') || walletType.includes('privy')
              const hasProviderSurface =
                typeof wallet?.request === 'function' ||
                typeof wallet?.getEthereumProvider === 'function' ||
                Boolean(wallet?.provider && typeof wallet.provider.request === 'function')
              return looksEmbedded || hasProviderSurface
            }) ?? null)
          : null
      const embeddedOwnerWalletCandidate =
        preflightOwnerLookupAddress ? liveEmbeddedOwnerWalletCandidate : null
      if (preflightOwnerLookupAddress && !embeddedOwnerWalletCandidate) {
        throw new Error(
          `Embedded owner signer ${preflightOwnerLookupAddress} is not available in this session. ` +
            'Reconnect your Privy embedded wallet in Base App, then retry Add co-owner.',
        )
      }

      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'prepare',
        status: 'start',
        attempt: 1,
        executionMode,
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      const prepareRes = await apiFetch('/api/wallet/prepare-add-rabby-owner', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rabbyAddress: normalized,
          confirmedAdvanced: true,
        }),
      })
      const preparePayload = (await prepareRes.json().catch(() => null)) as ApiEnvelope<PrepareOwnerResponse> | null
      if (!prepareRes.ok || !preparePayload?.success || !preparePayload.data) {
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'prepare',
          status: 'error',
          executionMode,
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'prepare_failed',
          message: readApiError(preparePayload, 'Failed to prepare Rabby co-owner transaction.'),
        })
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare Rabby co-owner transaction.')
      }
      if (preparePayload.data.alreadyOwner) {
        setCustomOwnerPreparedTxRequest(null)
        setCustomOwnerPreparedAddress(normalized.toLowerCase())
        emitOwnerApprovalStageEvent({
          runId: approvalRunId,
          stage: 'prepare',
          status: 'success',
          executionMode,
          signerAddress: ownerSignerAddress ?? null,
          canonicalCswAddress,
          code: 'already_owner',
        })
        setNotice('Rabby address is already an owner.')
        return
      }
      emitOwnerApprovalStageEvent({
        runId: approvalRunId,
        stage: 'prepare',
        status: 'success',
        executionMode,
        signerAddress: ownerSignerAddress ?? null,
        canonicalCswAddress,
      })
      setCustomOwnerPreparedTxRequest(preparePayload.data.txRequest)
      setCustomOwnerPreparedAddress(normalized.toLowerCase())
      const customOwnerPolicyToken =
        typeof preparePayload.data.sponsorship?.customOwnerPolicyToken === 'string' &&
        preparePayload.data.sponsorship.customOwnerPolicyToken.trim()
          ? preparePayload.data.sponsorship.customOwnerPolicyToken.trim()
          : null
      if (!customOwnerPolicyToken) {
        const preflightPayerAddress =
          connectedCanonicalWalletSelected && canonicalCswAddress
            ? (canonicalCswAddress as `0x${string}`)
            : ownerSignerAddress
              ? (ownerSignerAddress as `0x${string}`)
              : null
        if (!preflightPayerAddress) {
          throw new Error('Connect an owner wallet before submitting co-owner approval.')
        }

        const gasPreflight = await runCustomOwnerGasPreflight({
          txRequest: preparePayload.data.txRequest,
          payerAddress: preflightPayerAddress,
        })
        setCustomOwnerGasPreflight(gasPreflight)
        if (gasPreflight.balanceWei < gasPreflight.requiredWei) {
          emitOwnerApprovalStageEvent({
            runId: approvalRunId,
            stage: 'preflight',
            status: 'error',
            executionMode,
            signerAddress: ownerSignerAddress ?? null,
            canonicalCswAddress,
            code: 'custom_co_owner_insufficient_gas',
            message: `required=${gasPreflight.requiredWei.toString()} balance=${gasPreflight.balanceWei.toString()} payer=${gasPreflight.payerAddress}`,
          })
          throw new Error(
            `Direct co-owner approval needs ${formatEther(gasPreflight.requiredWei)} ETH for gas from ${gasPreflight.payerAddress}. Current balance is ${formatEther(gasPreflight.balanceWei)} ETH. Fund this wallet on Base and retry.`,
          )
        }
      } else {
        setCustomOwnerGasPreflight(null)
      }

      await sendPreparedOwnerTx(preparePayload.data.txRequest, normalized, preflightOwnerLookupAddress, {
        approvalRunId,
        onStageEvent: emitOwnerApprovalStageEvent,
        ownerInstallIntent: 'customCoOwner',
        customOwnerPolicyToken,
        preferSponsoredFirst: customOwnerPolicyToken !== null,
        signerAddressOverride: embeddedOwnerWalletCandidate ? preflightOwnerLookupAddress : null,
        signerWalletOverride: embeddedOwnerWalletCandidate,
      })
      setNotice('Rabby co-owner added.')
      await loadMe({ showSpinner: false })
    } catch (rabbyError: any) {
      if (runId !== ownerApprovalRunIdRef.current) return
      const flags = {
        ...(rabbyError?.needsEmbeddedWallet === true ? { needsEmbeddedWallet: true } : null),
        ...(rabbyError?.needsBaseAppSetup === true ? { needsBaseAppSetup: true } : null),
        ...(typeof rabbyError?.baseAppUrl === 'string' && rabbyError.baseAppUrl.trim()
          ? { baseAppUrl: rabbyError.baseAppUrl.trim() }
          : null),
      }
      setOwnerDelegationFlags(Object.keys(flags).length > 0 ? flags : null)
      setError(typeof rabbyError?.message === 'string' ? rabbyError.message : 'Failed to add Rabby co-owner.')
    } finally {
      if (runId !== ownerApprovalRunIdRef.current) return
      setAdvancedBusy(false)
    }
  }, [
    canonicalCswAddress,
    connectedCanonicalWalletSelected,
    emitOwnerApprovalStageEvent,
    loadMe,
    ownerSignerAddress,
    privyLiveWallets,
    runCustomOwnerGasPreflight,
    runOnboardingBootstrapPreflight,
    sendPreparedOwnerTx,
  ])

  const zoraCrossAppCount = zoraStatus?.zoraCrossAppAccounts?.length ?? 0
  const canShowAdvanced = Boolean(canonicalCswAddress)
  const baseAppUrl = ownerDelegationFlags?.baseAppUrl ?? null
  const needsBaseAppSetup = Boolean(ownerDelegationFlags?.needsBaseAppSetup)
  const needsEmbeddedWallet = Boolean(ownerDelegationFlags?.needsEmbeddedWallet)
  const zoraHandoffUrl = useMemo(
    () => buildZoraHandoffUrl({ returnPath: params.zoraReturnPath ?? '/accounts', context: 'signup' }),
    [params.zoraReturnPath],
  )
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
  const subAccountReady = false
  const needsBaseAccountReconnect = false
  const ownerApprovalReady = connectedOwnerReady && (signerClientReady || privySignerClientReady) && !needsEmbeddedWallet
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
    ? ownerAuthorityState.detail
    : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
      ? 'Wallet connection is still finishing. Wait for the signer session to hydrate before submitting the Base smart-wallet approval.'
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
        title: 'Approve on Base',
        description: ownerApprovalReady
          ? connectedCanonicalWalletSelected
            ? '4626 can now enable embedded signing for your smart wallet.'
            : '4626 can now use one Base owner transaction for signing access.'
          : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
            ? 'Wait for the signer client to finish hydrating, then approve.'
            : 'Approval unlocks after a current owner is connected and verified.',
        state: ownerApprovalReady ? 'complete' : connectedOwnerReady ? 'active' : 'blocked',
      },
    ],
    [
      connectedCanonicalWalletSelected,
      connectedOwnerReady,
      ownerApprovalReady,
      ownerAuthorityState.hint,
      ownerSignerAddress,
      privySignerClientReady,
      signerClientReady,
    ],
  )
  const ownerPrimaryCtaLabel = needsBaseAccountReconnect
    ? 'Reconnect via Base Account'
    : ownerApprovalReady
      ? 'Approve 4626 on this wallet'
      : needsEmbeddedWallet
        ? 'Provisioning embedded wallet…'
        : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
          ? 'Finishing wallet session…'
          : 'Owner approval required'

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
    customOwnerGasPreflight,
    customOwnerPreparedAddress,
    customOwnerPreparedTxRequest,
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
    needsBaseAccountReconnect,
    needsBaseAppSetup,
    needsEmbeddedWallet,
    notice,
    onEnable4626Signing,
    onLinkProvider,
    onLinkZora,
    onUnlinkProvider,
    onRefreshZora,
    onResetOwnerApproval,
    onSwitchAccount,
    onAddRabbyCoOwner,
    ownerApprovalReady,
    ownerAuthorityState,
    ownerChecklist,
    ownerDelegationFlags,
    ownerInstallResumeState,
    ownerInstallSectionRef,
    ownerInstallIntent,
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
    readableCswOwners,
    retryOwnerCheck,
    sendPreparedOwnerTx,
    setAdvancedBusy,
    setBusyProvider,
    setConnectedOwnerState,
    setError,
    setMe,
    setNotice,
    setOwnerDelegationFlags,
    setZoraStatus,
    signerClientReady,
    subAccountReady,
    subAccountAddress: null,
    subAccountSettingUp: false,
    subAccountError: null,
    subAccountStage: null,
    switchChainAsync,
    telegramLaunchParamsAvailable,
    walletClient,
    zoraCrossAppCount,
    zoraHandoffUrl,
    zoraLinked,
    zoraStatus,
  }
}
