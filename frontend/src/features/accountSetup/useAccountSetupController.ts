import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveWallet, useConnectWallet, useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { extractPrivyWalletsFromUser, useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { isUnauthorizedCrossAppLinkError, performZoraCrossAppAuth } from '@/lib/privy/zoraCrossApp'
import { isTelegramMiniAppContext, readPrivyTelegramLaunchParams } from '@/lib/telegram/telegramWebApp'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'
import {
  type OwnerDelegationFlags,
  deriveOwnerDelegationFlags,
  readApiError,
  shouldRefreshOwnerDelegationOnForeground,
} from '@/lib/wallet/onboardingWalletDelegation'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'
import { selectCrossAppAuthAction } from '@/features/waitlist/crossAppWalletUtils'
import { runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { checkEoaOwnershipOfCsw } from '@/wallet/accountContext/ownership'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

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
      const token = await getAccessToken()
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
  }, [
    canonicalCswAddress,
    connectedCanonicalWalletSelected,
    cswOwnersState.owners,
    cswOwnersState.status,
    ownerSignerAddress,
    ownerSignerChainId,
    publicClient,
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
        setError('Privy cross-app Zora auth is unavailable right now. Use Connect with Zora again, or refresh signals if you already linked.')
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

  const sendPreparedOwnerTx = useCallback(async () => {
    throw new Error(
      'User owner-mutation setup is paused. Use /swap with an external wallet (EOA mode), or wait for wallet onboarding to return.',
    )
  }, [])

  const submitOwnerInstallViaOnchainEoa = useCallback(async () => {
    throw new Error(
      'User add-owner setup is paused. Use /swap with an external wallet (EOA mode), or wait for wallet onboarding to return.',
    )
  }, [])

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
    setOwnerDelegationFlags(null)
    await retryOwnerCheck()
    setNotice('Signing state reset. Reconnect or switch owner wallet if needed.')
  }, [retryOwnerCheck])

  const onAddRabbyCoOwner = useCallback(async (_advancedOwnerAddress: string) => {
    setError(
      'Add co-owner setup is paused. Use /swap with an external wallet (EOA mode), or wait for wallet onboarding to return.',
    )
  }, [])

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
    ? 'Add-owner setup is paused in this build. Connect an owner wallet for diagnostics, or trade at /swap with an external wallet.'
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
        description: ownerApprovalReady
          ? 'In-app owner setup is paused. Use /swap with an external wallet if canonical signing is unavailable.'
          : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
            ? 'Wait for the signer client to finish hydrating.'
            : 'Connect and verify a current CSW owner first.',
        state: connectedOwnerReady ? 'active' : 'blocked',
      },
    ],
    [
      connectedOwnerReady,
      ownerApprovalReady,
      ownerAuthorityState.hint,
      ownerSignerAddress,
      privySignerClientReady,
      signerClientReady,
    ],
  )
  const ownerPrimaryCtaLabel = ownerApprovalReady
    ? 'Owner setup paused'
    : needsEmbeddedWallet
      ? 'Provisioning embedded wallet…'
      : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
        ? 'Finishing wallet session…'
        : 'Connect owner wallet'

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
    ownerApprovalReady,
    ownerAuthorityState,
    ownerChecklist,
    ownerDelegationFlags,
    ownerInstallResumeState,
    ownerInstallSectionRef,
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
