import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useActiveWallet, useConnectWallet, useCrossAppAccounts, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, type Address } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/apiBase'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { performZoraCrossAppAuth, isUnauthorizedCrossAppLinkError } from '@/lib/privy/zoraCrossApp'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { isTelegramMiniAppContext, readPrivyTelegramLaunchParams } from '@/lib/telegramWebApp'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { buildZoraHandoffUrl } from '@/lib/zora/referrals'
import { checkEoaOwnershipOfCsw } from '@/wallet/accountContext/ownership'
import {
  type ApiEnvelope,
  type OwnerDelegationFlags,
  type PrepareOwnerResponse,
  buildOwnerDelegationError,
  deriveOwnerDelegationFlags,
  readApiError,
  sendPreparedOwnerTx as submitPreparedOwnerTx,
  shouldRefreshOwnerDelegationOnForeground,
} from '@/lib/wallet/onboardingWallet'
import { selectCrossAppAuthAction } from '@/features/waitlist/ownerInstallMapping'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'
import { PageMeta } from '@/components/seo/PageMeta'

type AccountLinkProvider = 'google' | 'apple' | 'twitter' | 'telegram' | 'tiktok' | 'external_eoa' | 'email' | 'zora_cross_app'

type AccountsMeResponse = {
  privyUserId: string
  email: string | null
  emailVerified: boolean
  linkedMethods: Record<string, string[]>
  accountSignals: {
    linked: boolean
    canonicalCswAddress: string | null
    creatorCoin: { address: string } | null
    zoraHandle: string | null
    lastResolvedAt: string | null
  }
  score: {
    points: number
    tier: number
  }
}

type ZoraLinkStatusResponse = {
  zoraLinked: boolean
  zoraCrossAppAccounts: Array<{ address: string; providerAppId: string }>
}

type ZoraResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: { address: string; name: string | null; symbol: string | null; imageUrl?: string | null } | null
  zoraHandle: string | null
}

type SmartWalletOwnersResponse = {
  smartWallet: `0x${string}`
  ownerCount: number
  nextOwnerIndex: number | null
  owners: Array<{
    index: number
    ownerBytes: `0x${string}`
    ownerAddress: `0x${string}` | null
    isAddressOwner: boolean
  }>
}


type ProviderRow = {
  provider: AccountLinkProvider
  label: string
  hint: string
}

type OwnerAuthorityState = {
  phase:
    | 'blocked'
    | 'canonical_wallet'
    | 'owner_connected'
    | 'needs_base'
    | 'check_wallet'
    | 'wrong_wallet'
    | 'needs_wallet'
  label: string
  hint: string
  detail: string
  badgeClass: string
}

const PROVIDER_ROWS: ProviderRow[] = [
  { provider: 'email', label: 'Email', hint: 'Notification channel' },
  { provider: 'google', label: 'Google', hint: 'OAuth identity' },
  { provider: 'apple', label: 'Apple', hint: 'OAuth identity' },
  { provider: 'twitter', label: 'Twitter/X', hint: 'Social identity' },
  { provider: 'telegram', label: 'Telegram', hint: 'Link from Telegram bot (/link)' },
  { provider: 'tiktok', label: 'TikTok', hint: 'Creator social signal' },
  { provider: 'external_eoa', label: 'Wallet connect (EOA)', hint: 'External signer wallet' },
]

function normalizeAddress(value: string): string | null {
  const raw = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

function shortValue(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 18) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function hasResolvedZoraSignals(data: ZoraResolveResponse | null | undefined): boolean {
  return Boolean(data?.canonicalCswAddress || data?.creatorCoin?.address || data?.zoraHandle)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isMobileWalletEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}

function deriveOwnerAuthorityState(input: {
  canonicalCswAddress: string | null
  connectedAddress: string | null | undefined
  connectedCanonicalWalletSelected: boolean
  connectedOwnerState: { value: boolean | null; reason: 'idle' | 'ok' | 'network_mismatch' | 'missing_params' | 'read_failed' }
}): OwnerAuthorityState {
  if (!input.canonicalCswAddress) {
    return {
      phase: 'blocked',
      label: 'Blocked',
      hint: 'Detect your canonical CSW first.',
      detail: 'We cannot verify signer authority until the Coinbase Smart Wallet is known.',
      badgeClass: 'border border-white/10 bg-white/5 text-zinc-400',
    }
  }

  if (input.connectedCanonicalWalletSelected) {
    return {
      phase: 'canonical_wallet',
      label: 'Canonical wallet',
      hint: `Same wallet detected: ${shortValue(input.connectedAddress)}`,
      detail: 'This is the same Coinbase Smart Wallet detected from Zora/Base. It can approve the add-owner transaction directly.',
      badgeClass: 'border border-brand-primary/30 bg-brand-primary/10 text-brand-200',
    }
  }

  if (input.connectedOwnerState.value === true) {
    return {
      phase: 'owner_connected',
      label: 'Owner connected',
      hint: `Ready to approve with ${shortValue(input.connectedAddress)}`,
      detail: 'This wallet is already one of the current CSW owners and can approve the add-owner transaction.',
      badgeClass: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    }
  }

  if (input.connectedOwnerState.reason === 'network_mismatch') {
    return {
      phase: 'needs_base',
      label: 'Base required',
      hint: 'Switch the connected wallet to Base and retry the owner check.',
      detail: 'Your signer must be connected on Base before 4626 can verify owner authority.',
      badgeClass: 'border border-amber-400/20 bg-amber-500/10 text-amber-200',
    }
  }

  if (input.connectedOwnerState.reason === 'read_failed') {
    return {
      phase: 'check_wallet',
      label: 'Check wallet',
      hint: 'We could not verify owner status from the connected wallet. Reconnect the owner wallet and retry.',
      detail: 'The owner read failed or the wallet provider did not answer the owner check cleanly.',
      badgeClass: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
    }
  }

  if (input.connectedAddress) {
    return {
      phase: 'wrong_wallet',
      label: 'Connect owner',
      hint: `Connected wallet ${shortValue(input.connectedAddress)} is not one of the current owners of this CSW.`,
      detail: 'Switch to one of the listed owner addresses below, then retry the approval step.',
      badgeClass: 'border border-rose-400/20 bg-rose-500/10 text-rose-200',
    }
  }

  return {
    phase: 'needs_wallet',
    label: 'Wallet required',
    hint: 'Connect a wallet that is already an owner of your existing Coinbase Smart Wallet.',
    detail: 'Once a current owner is connected, 4626 can prepare one Base approval transaction.',
    badgeClass: 'border border-white/10 bg-white/5 text-zinc-400',
  }
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
    return useLogin({}) as any
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

function useSafeWallets() {
  try {
    return useWallets() as any
  } catch {
    return { wallets: [], ready: false } as any
  }
}

function useSafeActiveWallet() {
  try {
    return useActiveWallet() as any
  } catch {
    return { wallet: undefined, setActiveWallet: () => {} } as any
  }
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

function isPrivyExternalEthereumWallet(wallet: any): boolean {
  if (!wallet || wallet.type !== 'ethereum') return false
  const walletClientType = String(wallet.walletClientType ?? '').toLowerCase()
  return walletClientType !== 'privy' && walletClientType !== 'privy-v2'
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

function selectLinkedValues(me: AccountsMeResponse | null, provider: AccountLinkProvider): string[] {
  if (!me) return []
  return Array.isArray(me.linkedMethods?.[provider]) ? me.linkedMethods[provider] : []
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

export function AccountsPage(props: {
  initialData?: {
    me: AccountsMeResponse
    zoraStatus: ZoraLinkStatusResponse | null
  }
}) {
  const location = useLocation()
  const privy = useSafePrivy()
  const { login } = useSafeLogin()
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()
  const { connectWallet } = useSafeConnectWallet()
  const { wallets: privyWallets } = useSafeWallets()
  const { wallet: activePrivyWallet } = useSafeActiveWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address: connectedAddress, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const ownerInstallSectionRef = useRef<HTMLElement | null>(null)

  const privyAuthed = Boolean(privy?.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy?.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy],
  )

  const [me, setMe] = useState<AccountsMeResponse | null>(props.initialData?.me ?? null)
  const [zoraStatus, setZoraStatus] = useState<ZoraLinkStatusResponse | null>(props.initialData?.zoraStatus ?? null)
  const [loading, setLoading] = useState(!props.initialData)
  const [busyProvider, setBusyProvider] = useState<AccountLinkProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedBusy, setAdvancedBusy] = useState(false)
  const [advancedOwnerAddress, setAdvancedOwnerAddress] = useState('')
  const [ownerDelegationFlags, setOwnerDelegationFlags] = useState<OwnerDelegationFlags | null>(null)
  const [connectedOwnerState, setConnectedOwnerState] = useState<{
    value: boolean | null
    reason: 'idle' | 'ok' | 'network_mismatch' | 'missing_params' | 'read_failed'
  }>({ value: null, reason: 'idle' })
  const [cswOwnersState, setCswOwnersState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    owners: SmartWalletOwnersResponse['owners']
    error: string | null
  }>({ status: 'idle', owners: [], error: null })

  const canonicalCswAddress = me?.accountSignals?.canonicalCswAddress ?? null
  const zoraLinked = Boolean(zoraStatus?.zoraLinked || me?.accountSignals?.linked)
  const telegramLaunchParamsAvailable = useMemo(() => Boolean(readPrivyTelegramLaunchParams()?.initDataRaw), [])
  const inTelegramMiniApp = useMemo(() => isTelegramMiniAppContext(), [])
  const ownerInstallResumeState = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const setup = (params.get('setup') ?? '').trim().toLowerCase()
    if (setup !== 'owner-install') {
      return { requested: false, source: null as string | null }
    }
    const source = (params.get('source') ?? '').trim().toLowerCase()
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
  const ownerSignerAddress = activeExternalOwnerWallet?.address ?? connectedAddress ?? null
  const ownerSignerChainId =
    parseChainId(activeExternalOwnerWallet?.chainId) ?? (typeof chainId === 'number' ? chainId : null)
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

  const loadMe = useCallback(async () => {
    if (!privyAuthed) {
      setMe(null)
      setZoraStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
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

      const mePayload = (await meRes.json().catch(() => null)) as ApiEnvelope<AccountsMeResponse> | null
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
  }, [ensureEmbeddedWallet, getAccessToken, privyAuthed])

  useEffect(() => {
    if (props.initialData) return
    void loadMe()
  }, [loadMe, props.initialData])

  useEffect(() => {
    if (!shouldRefreshAccountsOnForeground({ privyAuthed, ownerDelegationFlags, advancedBusy })) return

    const refresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      void loadMe()
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
        const payload = (await res.json().catch(() => null)) as ApiEnvelope<SmartWalletOwnersResponse> | null
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

  const performClientSideLink = useCallback(
    async (provider: AccountLinkProvider) => {
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

      const linkMethods: Record<AccountLinkProvider, string[]> = {
        email: ['linkEmail', 'linkEmailAccount'],
        google: ['linkGoogle', 'linkGoogleAccount'],
        apple: ['linkApple', 'linkAppleAccount'],
        twitter: ['linkTwitter', 'linkTwitterAccount'],
        telegram: ['linkTelegram'],
        tiktok: ['linkTiktok', 'linkTikTok', 'linkTiktokAccount', 'linkTikTokAccount'],
        external_eoa: ['linkWallet'],
        zora_cross_app: [],
      }
      const called = await maybeCallMethod(privy, linkMethods[provider])
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

  const performClientSideUnlink = useCallback(async (provider: AccountLinkProvider, value?: string | null) => {
    const unlinkMethods: Record<AccountLinkProvider, string[]> = {
      email: ['unlinkEmail', 'unlinkEmailAccount'],
      google: ['unlinkGoogle', 'unlinkGoogleAccount'],
      apple: ['unlinkApple', 'unlinkAppleAccount'],
      twitter: ['unlinkTwitter', 'unlinkTwitterAccount'],
      telegram: ['unlinkTelegram'],
      tiktok: ['unlinkTiktok', 'unlinkTikTok', 'unlinkTiktokAccount', 'unlinkTikTokAccount'],
      external_eoa: ['unlinkWallet'],
      zora_cross_app: [],
    }
    await maybeCallMethod(privy, unlinkMethods[provider], value ? [{ value }] : [])
  }, [privy])

  const connectOwnerWallet = useCallback(() => {
    setError(null)
    setNotice(null)
    connectWallet({
      walletList: [
        'metamask',
        'coinbase_wallet',
        'detected_ethereum_wallets',
        prefersWalletConnectQr ? 'wallet_connect_qr' : 'wallet_connect',
      ],
      walletChainType: 'ethereum-only',
      description: 'Connect one of the current owners of your Coinbase Smart Wallet on Base to approve the 4626 owner install.',
    })
  }, [connectWallet, prefersWalletConnectQr])

  const callLinkEndpoint = useCallback(
    async (provider: AccountLinkProvider, value?: string | null) => {
      const headers = await authHeaders()
      const response = await apiFetch('/api/accounts/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, value: value ?? null }),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountsMeResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, `Failed to link ${provider}.`))
      }
      setMe(payload.data)
      setNotice(`${provider.replace(/_/g, ' ')} linked.`)
    },
    [authHeaders],
  )

  const callUnlinkEndpoint = useCallback(
    async (provider: AccountLinkProvider, value?: string | null) => {
      const headers = await authHeaders()
      const response = await apiFetch('/api/accounts/unlink', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider, value: value ?? null }),
      })
      const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountsMeResponse> | null
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(readApiError(payload, `Failed to unlink ${provider}.`))
      }
      setMe(payload.data)
      setNotice(`${provider.replace(/_/g, ' ')} unlinked in 4626.`)
    },
    [authHeaders],
  )

  const onLinkProvider = useCallback(async (provider: AccountLinkProvider) => {
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
          await loadMe()
          throw (
            lastError ??
            new Error('No external owner wallet was linked in Privy yet. Connect a real Base wallet and retry.')
          )
        }
      } else {
        await callLinkEndpoint(provider)
      }
      await loadMe()
    } catch (linkError: any) {
      setError(typeof linkError?.message === 'string' ? linkError.message : `Failed to link ${provider}.`)
    } finally {
      setBusyProvider(null)
    }
  }, [callLinkEndpoint, loadMe, performClientSideLink, privyAuthed])

  const onUnlinkProvider = useCallback(async (provider: AccountLinkProvider) => {
    if (!privyAuthed) return
    setBusyProvider(provider)
    setError(null)
    setNotice(null)
    try {
      const currentValue = selectLinkedValues(me, provider)[0] ?? null
      await performClientSideUnlink(provider, currentValue)
      await callUnlinkEndpoint(provider, currentValue)
      await loadMe()
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
        await loadMe()
        return
      }

      await performClientSideLink('zora_cross_app')
      await callLinkEndpoint('zora_cross_app')
      const resolvedSignals = await resolveSignals()
      setNotice(
        hasResolvedZoraSignals(resolvedSignals)
          ? 'Zora linked and signals resolved.'
          : 'Zora linked. Open Zora once if needed, then refresh signals here.',
      )
      await loadMe()
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
  }, [authHeaders, callLinkEndpoint, loadMe, performClientSideLink])

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
      setNotice('Zora signals refreshed.')
      await loadMe()
    } catch (refreshError: any) {
      setError(typeof refreshError?.message === 'string' ? refreshError.message : 'Failed to refresh Zora signals.')
    } finally {
      setBusyProvider(null)
    }
  }, [authHeaders, loadMe])

  const sendPreparedOwnerTx = useCallback(
    async (txRequest: { chainId: 8453; to: `0x${string}`; data: `0x${string}`; value: '0x0' }, ownerAddress?: string | null) => {
      let effectiveWalletClient = walletClient
      let effectiveChainId = chainId
      let effectiveSwitchChain = switchChainAsync

      if (activeExternalOwnerWallet && ownerSignerAddress) {
        const provider = await getPrivyEthereumProvider(activeExternalOwnerWallet)
        if (!provider?.request) {
          throw new Error('Connected owner wallet signer is unavailable. Reconnect the wallet and retry.')
        }
        effectiveWalletClient = createWalletClient({
          account: ownerSignerAddress as Address,
          chain: base,
          transport: custom(provider),
        }) as any
        effectiveChainId = parseChainId(activeExternalOwnerWallet.chainId) ?? effectiveChainId
        effectiveSwitchChain =
          typeof activeExternalOwnerWallet.switchChain === 'function'
            ? ({ chainId: targetChainId }: { chainId: number }) => activeExternalOwnerWallet.switchChain(targetChainId)
            : switchChainAsync
      }

      await submitPreparedOwnerTx({
        txRequest,
        walletClient: effectiveWalletClient,
        chainId: typeof effectiveChainId === 'number' ? effectiveChainId : undefined,
        switchChainAsync: effectiveSwitchChain,
        authHeaders,
        ownerAddress,
      })
    },
    [activeExternalOwnerWallet, authHeaders, chainId, ownerSignerAddress, switchChainAsync, walletClient],
  )

  const onEnable4626Signing = useCallback(async () => {
    if (!canonicalCswAddress) return
    setAdvancedBusy(true)
    setError(null)
    setNotice(null)
    setOwnerDelegationFlags(null)
    try {
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

      const headers = await authHeaders()
      let preflightRes = await apiFetch('/api/onboarding/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      let preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
      if ((!preflightRes.ok || !preflightPayload?.success) && (preflightPayload as any)?.needsEmbeddedWallet === true) {
        await ensureEmbeddedWallet()
        preflightRes = await apiFetch('/api/onboarding/bootstrap', {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        })
        preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
        if (!preflightRes.ok || !preflightPayload?.success) {
          throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
        }
      }
      if (!preflightRes.ok || !preflightPayload?.success) {
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }

      const prepareRes = await apiFetch('/api/wallet/prepare-add-privy-owner', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const preparePayload = (await prepareRes.json().catch(() => null)) as ApiEnvelope<PrepareOwnerResponse> | null
      if (!prepareRes.ok || !preparePayload?.success || !preparePayload.data) {
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare owner install.')
      }
      if (preparePayload.data.alreadyOwner) {
        setNotice('4626 signing is already enabled.')
        return
      }
      await sendPreparedOwnerTx(
        preparePayload.data.txRequest,
        connectedCanonicalWalletSelected ? null : ownerSignerAddress ?? null,
      )
      setNotice('4626 signing is enabled on your canonical CSW.')
      await loadMe()
    } catch (ownerError: any) {
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
      setAdvancedBusy(false)
    }
  }, [authHeaders, canonicalCswAddress, connectedCanonicalWalletSelected, ensureEmbeddedWallet, loadMe, ownerSignerAddress, ownerSignerChainId, publicClient, sendPreparedOwnerTx])

  const onAddRabbyCoOwner = useCallback(async () => {
    const normalized = normalizeAddress(advancedOwnerAddress)
    if (!normalized) {
      setError('Enter a valid Rabby EOA address.')
      return
    }
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Add this Rabby EOA as a co-owner? This is advanced and never automatic.')
      : true
    if (!confirmed) return

    setAdvancedBusy(true)
    setError(null)
    setNotice(null)
    setOwnerDelegationFlags(null)
    try {
      const headers = await authHeaders()
      const preflightRes = await apiFetch('/api/onboarding/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const preflightPayload = (await preflightRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
      if (!preflightRes.ok || !preflightPayload?.success) {
        throw buildOwnerDelegationError(preflightPayload, 'Signer preflight failed.')
      }

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
        throw buildOwnerDelegationError(preparePayload, 'Failed to prepare Rabby co-owner transaction.')
      }
      if (preparePayload.data.alreadyOwner) {
        setNotice('Rabby address is already an owner.')
        return
      }
      await sendPreparedOwnerTx(preparePayload.data.txRequest, normalized)
      setNotice('Rabby co-owner added.')
      await loadMe()
    } catch (rabbyError: any) {
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
      setAdvancedBusy(false)
    }
  }, [advancedOwnerAddress, authHeaders, loadMe, sendPreparedOwnerTx])

  const zoraCrossAppCount = zoraStatus?.zoraCrossAppAccounts?.length ?? 0
  const canShowAdvanced = Boolean(canonicalCswAddress)
  const baseAppUrl = ownerDelegationFlags?.baseAppUrl ?? null
  const needsBaseAppSetup = Boolean(ownerDelegationFlags?.needsBaseAppSetup)
  const needsEmbeddedWallet = Boolean(ownerDelegationFlags?.needsEmbeddedWallet)
  const zoraHandoffUrl = useMemo(() => buildZoraHandoffUrl({ returnPath: '/accounts', context: 'signup' }), [])
  const connectedOwnerReady = connectedOwnerState.value === true
  const signerClientReady = Boolean(walletClient?.account && typeof walletClient?.sendTransaction === 'function')
  const privySignerClientReady = Boolean(activeExternalOwnerWallet && ownerSignerAddress)
  const ownerApprovalReady = connectedOwnerReady && (signerClientReady || privySignerClientReady) && !needsEmbeddedWallet
  const ownerAuthorityState = useMemo(
    () =>
      deriveOwnerAuthorityState({
        canonicalCswAddress,
        connectedAddress: ownerSignerAddress,
        connectedCanonicalWalletSelected,
        connectedOwnerState,
      }),
    [canonicalCswAddress, ownerSignerAddress, connectedCanonicalWalletSelected, connectedOwnerState],
  )
  const connectedSignerLabel = ownerSignerAddress ? shortValue(ownerSignerAddress) : 'No wallet connected'
  const connectedSignerDetail = ownerApprovalReady
    ? ownerAuthorityState.detail
    : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
      ? 'Wallet connection is still finishing. Wait for the signer session to hydrate before approving the Base transaction.'
      : ownerAuthorityState.detail
  const readableCswOwners = useMemo(
    () => cswOwnersState.owners.filter((owner) => owner.ownerAddress),
    [cswOwnersState.owners],
  )
  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const journeyBadgeClass =
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] tracking-[0.08em] uppercase'
  const ownerChecklist = useMemo(
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
          ? '4626 can now add its embedded owner through one Base transaction.'
          : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
            ? 'Wait for the signer client to finish hydrating, then approve.'
            : 'Approval unlocks after a current owner is connected and verified.',
        state: ownerApprovalReady ? 'complete' : connectedOwnerReady ? 'active' : 'blocked',
      },
    ],
    [connectedOwnerReady, ownerApprovalReady, ownerAuthorityState.hint, ownerSignerAddress, privySignerClientReady, signerClientReady],
  )
  const ownerPrimaryCtaLabel = ownerApprovalReady
    ? 'Approve 4626 on this wallet'
    : needsEmbeddedWallet
      ? 'Provisioning embedded wallet…'
      : connectedOwnerReady && !(signerClientReady || privySignerClientReady)
        ? 'Finishing wallet session…'
        : 'Owner approval required'

  const providerCards = useMemo(() => {
    return PROVIDER_ROWS.map((row) => {
      const values = selectLinkedValues(me, row.provider)
      return { ...row, values, linked: values.length > 0 }
    })
  }, [me])

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
  }, [ownerInstallResumeState.requested, canonicalCswAddress, ownerApprovalReady])

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Accounts"
        description="Link identities, refresh optional Zora profile signals, and manage your canonical Coinbase Smart Wallet."
        canonicalPath="/accounts"
      />
      <div className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Accounts</div>
          <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-sm text-zinc-400">
            Start with Zora. If you already use a Coinbase Smart Wallet there, 4626 keeps that wallet as the primary surface and adds 4626 as an owner so you can continue with the same account.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">Sign in with Privy to manage account identities.</p>
            <button type="button" onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)} className="btn-accent btn-no-icon inline-flex">
              Sign in / Continue
            </button>
            <a href={getMarketingWaitlistEntryUrl()} className="text-xs text-zinc-500 hover:text-zinc-300">
              Back to waitlist
            </a>
          </div>
        ) : null}

        {loading ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">Loading account state…</div>
        ) : null}

        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div> : null}
        {ownerInstallResumeState.requested ? (
          <div className="rounded-2xl border border-brand-primary/30 bg-[linear-gradient(180deg,rgba(37,99,235,0.18),rgba(37,99,235,0.06))] px-5 py-4 text-sm text-brand-50 shadow-[0_0_0_1px_rgba(37,99,235,0.08)]">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-brand-200">
              <span className="inline-flex rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1">
                {ownerInstallResumeState.source === 'telegram' ? 'Continue from Telegram' : 'Continue setup'}
              </span>
              <span className="text-brand-100/70">Owner install required</span>
            </div>
            <div className="mt-2 text-base font-medium text-white">
              Your Telegram account is linked. Finish wallet setup here.
            </div>
            <div className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-50/85">
              4626 detected your Zora Coinbase Smart Wallet. The next step is to connect one of that wallet&apos;s current owners, verify authority on Base, and approve one transaction so 4626 can act through the same wallet.
            </div>
          </div>
        ) : null}
        {inTelegramMiniApp ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 space-y-2">
            <div>
              You are inside Telegram Mini App. Wallet-owner signatures (MetaMask/Rabby) are more reliable in an external browser context.
            </div>
            <a
              href="/accounts"
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100"
            >
              Open Accounts in browser
            </a>
          </div>
        ) : null}

        {!loading && privyAuthed && me ? (
          <>
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.95fr)]">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`${journeyBadgeClass} border-brand-primary/30 bg-brand-primary/10 text-brand-200`}>
                        Zora first
                      </span>
                      <span className={`${journeyBadgeClass} border-white/10 bg-white/5 text-zinc-400`}>
                        Existing CSW stays primary
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                        Bring your Zora smart wallet into 4626
                      </h2>
                      <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">
                        We are not trying to replace the wallet you already use on Zora. The preferred path is to link your Zora account, detect the Coinbase Smart Wallet that already represents you, and then add the 4626 owner so the same wallet can operate here.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-brand-primary/20 bg-black/30 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-brand-200">Step 1</div>
                          <div className="text-base font-medium text-white">Link your Zora identity</div>
                          <p className="text-sm leading-relaxed text-zinc-400">
                            Zora is the first pick because it gives us the cleanest path to your existing creator identity and canonical smart wallet.
                          </p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-xs ${
                          zoraLinked ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border border-white/10 bg-white/5 text-zinc-400'
                        }`}>
                          {zoraLinked ? 'Linked' : 'Action required'}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {!zoraLinked ? (
                          <button
                            type="button"
                            disabled={busyProvider === 'zora_cross_app'}
                            onClick={() => void onLinkZora()}
                            className="btn-accent btn-no-icon inline-flex"
                          >
                            {busyProvider === 'zora_cross_app' ? 'Linking…' : 'Link Zora'}
                          </button>
                        ) : null}
                        <a
                          href={zoraHandoffUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary btn-no-icon inline-flex"
                        >
                          Open Zora
                        </a>
                        <button
                          type="button"
                          disabled={busyProvider === 'zora_cross_app'}
                          onClick={() => void onRefreshZora()}
                          className="btn-secondary btn-no-icon inline-flex"
                        >
                          {busyProvider === 'zora_cross_app' ? 'Refreshing…' : 'Refresh Zora signals'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 2</div>
                          <div className="text-base font-medium text-white">Detect your Coinbase Smart Wallet</div>
                          <p className="text-sm leading-relaxed text-zinc-400">
                            If Base app already knows your CSW, we keep using it. If not, finish setup there first, then come back here.
                          </p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-xs ${
                          canonicalCswAddress ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border border-white/10 bg-white/5 text-zinc-400'
                        }`}>
                          {canonicalCswAddress ? 'Detected' : needsBaseAppSetup ? 'Base app required' : 'Waiting'}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                        <span className="text-zinc-500">Canonical CSW</span>
                        <span className="font-mono text-zinc-100">{shortValue(me.accountSignals.canonicalCswAddress)}</span>
                      </div>
                      {needsBaseAppSetup && baseAppUrl ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <a
                            href={baseAppUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary btn-no-icon inline-flex"
                          >
                            Open Base app
                          </a>
                          <span className="text-xs text-zinc-500">
                            Create or connect your CSW there, then return here.
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <section
                      ref={ownerInstallSectionRef}
                      tabIndex={-1}
                      className={`rounded-2xl p-4 sm:p-5 outline-none ${
                        ownerInstallResumeState.requested
                          ? 'border border-brand-primary/30 bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(255,255,255,0.02))] shadow-[0_0_0_1px_rgba(37,99,235,0.08)]'
                          : 'border border-white/10 bg-black/30'
                      }`}
                      aria-label="Owner install step"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 3</div>
                          <div className="text-base font-medium text-white">Enable 4626 signing on that wallet</div>
                          <p className="text-sm leading-relaxed text-zinc-400">
                            This adds the 4626 Privy embedded owner to your existing CSW. Your wallet stays primary; 4626 just gets permission to act through it.
                          </p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-xs ${
                          ownerApprovalReady
                            ? 'border border-brand-primary/30 bg-brand-primary/10 text-brand-200'
                            : ownerAuthorityState.badgeClass
                        }`}>
                          {canonicalCswAddress ? ownerPrimaryCtaLabel : 'Blocked'}
                        </div>
                      </div>
                      {ownerInstallResumeState.requested ? (
                        <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/10 px-3 py-3 text-xs leading-5 text-brand-50/90">
                          This step was resumed from another surface. Connect a current owner of the detected CSW, verify the signer, then approve the Base transaction below.
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        {ownerChecklist.map((step) => (
                          <div
                            key={step.title}
                            className={`rounded-xl border px-3 py-3 ${
                              step.state === 'complete'
                                ? 'border-emerald-400/20 bg-emerald-500/10'
                                : step.state === 'active'
                                  ? 'border-brand-primary/20 bg-brand-primary/10'
                                  : 'border-white/8 bg-black/20'
                            }`}
                          >
                            <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{step.title}</div>
                            <div className="mt-1 text-sm font-medium text-white">
                              {step.state === 'complete'
                                ? 'Complete'
                                : step.state === 'active'
                                  ? 'In progress'
                                  : 'Waiting'}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-zinc-400">{step.description}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-xs text-zinc-300">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Owner authority</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm text-zinc-100">{ownerAuthorityState.hint}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${ownerAuthorityState.badgeClass}`}>
                            {ownerAuthorityState.label}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Connected signer</div>
                          <div className="font-mono text-sm text-zinc-100">{connectedSignerLabel}</div>
                          <div className="text-xs text-zinc-500">{connectedSignerDetail}</div>
                        </div>
                        <div className="mt-3 rounded-xl border border-white/8 bg-black/25 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Current owners</div>
                          {cswOwnersState.status === 'loading' ? (
                            <div className="mt-2 text-xs text-zinc-500">Loading current CSW owners…</div>
                          ) : null}
                          {cswOwnersState.status === 'error' ? (
                            <div className="mt-2 text-xs text-rose-300">{cswOwnersState.error ?? 'Failed to load owner list.'}</div>
                          ) : null}
                          {cswOwnersState.status !== 'error' && readableCswOwners.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {readableCswOwners.map((owner) => {
                                const isConnectedOwner =
                                  Boolean(owner.ownerAddress && ownerSignerAddress) &&
                                  owner.ownerAddress!.toLowerCase() === ownerSignerAddress!.toLowerCase()
                                return (
                                  <span
                                    key={`${owner.index}:${owner.ownerAddress}`}
                                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${
                                      isConnectedOwner
                                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                        : 'border-white/10 bg-white/5 text-zinc-300'
                                    }`}
                                  >
                                    <span className="font-mono">{shortValue(owner.ownerAddress)}</span>
                                    {isConnectedOwner ? <span>Connected</span> : null}
                                  </span>
                                )
                              })}
                            </div>
                          ) : null}
                          {cswOwnersState.status === 'ready' && readableCswOwners.length === 0 ? (
                            <div className="mt-2 text-xs text-zinc-500">No readable EOA owners were returned for this CSW.</div>
                          ) : null}
                        </div>
                      </div>
                      {needsEmbeddedWallet ? (
                        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          Privy embedded wallet provisioning is still settling. Retry signer setup in a moment.
                        </div>
                      ) : null}
                      {inTelegramMiniApp ? (
                        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          Complete owner-wallet signatures from an external browser tab if you are using MetaMask or Rabby.
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {!connectedOwnerReady ? (
                          <button
                            type="button"
                            onClick={() => connectOwnerWallet()}
                            className="btn-secondary btn-no-icon inline-flex"
                          >
                            Connect owner wallet
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={advancedBusy || !canonicalCswAddress || !ownerApprovalReady}
                          onClick={() => void onEnable4626Signing()}
                          className="btn-primary btn-no-icon inline-flex"
                        >
                          {advancedBusy ? 'Preparing…' : ownerPrimaryCtaLabel}
                        </button>
                        {!connectedOwnerReady ? (
                          <button
                            type="button"
                            disabled={advancedBusy}
                            onClick={() => {
                              void (async () => {
                                const result = await checkEoaOwnershipOfCsw({
                                  publicClient,
                                  chainId: ownerSignerChainId,
                                  cswAddress: canonicalCswAddress,
                                  ownerAddress: ownerSignerAddress ?? null,
                                })
                                setConnectedOwnerState(result)
                              })()
                            }}
                            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                          >
                            Retry owner check
                          </button>
                        ) : null}
                        <span className="text-xs text-zinc-500">
                          Server prepares the transaction. One of the currently installed CSW owners signs it on Base, then 4626 refreshes the account automatically.
                        </span>
                      </div>
                      {!connectedOwnerReady ? (
                        <div className="mt-3 text-xs text-zinc-500">
                          Privy will open a wallet modal with MetaMask, Coinbase Wallet, detected browser wallets like Rabby, and WalletConnect fallback.
                          {providerCollision.shouldDisableInjectedConnector
                            ? ' This browser still reports an injected-provider collision, so Coinbase/Base may be the most reliable option if a browser wallet fails to answer.'
                            : ''}
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-white/10 bg-black/35 p-5 space-y-4">
                    <div className="space-y-1">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Account summary</div>
                      <h3 className="text-lg font-medium text-white">Current state</h3>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Email</div>
                        <div className="mt-1 text-zinc-100">{me.email ?? 'Not linked'}</div>
                        <div className="mt-1 text-xs text-zinc-500">{me.emailVerified ? 'Verified and canonical' : 'Needs verification'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Points</div>
                          <div className="mt-1 text-xl font-semibold text-zinc-100">{me.score.points}</div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Tier</div>
                          <div className="mt-1 text-xl font-semibold text-zinc-100">{me.score.tier}</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 space-y-2">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Signals</div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">Zora handle</span>
                          <span className="text-zinc-100">{me.accountSignals.zoraHandle ? `@${me.accountSignals.zoraHandle}` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">Creator coin</span>
                          <span className="font-mono text-zinc-100">{shortValue(me.accountSignals.creatorCoin?.address)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">Cross-app accounts</span>
                          <span className="text-zinc-100">{zoraCrossAppCount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/leaderboard" className="btn-secondary btn-no-icon inline-flex">
                        Open leaderboard
                      </Link>
                      <button
                        type="button"
                        disabled={busyProvider === 'email'}
                        onClick={() => void onLinkProvider('email')}
                        className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                      >
                        {busyProvider === 'email' ? 'Syncing…' : 'Verify / update email'}
                      </button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-black/35 p-5 space-y-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Why this setup</div>
                    <div className="space-y-2 text-sm leading-relaxed text-zinc-400">
                      <p>
                        4626 should operate through the wallet you already use for your creator identity, not force you into a parallel account model.
                      </p>
                      <p>
                        That is why we prefer Zora first, then Base app for CSW confirmation, and only after that do we install the 4626 owner.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </section>

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Linked identities</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Secondary account controls live here after the primary Zora and CSW setup is done.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {providerCards.map((provider) => (
                  <div key={provider.provider} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{provider.label}</div>
                        <div className="text-xs text-zinc-500">{provider.hint}</div>
                      </div>
                      <span className={`text-xs ${provider.linked ? 'text-emerald-300' : 'text-zinc-500'}`}>
                        {provider.linked ? 'Linked' : 'Unlinked'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      {provider.values.length > 0 ? provider.values.map((value) => shortValue(value)).join(', ') : 'No linked values'}
                    </div>
                    {provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable ? (
                      <div className="text-[11px] text-amber-300/90">
                        Run <span className="font-mono">/link</span> in Telegram, then open the Mini App to link.
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={
                          busyProvider === provider.provider ||
                          (provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable)
                        }
                        onClick={() => void onLinkProvider(provider.provider)}
                        className="btn-secondary btn-no-icon inline-flex"
                      >
                        {busyProvider === provider.provider
                          ? 'Working…'
                          : provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable
                            ? 'Link in Telegram'
                            : 'Link'}
                      </button>
                      {provider.linked ? (
                        <button
                          type="button"
                          disabled={busyProvider === provider.provider}
                          onClick={() => void onUnlinkProvider(provider.provider)}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                        >
                          Unlink
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium">Advanced</h2>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
                >
                  {advancedOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {advancedOpen ? (
                <div className="space-y-4">
                  {!canShowAdvanced ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                      <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                      {ownerDelegationFlags?.needsBaseAppSetup ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <a
                            href={ownerDelegationFlags.baseAppUrl ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary btn-no-icon inline-flex"
                          >
                            Get Base app
                          </a>
                          <span className="text-xs text-zinc-500">Create or connect your CSW in Base app, then return here to resume.</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {ownerDelegationFlags ? (
                        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-1">
                          {ownerDelegationFlags.needsBaseAppSetup ? (
                            <div>
                              Finish Coinbase Smart Wallet setup in Base app, then return here and retry.
                              {ownerDelegationFlags.baseAppUrl ? (
                                <>
                                  {' '}
                                  <a
                                    href={ownerDelegationFlags.baseAppUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2"
                                  >
                                    Open Base app
                                  </a>
                                  .
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {ownerDelegationFlags.needsEmbeddedWallet ? (
                            <div>Privy embedded wallet provisioning is still settling. Retry signer setup in a moment.</div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 space-y-3">
                        <div className="text-sm font-medium text-amber-100">Add Rabby as co-owner (advanced)</div>
                        <p className="text-xs text-amber-200/80">
                          Never automatic. Requires explicit confirmation and owner wallet signature.
                        </p>
                        <input
                          value={advancedOwnerAddress}
                          onChange={(event) => setAdvancedOwnerAddress(event.target.value)}
                          placeholder="0x..."
                          className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-300/40"
                        />
                        <button
                          type="button"
                          disabled={advancedBusy}
                          onClick={() => void onAddRabbyCoOwner()}
                          className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs text-amber-100 hover:border-amber-300/50"
                        >
                          {advancedBusy ? 'Preparing…' : 'Add Rabby co-owner'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
