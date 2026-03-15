import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrossAppAccounts, useLogin, usePrivy } from '@privy-io/react-auth'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'

import { apiFetch } from '@/lib/apiBase'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'
import { performZoraCrossAppAuth } from '@/lib/privy/zoraCrossApp'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { readPrivyTelegramLaunchParams } from '@/lib/telegramWebApp'
import { selectZoraCrossAppAuthAction } from '@/components/waitlist/ownerInstallMapping'
import { isPrivyRedirectUrlNotAllowedError, sanitizeCrossAppRedirectUrlForAuth } from '@/hooks/siweAuthCrossApp'
import { PageMeta } from '@/components/seo/PageMeta'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type OwnerDelegationFlags = {
  needsConnectedOwnerWallet?: boolean
  needsZoraIdentitySignal?: boolean
}

type AccountLinkProvider = 'google' | 'apple' | 'twitter' | 'telegram' | 'tiktok' | 'external_eoa' | 'email' | 'zora_cross_app'

type AccountsMeResponse = {
  privyUserId: string
  email: string | null
  linkedMethods: Record<string, string[]>
  zora: {
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

type PrepareOwnerResponse =
  | { alreadyOwner: true }
  | {
      alreadyOwner: false
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
    }

type ConfirmOwnerResponse = {
  isOwner: boolean
  canonicalCswAddress: string
  ownerAddress: string
  txHash: string | null
}

type ProviderRow = {
  provider: AccountLinkProvider
  label: string
  hint: string
}

const PROVIDER_ROWS: ProviderRow[] = [
  { provider: 'email', label: 'Email', hint: 'Notification channel' },
  { provider: 'google', label: 'Google', hint: 'OAuth identity' },
  { provider: 'apple', label: 'Apple', hint: 'OAuth identity' },
  { provider: 'twitter', label: 'Twitter/X', hint: 'Social identity' },
  { provider: 'telegram', label: 'Telegram', hint: 'Social identity' },
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

function readApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const maybeError = (payload as { error?: unknown }).error
    if (typeof maybeError === 'string' && maybeError.trim()) return maybeError
  }
  return fallback
}

function readOwnerDelegationFlags(payload: unknown): OwnerDelegationFlags {
  if (!payload || typeof payload !== 'object') return {}
  const record = payload as Record<string, unknown>
  return {
    ...(record.needsConnectedOwnerWallet === true ? { needsConnectedOwnerWallet: true } : null),
    ...(record.needsZoraIdentitySignal === true ? { needsZoraIdentitySignal: true } : null),
  }
}

function buildOwnerDelegationError(payload: unknown, fallback: string): Error & OwnerDelegationFlags {
  const flags = readOwnerDelegationFlags(payload)
  const hint = flags.needsZoraIdentitySignal
    ? 'Link Zora first so we can resolve your canonical CSW.'
    : flags.needsConnectedOwnerWallet
      ? 'Connect an owner wallet (for example Coinbase Wallet) and retry.'
      : ''
  const message = hint ? `${readApiError(payload, fallback)} ${hint}` : readApiError(payload, fallback)
  const error = new Error(message) as Error & OwnerDelegationFlags
  if (flags.needsConnectedOwnerWallet) error.needsConnectedOwnerWallet = true
  if (flags.needsZoraIdentitySignal) error.needsZoraIdentitySignal = true
  return error
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
  const privy = useSafePrivy()
  const { login } = useSafeLogin()
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossApp()
  const { data: walletClient } = useWalletClient()
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()

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

  const canonicalCswAddress = me?.zora?.canonicalCswAddress ?? null
  const zoraLinked = Boolean(zoraStatus?.zoraLinked || me?.zora?.linked)

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
      await runCanonicalizationPipeline({
        privyToken: token,
      })
      const headers = {
        'Content-Type': 'application/json',
        'X-Privy-Token': token,
      }
      const [meRes, zoraRes] = await Promise.all([
        apiFetch('/api/accounts/me', { method: 'GET', headers }),
        apiFetch('/api/zora/link/status', { method: 'POST', headers, body: JSON.stringify({}) }),
      ])

      const mePayload = (await meRes.json().catch(() => null)) as ApiEnvelope<AccountsMeResponse> | null
      if (!meRes.ok || !mePayload?.success || !mePayload.data) {
        throw new Error(readApiError(mePayload, 'Failed to load account state.'))
      }

      const zoraPayload = (await zoraRes.json().catch(() => null)) as ApiEnvelope<ZoraLinkStatusResponse> | null
      if (!zoraRes.ok || !zoraPayload?.success || !zoraPayload.data) {
        throw new Error(readApiError(zoraPayload, 'Failed to load Zora status.'))
      }

      setMe(mePayload.data)
      setZoraStatus(zoraPayload.data)
    } catch (loadError: any) {
      setError(typeof loadError?.message === 'string' ? loadError.message : 'Failed to load account state.')
    } finally {
      setLoading(false)
    }
  }, [getAccessToken, privyAuthed])

  useEffect(() => {
    if (props.initialData) return
    void loadMe()
  }, [loadMe, props.initialData])

  const performClientSideLink = useCallback(
    async (provider: AccountLinkProvider) => {
      if (provider === 'zora_cross_app') {
        const action = selectZoraCrossAppAuthAction({
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
        if (!called && typeof login === 'function') await login()
        return
      }

      if (provider === 'telegram') {
        const launchParams = readPrivyTelegramLaunchParams()
        if (launchParams?.initDataRaw) {
          const calledWithLaunchParams = await maybeCallMethod(
            privy,
            ['linkTelegram', 'linkTelegramAccount'],
            [{ launchParams }],
          )
          if (calledWithLaunchParams) return
        }
      }

      const linkMethods: Record<AccountLinkProvider, string[]> = {
        email: ['linkEmail', 'linkEmailAccount'],
        google: ['linkGoogle', 'linkGoogleAccount'],
        apple: ['linkApple', 'linkAppleAccount'],
        twitter: ['linkTwitter', 'linkTwitterAccount'],
        telegram: ['linkTelegram', 'linkTelegramAccount'],
        tiktok: ['linkTiktok', 'linkTikTok', 'linkTiktokAccount', 'linkTikTokAccount'],
        external_eoa: ['linkWallet'],
        zora_cross_app: [],
      }
      const called = await maybeCallMethod(privy, linkMethods[provider])
      if (!called && typeof login === 'function') {
        await login()
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
      telegram: ['unlinkTelegram', 'unlinkTelegramAccount'],
      tiktok: ['unlinkTiktok', 'unlinkTikTok', 'unlinkTiktokAccount', 'unlinkTikTokAccount'],
      external_eoa: ['unlinkWallet'],
      zora_cross_app: [],
    }
    await maybeCallMethod(privy, unlinkMethods[provider], value ? [{ value }] : [])
  }, [privy])

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
      await callLinkEndpoint(provider)
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
      await performClientSideLink('zora_cross_app')
      await callLinkEndpoint('zora_cross_app')

      const headers = await authHeaders()
      const resolveRes = await apiFetch('/api/zora/resolve', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      const resolvePayload = (await resolveRes.json().catch(() => null)) as ApiEnvelope<ZoraResolveResponse> | null
      if (!resolveRes.ok || !resolvePayload?.success || !resolvePayload.data) {
        throw new Error(readApiError(resolvePayload, 'Failed to resolve Zora signals.'))
      }
      setNotice('Zora linked and signals resolved.')
      await loadMe()
    } catch (zoraError: any) {
      if (isPrivyRedirectUrlNotAllowedError(zoraError)) {
        setError('Privy redirect URL is not allowed for this origin. Add this app URL in Privy settings and retry.')
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
      if (!walletClient || !walletClient.account) throw new Error('Connect an owner wallet to send this transaction.')
      if (chainId !== base.id && typeof switchChainAsync === 'function') {
        await switchChainAsync({ chainId: base.id })
      }

      const txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        chain: base,
        to: txRequest.to,
        data: txRequest.data,
        value: 0n,
      })

      const headers = await authHeaders()
      const confirmRes = await apiFetch('/api/wallet/confirm-owner', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          txHash,
          ownerAddress: ownerAddress ?? null,
        }),
      })
      const confirmPayload = (await confirmRes.json().catch(() => null)) as ApiEnvelope<ConfirmOwnerResponse> | null
      if (!confirmRes.ok || !confirmPayload?.success || !confirmPayload.data?.isOwner) {
        throw new Error(readApiError(confirmPayload, 'Owner status is not confirmed yet.'))
      }
    },
    [authHeaders, chainId, switchChainAsync, walletClient],
  )

  const onEnable4626Signing = useCallback(async () => {
    if (!canonicalCswAddress) return
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
      await sendPreparedOwnerTx(preparePayload.data.txRequest, null)
      setNotice('4626 signing is enabled on your canonical CSW.')
      await loadMe()
    } catch (ownerError: any) {
      const flags = {
        ...(ownerError?.needsConnectedOwnerWallet === true ? { needsConnectedOwnerWallet: true } : null),
        ...(ownerError?.needsZoraIdentitySignal === true ? { needsZoraIdentitySignal: true } : null),
      }
      setOwnerDelegationFlags(Object.keys(flags).length > 0 ? flags : null)
      setError(typeof ownerError?.message === 'string' ? ownerError.message : 'Failed to enable 4626 signing.')
    } finally {
      setAdvancedBusy(false)
    }
  }, [authHeaders, canonicalCswAddress, loadMe, sendPreparedOwnerTx])

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
        ...(rabbyError?.needsConnectedOwnerWallet === true ? { needsConnectedOwnerWallet: true } : null),
        ...(rabbyError?.needsZoraIdentitySignal === true ? { needsZoraIdentitySignal: true } : null),
      }
      setOwnerDelegationFlags(Object.keys(flags).length > 0 ? flags : null)
      setError(typeof rabbyError?.message === 'string' ? rabbyError.message : 'Failed to add Rabby co-owner.')
    } finally {
      setAdvancedBusy(false)
    }
  }, [advancedOwnerAddress, authHeaders, loadMe, sendPreparedOwnerTx])

  const zoraCrossAppCount = zoraStatus?.zoraCrossAppAccounts?.length ?? 0
  const canShowAdvanced = Boolean(canonicalCswAddress)

  const providerCards = useMemo(() => {
    return PROVIDER_ROWS.map((row) => {
      const values = selectLinkedValues(me, row.provider)
      return { ...row, values, linked: values.length > 0 }
    })
  }, [me])

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Accounts"
        description="Link identities, refresh Zora signals, and manage advanced 4626 wallet permissions."
        canonicalPath="/accounts"
      />
      <div className="mx-auto w-full max-w-4xl px-6 py-10 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Accounts</div>
          <h1 className="text-3xl font-semibold">Identity management</h1>
          <p className="text-sm text-zinc-400">
            Accounts is the canonical place to link identities, refresh Zora signals, and manage optional advanced wallet permissions.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">Sign in with Privy to manage account identities.</p>
            <button type="button" onClick={() => void login()} className="btn-accent btn-no-icon inline-flex">
              Sign in / Continue
            </button>
            <Link to="/#waitlist" className="text-xs text-zinc-500 hover:text-zinc-300">Back to waitlist</Link>
          </div>
        ) : null}

        {loading ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">Loading account state…</div>
        ) : null}

        {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div> : null}

        {!loading && privyAuthed && me ? (
          <>
            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
              <h2 className="text-lg font-medium">Notifications</h2>
              <div className="text-sm text-zinc-300">
                <div>Email: <span className="text-zinc-100">{me.email ?? 'Not linked'}</span></div>
                <div>Verified: <span className="text-zinc-100">{selectLinkedValues(me, 'email').length > 0 ? 'Yes' : 'No'}</span></div>
              </div>
              <button
                type="button"
                disabled={busyProvider === 'email'}
                onClick={() => void onLinkProvider('email')}
                className="btn-secondary btn-no-icon inline-flex"
              >
                {busyProvider === 'email' ? 'Syncing…' : 'Verify / update email'}
              </button>
            </section>

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
              <h2 className="text-lg font-medium">Linked identities</h2>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyProvider === provider.provider}
                        onClick={() => void onLinkProvider(provider.provider)}
                        className="btn-secondary btn-no-icon inline-flex"
                      >
                        {busyProvider === provider.provider ? 'Working…' : 'Link'}
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
              <h2 className="text-lg font-medium">Zora</h2>
              <div className="grid gap-2 text-sm text-zinc-300">
                <div>Zora linked: <span className="text-zinc-100">{zoraLinked ? 'Yes' : 'No'}</span></div>
                <div>Cross-app accounts: <span className="text-zinc-100">{zoraCrossAppCount}</span></div>
                <div>Canonical CSW: <span className="text-zinc-100">{shortValue(me.zora.canonicalCswAddress)}</span></div>
                <div>Creator coin: <span className="text-zinc-100">{shortValue(me.zora.creatorCoin?.address)}</span></div>
                <div>Zora handle: <span className="text-zinc-100">{me.zora.zoraHandle ? `@${me.zora.zoraHandle}` : '—'}</span></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!zoraLinked ? (
                  <button type="button" disabled={busyProvider === 'zora_cross_app'} onClick={() => void onLinkZora()} className="btn-accent btn-no-icon inline-flex">
                    {busyProvider === 'zora_cross_app' ? 'Linking…' : 'Link Zora'}
                  </button>
                ) : null}
                <button type="button" disabled={busyProvider === 'zora_cross_app'} onClick={() => void onRefreshZora()} className="btn-secondary btn-no-icon inline-flex">
                  {busyProvider === 'zora_cross_app' ? 'Refreshing…' : 'Refresh Zora signals'}
                </button>
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
                      Resolve a canonical Zora CSW first to enable advanced owner management.
                    </div>
                  ) : (
                    <>
                      {ownerDelegationFlags ? (
                        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-1">
                          {ownerDelegationFlags.needsZoraIdentitySignal ? (
                            <div>Link Zora first so we can resolve your canonical CSW before signer setup.</div>
                          ) : null}
                          {ownerDelegationFlags.needsConnectedOwnerWallet ? (
                            <div>Connect an owner EOA wallet and retry signer setup.</div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                        <div className="text-sm font-medium">Enable 4626 signing (add Privy embedded EOA as CSW owner)</div>
                        <p className="text-xs text-zinc-500">
                          Optional. Transaction is prepared server-side and sent client-side with your currently connected owner wallet.
                        </p>
                        <button
                          type="button"
                          disabled={advancedBusy}
                          onClick={() => void onEnable4626Signing()}
                          className="btn-secondary btn-no-icon inline-flex"
                        >
                          {advancedBusy ? 'Preparing…' : 'Enable 4626 signing'}
                        </button>
                      </div>

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

            <section className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-2">
              <h2 className="text-lg font-medium">Score</h2>
              <div className="text-sm text-zinc-300">Points: <span className="text-zinc-100">{me.score.points}</span></div>
              <div className="text-sm text-zinc-300">Tier: <span className="text-zinc-100">{me.score.tier}</span></div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

