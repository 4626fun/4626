import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Vault,
  Wallet,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { Address } from 'viem'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { AccountModeIndicator } from '@/components/ui/AccountModeIndicator'
import { LoadingText } from '@/components/ui/LoadingState'
import { AmoeEntryCard } from '@/components/lottery/AmoeEntryCard'
import { apiFetch } from '@/lib/api/apiBase'
import { fetchDebankTokenList, type DebankToken, type DebankTokenList } from '@/lib/debank/client'
import { isLensGroveEnabled } from '@/lib/flags/flags'
import { resolveLensUri, uploadImmutableBlob, type GroveUploadResult } from '@/lib/lens/grove'
import { fetchZoraCoin } from '@/lib/zora/client'
import type { ZoraCoin } from '@/lib/zora/types'
import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountContext } from '@/wallet/accountContext'
import {
  buildPortfolioImageProxyUrl,
  deriveCreatorCoinOptions,
  normalizeAddress,
  resolvePortfolioAddresses,
  isEvmAddress,
} from '@/features/portfolio/portfolioViewModel'

function shortAddr(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  const amount = value
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`
  return `$${amount.toFixed(2)}`
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value === 0) return '0'
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function formatDateTime(value: string | null): string {
  if (!value) return '--'
  const next = new Date(value)
  if (Number.isNaN(next.getTime())) return value
  return next.toLocaleString()
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = []
  let index = 0

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = index++
      output[current] = await fn(items[current]!)
    }
  })

  await Promise.all(workers)
  return output
}

function seededSeries(seed: string, base: number, points: number): number[] {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  }

  const rand = () => {
    hash ^= hash << 13
    hash ^= hash >>> 17
    hash ^= hash << 5
    return (hash >>> 0) / 4294967296
  }

  const output: number[] = []
  let value = Number.isFinite(base) ? base : 0
  const amplitude = Math.max(1, value * 0.03)
  for (let i = 0; i < points; i++) {
    const drift = (rand() - 0.5) * amplitude
    value = Math.max(0, value + drift)
    output.push(value)
  }
  return output
}

function Sparkline(props: { series: number[] }) {
  const { series } = props
  const width = 640
  const height = 220
  const padding = 10
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = Math.max(1e-6, max - min)

  const path = series
    .map((value, index) => {
      const x = padding + (index / Math.max(1, series.length - 1)) * (width - padding * 2)
      const y = padding + (1 - (value - min) / span) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const area = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
      <defs>
        <linearGradient id="portfolioSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#portfolioSparkFill)" />
      <path d={path} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

type ProfileField = { value: string | null; source: string; updated_at: string }

type PortfolioApiResponse = {
  mode: 'self' | 'public'
  profile: {
    profileId: number
    primarySmartWallet: string | null
    primaryEmbeddedEoa: string | null
    displayName: string | null
    bio: string | null
    website: string | null
    avatarUrl: string | null
    bannerUrl: string | null
    avatarLensUri: string | null
    bannerLensUri: string | null
    profileFields: Record<string, ProfileField>
    appAccessStatus: string | null
    updatedAt: string | null
  }
  wallets: Array<{
    address: string
    walletType: string | null
    provider: string | null
    chain: string | null
    isPrimary: boolean
    isCanonicalSmartWallet: boolean
    isEmbeddedEoa: boolean
    verifiedAt: string | null
  }>
  onchainSummary: {
    totalUsdValue: number | null
    asOf: string | null
  }
  onchainIdentity: {
    source: 'ens' | 'basename'
    address: string
    ensName: string | null
    basename: string | null
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    website: string | null
    twitter: string | null
    github: string | null
    discord: string | null
  } | null
}

type Holding = {
  token: DebankToken
  coin: ZoraCoin
  coinType: 'CREATOR' | 'CONTENT'
}

type PortfolioTab = 'overview' | 'tokens' | 'nfts' | 'activity'
type Timeframe = '1D' | '1W' | '1M' | '1Y'

function HoldingsTable(props: { items: Holding[]; loading: boolean; emptyLabel: string }) {
  const { items, loading, emptyLabel } = props

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[12px] text-zinc-600">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden divide-y divide-zinc-800/70 sm:block">
        <div className="grid grid-cols-[minmax(0,1fr)_92px_92px_104px] gap-3 px-4 py-2.5 app-meta-value text-zinc-600">
          <div>Token</div>
          <div className="text-right">Price</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Value</div>
        </div>
        {items.map((holding) => {
          const token = holding.token
          const name = token.symbol || token.name || holding.coin.symbol || holding.coin.name || token.id
          const price = typeof token.price === 'number' ? token.price : null
          const tokenLogoSrc = buildPortfolioImageProxyUrl(token.logoUrl)
          return (
            <div key={`${holding.coinType}:${token.id}`} className="grid grid-cols-[minmax(0,1fr)_92px_92px_104px] items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {tokenLogoSrc ? (
                  <img src={tokenLogoSrc} alt="" className="h-7 w-7 shrink-0 rounded-full border border-white/10" />
                ) : (
                  <div className="h-7 w-7 shrink-0 rounded-full border border-white/10 bg-white/5" />
                )}
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[12px] text-white">{name}</div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                        holding.coinType === 'CREATOR'
                          ? 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'
                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                      }`}
                    >
                      {holding.coinType === 'CREATOR' ? 'Creator' : 'Content'}
                    </span>
                  </div>
                  <div className="app-meta-value truncate text-zinc-600">{shortAddr(String(token.id || ''))}</div>
                </div>
              </div>
              <div className="text-right text-[12px] tabular-nums text-zinc-200">{price != null ? formatUsd(price) : '--'}</div>
              <div className="text-right text-[12px] tabular-nums text-zinc-200">{formatAmount(token.amount)}</div>
              <div className="text-right text-[12px] tabular-nums text-zinc-200">{formatUsd(token.usdValue)}</div>
            </div>
          )
        })}
      </div>

      <div className="divide-y divide-zinc-800/70 sm:hidden">
        {items.map((holding) => {
          const token = holding.token
          const name = token.symbol || token.name || holding.coin.symbol || holding.coin.name || token.id
          const price = typeof token.price === 'number' ? token.price : null
          const tokenLogoSrc = buildPortfolioImageProxyUrl(token.logoUrl)
          return (
            <div key={`mobile:${holding.coinType}:${token.id}`} className="flex items-center gap-3 px-4 py-3">
              {tokenLogoSrc ? (
                <img src={tokenLogoSrc} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/10" />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full border border-white/10 bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12px] text-white">{name}</span>
                  <Badge variant={holding.coinType === 'CREATOR' ? 'canonical' : 'success'} size="xs">
                    {holding.coinType === 'CREATOR' ? 'Creator' : 'Content'}
                  </Badge>
                </div>
                <div className="app-meta-value mt-0.5 text-zinc-600">
                  {price != null ? formatUsd(price) : '--'} · {formatAmount(token.amount)}
                </div>
              </div>
              <div className="shrink-0 text-right text-[13px] tabular-nums text-zinc-200">{formatUsd(token.usdValue)}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function Portfolio() {
  const params = useParams<{ address?: string }>()
  const { address: wagmiAddress } = useAccount()
  const siwe = useSiweAuth()
  const accountContext = useAccountContext()
  const queryClient = useQueryClient()

  const routeAddress = typeof params.address === 'string' ? params.address.trim() : ''
  const resolvedAddresses = useMemo(
    () =>
      resolvePortfolioAddresses({
        routeAddress,
        wagmiAddress,
        siweAuthAddress: siwe.authAddress,
      }),
    [routeAddress, siwe.authAddress, wagmiAddress],
  )

  const publicAddress = resolvedAddresses.publicAddress
  const effectiveAddress = resolvedAddresses.effectiveAddress
  const isPublicMode = resolvedAddresses.isPublicMode
  const [tab, setTab] = useState<PortfolioTab>('overview')
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [selectedAmoeCreatorCoin, setSelectedAmoeCreatorCoin] = useState<Address | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [editAvatarLensUri, setEditAvatarLensUri] = useState('')
  const [editBannerLensUri, setEditBannerLensUri] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [avatarUploadFile, setAvatarUploadFile] = useState<File | null>(null)
  const [bannerUploadFile, setBannerUploadFile] = useState<File | null>(null)
  const [lensUploadBusy, setLensUploadBusy] = useState<'avatar' | 'banner' | null>(null)
  const [lensUploadError, setLensUploadError] = useState<string | null>(null)
  const lensEnabled = isLensGroveEnabled()

  const portfolioQuery = useQuery({
    queryKey: ['portfolio', 'me', publicAddress ?? 'self', effectiveAddress],
    enabled: Boolean(publicAddress || effectiveAddress),
    staleTime: 30_000,
    retry: 0,
    queryFn: async (): Promise<PortfolioApiResponse | null> => {
      const endpoint = publicAddress ? `/api/portfolio/me?address=${encodeURIComponent(publicAddress)}` : '/api/portfolio/me'
      const res = await apiFetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: PortfolioApiResponse | null } | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
  })

  useEffect(() => {
    const profile = portfolioQuery.data?.profile
    setEditDisplayName(profile?.displayName ?? '')
    setEditBio(profile?.bio ?? '')
    setEditWebsite(profile?.website ?? '')
    setEditAvatarUrl(profile?.avatarUrl ?? '')
    setEditBannerUrl(profile?.bannerUrl ?? '')
    setEditAvatarLensUri(profile?.avatarLensUri ?? '')
    setEditBannerLensUri(profile?.bannerLensUri ?? '')
    setEditError(null)
    setLensUploadError(null)
  }, [portfolioQuery.data?.profile])

  async function handleLensUpload(target: 'avatar' | 'banner', file: File | null) {
    if (!file || lensUploadBusy) return
    setLensUploadBusy(target)
    setLensUploadError(null)
    try {
      const result: GroveUploadResult = await uploadImmutableBlob(file, file.type || 'application/octet-stream')
      if (target === 'avatar') {
        setEditAvatarUrl(result.gatewayUrl)
        setEditAvatarLensUri(result.lensUri)
      } else {
        setEditBannerUrl(result.gatewayUrl)
        setEditBannerLensUri(result.lensUri)
      }
    } catch (error) {
      setLensUploadError(error instanceof Error ? error.message : 'Lens upload failed')
    } finally {
      setLensUploadBusy(null)
    }
  }

  const patchMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        displayName: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
        website: editWebsite.trim() || null,
        avatarUrl: editAvatarUrl.trim() || null,
        bannerUrl: editBannerUrl.trim() || null,
        avatarLensUri: editAvatarLensUri.trim() || null,
        bannerLensUri: editBannerLensUri.trim() || null,
      }
      const res = await apiFetch('/api/portfolio/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Profile update failed')
      }
      return true
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'me'] })
      setEditError(null)
    },
    onError: (error) => {
      setEditError(error instanceof Error ? error.message : 'Profile update failed')
    },
  })

  const walletSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/api/wallet/sync', { method: 'POST', headers: { Accept: 'application/json' } })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Wallet sync failed')
      }
      return true
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'me'] })
      setEditError(null)
    },
    onError: (error) => {
      setEditError(error instanceof Error ? error.message : 'Wallet sync failed')
    },
  })

  const tokenListQuery = useQuery({
    queryKey: ['portfolio', 'debankTokenList', effectiveAddress],
    enabled: Boolean(effectiveAddress),
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<DebankTokenList | null> => {
      if (!effectiveAddress) return null
      return await fetchDebankTokenList({ address: effectiveAddress, chainId: 'base' })
    },
  })

  const tokenAddressesKey = useMemo(() => {
    const tokens = tokenListQuery.data?.tokens ?? []
    const addresses = tokens
      .map((token) => String(token?.id || '').toLowerCase())
      .filter((value) => isEvmAddress(value))
      .sort()
    return addresses.join(',')
  }, [tokenListQuery.data?.tokens])

  const zoraCoinsQuery = useQuery({
    queryKey: ['portfolio', 'zoraCoinsForTokens', effectiveAddress, tokenAddressesKey],
    enabled: Boolean(effectiveAddress) && tokenAddressesKey.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<Record<string, ZoraCoin | null>> => {
      const tokens = tokenListQuery.data?.tokens ?? []
      const addresses = tokens
        .map((token) => String(token?.id || '').toLowerCase())
        .filter((value) => isEvmAddress(value))
      const unique = Array.from(new Set(addresses))

      const pairs = await mapWithLimit(unique, 6, async (addressLc) => {
        try {
          const coin = await fetchZoraCoin(addressLc as Address)
          return [addressLc, coin] as const
        } catch {
          return [addressLc, null] as const
        }
      })

      const out: Record<string, ZoraCoin | null> = {}
      for (const [addressLc, coin] of pairs) out[addressLc] = coin
      return out
    },
  })

  const holdings = useMemo(() => {
    const tokens = tokenListQuery.data?.tokens ?? []
    const coinMap = zoraCoinsQuery.data ?? {}

    const out: Holding[] = []
    for (const token of tokens) {
      const addressLc = String(token?.id || '').toLowerCase()
      if (!isEvmAddress(addressLc)) continue
      const coin = coinMap[addressLc] ?? null
      if (!coin) continue
      const coinType = String((coin as Record<string, unknown>)?.coinType || '').toUpperCase()
      if (coinType !== 'CREATOR' && coinType !== 'CONTENT') continue
      out.push({ token, coin, coinType: coinType as 'CREATOR' | 'CONTENT' })
    }

    out.sort((a, b) => (b.token.usdValue ?? 0) - (a.token.usdValue ?? 0))
    return out
  }, [tokenListQuery.data?.tokens, zoraCoinsQuery.data])

  const creatorHoldings = useMemo(() => holdings.filter((holding) => holding.coinType === 'CREATOR'), [holdings])
  const contentHoldings = useMemo(() => holdings.filter((holding) => holding.coinType === 'CONTENT'), [holdings])

  const creatorContentUsd = useMemo(() => {
    let sum = 0
    for (const holding of holdings) {
      if (typeof holding.token.usdValue === 'number' && Number.isFinite(holding.token.usdValue)) {
        sum += holding.token.usdValue
      }
    }
    return sum
  }, [holdings])

  const profile = portfolioQuery.data?.profile ?? null
  const wallets = portfolioQuery.data?.wallets ?? []
  const onchainIdentity = portfolioQuery.data?.onchainIdentity ?? null
  const profileFields = profile?.profileFields ?? {}

  const avatarLensPreviewUrl = useMemo(() => resolveLensUri(editAvatarLensUri.trim()), [editAvatarLensUri])
  const bannerLensPreviewUrl = useMemo(() => resolveLensUri(editBannerLensUri.trim()), [editBannerLensUri])

  const chartSeries = useMemo(() => {
    const seed = `${effectiveAddress || 'anon'}:${timeframe}`
    return seededSeries(seed, creatorContentUsd ?? 0, 64)
  }, [creatorContentUsd, effectiveAddress, timeframe])

  const tokenDataLoading = tokenListQuery.isLoading || zoraCoinsQuery.isLoading

  const creatorCoinOptions = useMemo(
    () => deriveCreatorCoinOptions(creatorHoldings.map((holding) => String(holding.token.id || ''))),
    [creatorHoldings],
  )

  useEffect(() => {
    setSelectedAmoeCreatorCoin((previous) => {
      if (creatorCoinOptions.length === 0) return null
      if (previous && creatorCoinOptions.includes(previous)) return previous
      return creatorCoinOptions[0] ?? null
    })
  }, [creatorCoinOptions])

  const amoeWalletAddress = useMemo(() => {
    const fromAccountContext = normalizeAddress(accountContext.activeAccount) ?? normalizeAddress(accountContext.signerAddress)
    if (fromAccountContext) return fromAccountContext
    return normalizeAddress(wagmiAddress) ?? normalizeAddress(siwe.authAddress)
  }, [accountContext.activeAccount, accountContext.signerAddress, siwe.authAddress, wagmiAddress])

  const holdingsPanel = (
    <div className="vault-surface vault-hover-lift min-h-[360px] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div>
          <div className="text-[12px] text-white">Holdings</div>
          <div className="app-meta-value text-zinc-600">
            {effectiveAddress ? `${creatorHoldings.length} creator · ${contentHoldings.length} content` : '--'}
          </div>
        </div>
        <div className="app-meta-value text-zinc-600">Base</div>
      </div>

      {tokenDataLoading ? (
        <HoldingsTable items={[]} loading emptyLabel="" />
      ) : null}

      {!tokenDataLoading && effectiveAddress && holdings.length === 0 ? (
        <div className="p-6 text-center">
          <p className="mb-4 text-[12px] text-zinc-500">No creator or content coin positions found.</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/swap"
              className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-[12px] text-brand-accent transition-colors hover:bg-brand-primary/20"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Get started with Swap
            </Link>
            <Link
              to="/explore/creators"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:bg-zinc-800/60"
            >
              <Vault className="h-3.5 w-3.5" />
              Explore creator vaults
            </Link>
          </div>
        </div>
      ) : null}

      {!tokenDataLoading && holdings.length > 0 ? (
        <div className="divide-y divide-zinc-800/70">
          <div className="px-4 py-3 text-[11px] font-medium text-zinc-500">Creator coins</div>
          <HoldingsTable items={creatorHoldings} loading={tokenDataLoading} emptyLabel="No creator coin balances found." />
          <div className="px-4 py-3 text-[11px] font-medium text-zinc-500">Content coins</div>
          <HoldingsTable items={contentHoldings} loading={tokenDataLoading} emptyLabel="No content coin balances found." />
        </div>
      ) : null}
    </div>
  )

  const walletsPanel = (
    <div className="vault-surface vault-hover-lift min-h-[148px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[12px] text-white">Connected wallets</div>
          <div className="app-meta-value text-zinc-600">Canonical + embedded ownership</div>
        </div>
        <Wallet className="h-4 w-4 text-zinc-500" />
      </div>
      {wallets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {wallets.map((wallet) => (
            <div key={wallet.address} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10px] text-zinc-400">
              <WalletProviderIcon
                provider={wallet.provider}
                walletType={wallet.walletType}
                isCanonicalSmartWallet={wallet.isCanonicalSmartWallet}
                size={12}
              />
              <span className="text-zinc-300">{shortAddr(wallet.address)}</span>
              {wallet.isCanonicalSmartWallet ? <Badge variant="canonical" size="xs">Smart Wallet</Badge> : null}
              {wallet.isEmbeddedEoa ? <Badge variant="eoa" size="xs">User Wallet</Badge> : null}
              {wallet.isPrimary ? <Badge variant="warning" size="xs">Primary</Badge> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="app-meta-value text-zinc-500">No linked wallets yet.</div>
      )}
      {!isPublicMode ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => void walletSyncMutation.mutateAsync()}
          loading={walletSyncMutation.isPending}
        >
          {!walletSyncMutation.isPending ? <RefreshCw className="h-3 w-3" /> : null}
          {walletSyncMutation.isPending ? 'Refreshing...' : 'Refresh wallets'}
        </Button>
      ) : null}
    </div>
  )

  const activityPanel = (
    <div className="vault-surface vault-hover-lift min-h-[148px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[12px] text-white">Recent activity</div>
          <div className="app-meta-value text-zinc-600">Last 7 days</div>
        </div>
        <BarChart3 className="h-4 w-4 text-zinc-500" />
      </div>
      <p className="text-[12px] text-zinc-600">Activity feed is coming next. Use Explore -&gt; Transactions for now.</p>
    </div>
  )

  return (
    <div className="relative min-h-screen pb-24 md:pb-0">
      <PageMeta
        title="Portfolio"
        description="View your token balances, vault positions, and on-chain activity on 4626."
        canonicalPath="/portfolio"
      />

      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="vault-surface vault-hover-lift p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[12px] text-zinc-200">
                    {effectiveAddress ? shortAddr(effectiveAddress) : 'Sign in'}
                  </div>
                  <AccountModeIndicator compact />
                  {isPublicMode ? <Badge variant="info" size="xs">Public view</Badge> : <Badge variant="success" size="xs">My portfolio</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {!isPublicMode ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void walletSyncMutation.mutateAsync()}
                      loading={walletSyncMutation.isPending}
                    >
                      {!walletSyncMutation.isPending ? <RefreshCw className="h-3 w-3" /> : null}
                      {walletSyncMutation.isPending ? 'Syncing...' : 'Sync wallets'}
                    </Button>
                  ) : null}
                  <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-zinc-300">
                    Total {formatUsd(portfolioQuery.data?.onchainSummary?.totalUsdValue)}
                  </div>
                </div>
              </div>

              <div className="app-meta-value mt-3 flex flex-wrap items-center gap-2 text-zinc-500">
                <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1">
                  Status: {portfolioQuery.isLoading
                    ? <LoadingText intent="processing" size="sm" labelOverride="Syncing..." />
                    : portfolioQuery.data ? 'Synced' : 'Not synced'}
                </span>
                <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1">
                  Updated: {formatDateTime(profile?.updatedAt ?? null)}
                </span>
                <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1">
                  Chain summary as of {formatDateTime(portfolioQuery.data?.onchainSummary?.asOf ?? null)}
                </span>
              </div>
            </div>

            {(portfolioQuery.isError || tokenListQuery.isError) ? (
              <div className="mt-4">
                <Alert
                  variant="error"
                  title="Failed to load portfolio data"
                  action={{
                    label: 'Retry',
                    onClick: () => {
                      if (portfolioQuery.isError) void portfolioQuery.refetch()
                      if (tokenListQuery.isError) void tokenListQuery.refetch()
                    },
                  }}
                >
                  Could not fetch your balance data. Check your connection and try again.
                </Alert>
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-black/35 p-2">
              {(['overview', 'tokens', 'nfts', 'activity'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                    tab === value
                      ? 'border-white/12 bg-white/8 text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {value === 'nfts' ? 'NFTs' : value[0]!.toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>

          </motion.div>

          {tab === 'overview' ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="vault-surface vault-hover-lift overflow-hidden"
                >
                  <div className="border-b border-white/8 p-5">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Portfolio value</div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="text-[2.15rem] font-semibold tracking-tight text-white tabular-nums">
                        {formatUsd(creatorContentUsd)}
                      </div>
                      <div className="app-meta-value text-right text-zinc-500">Creator + content holdings on Base</div>
                    </div>
                  </div>
                  <div className="px-3 pt-2">
                    <Sparkline series={chartSeries} />
                  </div>
                  <div className="flex items-center justify-between p-4 pt-2">
                    <div className="flex items-center gap-2">
                      {(['1D', '1W', '1M', '1Y'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTimeframe(value)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                            timeframe === value
                              ? 'border-white/12 bg-white/8 text-white'
                              : 'border-zinc-900 text-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="app-meta-value flex items-center gap-2 text-zinc-600">
                      <span className="rounded-full border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px]">
                        Simulated trend
                      </span>
                      {tokenDataLoading ? <LoadingText intent="processing" size="sm" labelOverride="Loading..." /> : tokenListQuery.data ? 'Live balances' : '--'}
                    </div>
                  </div>
                </motion.div>

                <div className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.08 }}
                    className="vault-surface vault-hover-lift min-h-[260px] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-[12px] text-white">AMOE Free Entry</div>
                        <div className="app-meta-value text-zinc-600">No-purchase path with credit-based check-ins</div>
                      </div>
                      {selectedAmoeCreatorCoin ? (
                        <a
                          href={`/vault/${selectedAmoeCreatorCoin}`}
                          className="inline-flex items-center gap-1 text-[11px] text-brand-accent hover:text-brand-primary"
                        >
                          View vault <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>

                    <div className="mb-3">
                      <label className="app-meta-value mb-1 block text-zinc-500">Creator coin for AMOE entry</label>
                      <select
                        value={selectedAmoeCreatorCoin ?? ''}
                        onChange={(event) => {
                          const next = event.target.value
                          setSelectedAmoeCreatorCoin(isEvmAddress(next) ? next : null)
                        }}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/4 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        {creatorCoinOptions.length === 0 ? <option value="">No creator coin holdings found</option> : null}
                        {creatorCoinOptions.map((address) => (
                          <option key={address} value={address}>
                            {shortAddr(address)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {creatorCoinOptions.length > 0 ? (
                      <AmoeEntryCard walletAddress={amoeWalletAddress} creatorCoin={selectedAmoeCreatorCoin} />
                    ) : (
                      <Alert variant="info">
                        Add a creator coin position to enable one-click AMOE entry from Portfolio.
                      </Alert>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.11 }}
                    className="vault-surface vault-hover-lift min-h-[230px] p-4"
                  >
                    <div className="mb-3 text-[12px] text-white">Quick actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Send', Icon: ArrowUpRight },
                        { label: 'Receive', Icon: ArrowDownLeft },
                        { label: 'Buy', Icon: Plus },
                        { label: 'More', Icon: MoreHorizontal },
                      ].map(({ label, Icon }) => (
                        <button
                          key={label}
                          type="button"
                          title={`${label} - coming soon`}
                          aria-label={`${label} (coming soon)`}
                          className="cursor-not-allowed rounded-xl border border-zinc-800/60 bg-black/20 p-4 text-left opacity-60"
                          disabled
                        >
                          <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-400">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {label}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-3">
                      <div className="app-meta-value text-zinc-600">Swapped this week</div>
                      <div className="mt-1 text-[16px] tabular-nums text-white">--</div>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                {holdingsPanel}
                <div className="space-y-5">
                  {walletsPanel}
                  {activityPanel}
                </div>
              </div>

              {!isPublicMode ? (
                <details className="vault-surface group overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-white">
                    <span>Profile and identity settings</span>
                    <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 border-t border-white/8 p-4">
                    <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                      <div className="text-[10px] font-medium text-zinc-500">Auto-discovered identity</div>
                      {onchainIdentity ? (
                        <div className="mt-2 space-y-1 text-[11px] text-zinc-400">
                          <div>
                            Source: <span className="text-zinc-200">{onchainIdentity.source === 'ens' ? 'ENS' : 'Basename'}</span>
                          </div>
                          <div>
                            Address: <span className="text-zinc-200">{shortAddr(onchainIdentity.address)}</span>
                          </div>
                          <div>
                            Name: <span className="text-zinc-200">{onchainIdentity.displayName ?? '--'}</span>
                          </div>
                          <div>
                            Website: <span className="text-zinc-200">{onchainIdentity.website ?? '--'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="app-meta-value mt-2 text-zinc-500">No ENS/Basename profile detected yet.</div>
                      )}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <Input placeholder="Display name" value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} />
                      <Input placeholder="Website" value={editWebsite} onChange={(event) => setEditWebsite(event.target.value)} />
                      <Input placeholder="Avatar URL" value={editAvatarUrl} onChange={(event) => setEditAvatarUrl(event.target.value)} />
                      <Input placeholder="Banner URL" value={editBannerUrl} onChange={(event) => setEditBannerUrl(event.target.value)} />
                      <Input
                        placeholder="Avatar Lens URI"
                        className="font-mono"
                        value={editAvatarLensUri}
                        onChange={(event) => setEditAvatarLensUri(event.target.value)}
                      />
                      <Input
                        placeholder="Banner Lens URI"
                        className="font-mono"
                        value={editBannerLensUri}
                        onChange={(event) => setEditBannerLensUri(event.target.value)}
                      />
                    </div>

                    {(avatarLensPreviewUrl || bannerLensPreviewUrl) ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {avatarLensPreviewUrl ? (
                          <a
                            href={avatarLensPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[11px] text-cyan-300 hover:text-cyan-200"
                          >
                            Avatar Lens gateway: {avatarLensPreviewUrl}
                          </a>
                        ) : (
                          <div className="app-meta-value text-zinc-600">Avatar Lens gateway: --</div>
                        )}
                        {bannerLensPreviewUrl ? (
                          <a
                            href={bannerLensPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[11px] text-cyan-300 hover:text-cyan-200"
                          >
                            Banner Lens gateway: {bannerLensPreviewUrl}
                          </a>
                        ) : (
                          <div className="app-meta-value text-zinc-600">Banner Lens gateway: --</div>
                        )}
                      </div>
                    ) : null}

                    {lensEnabled ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2 rounded-lg border border-zinc-800 bg-black/30 p-3">
                          <div className="text-[11px] font-medium text-zinc-500">Lens Grove avatar</div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => setAvatarUploadFile(event.target.files?.[0] ?? null)}
                            className="text-[11px] text-zinc-400"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleLensUpload('avatar', avatarUploadFile)}
                            disabled={!avatarUploadFile || lensUploadBusy !== null}
                            loading={lensUploadBusy === 'avatar'}
                          >
                            {lensUploadBusy === 'avatar' ? 'Uploading...' : 'Upload to Lens Grove'}
                          </Button>
                        </div>
                        <div className="space-y-2 rounded-lg border border-zinc-800 bg-black/30 p-3">
                          <div className="text-[11px] font-medium text-zinc-500">Lens Grove banner</div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => setBannerUploadFile(event.target.files?.[0] ?? null)}
                            className="text-[11px] text-zinc-400"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleLensUpload('banner', bannerUploadFile)}
                            disabled={!bannerUploadFile || lensUploadBusy !== null}
                            loading={lensUploadBusy === 'banner'}
                          >
                            {lensUploadBusy === 'banner' ? 'Uploading...' : 'Upload to Lens Grove'}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <textarea
                      className="min-h-[84px] w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-vault-text placeholder:text-vault-subtext transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      placeholder="Bio"
                      value={editBio}
                      onChange={(event) => setEditBio(event.target.value)}
                    />

                    {Object.keys(profileFields).length > 0 ? (
                      <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                        <div className="mb-2 text-[10px] font-medium text-zinc-500">Field provenance</div>
                        <div className="app-meta-value grid gap-1 text-zinc-500 md:grid-cols-2">
                          {Object.entries(profileFields).map(([key, field]) => (
                            <div key={key}>
                              {key}: <span className="text-zinc-300">{field.source || 'manual'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {editError ? (
                      <Alert variant="error" onDismiss={() => setEditError(null)}>
                        {editError}
                      </Alert>
                    ) : null}

                    {lensUploadError ? <Alert variant="error">{lensUploadError}</Alert> : null}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => patchMutation.mutate()}
                        loading={patchMutation.isPending}
                      >
                        Save profile
                      </Button>
                      <p className="text-[10px] text-zinc-600">
                        {onchainIdentity
                          ? `Auto-filled from ${onchainIdentity.source === 'ens' ? 'ENS' : 'Basename'} for ${shortAddr(onchainIdentity.address)}.`
                          : 'No ENS/Basename profile detected yet.'}
                      </p>
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {tab === 'tokens' ? (
            <div className="mt-5 space-y-5">
              {holdingsPanel}
              {!isPublicMode ? walletsPanel : null}
            </div>
          ) : null}

          {tab === 'activity' ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
              <div className="vault-surface p-4">
                <div className="mb-3 text-[12px] text-white">Activity dashboard</div>
                <div className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-[12px] text-zinc-600">
                  Detailed transaction feed and AMOE history will land here. Use Explore -&gt; Transactions until this module is enabled.
                </div>
              </div>
              <div className="space-y-5">
                {walletsPanel}
                {activityPanel}
              </div>
            </div>
          ) : null}

          {tab === 'nfts' ? (
            <div className="vault-surface mt-5 p-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
                <Plus className="h-5 w-5 text-zinc-500" />
              </div>
              <h3 className="mb-1 text-[13px] font-medium text-zinc-300">NFTs view is coming soon</h3>
              <p className="mb-5 text-[12px] text-zinc-600">
                NFT positions will appear here once this portfolio module is enabled.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/swap"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-[12px] text-brand-accent transition-colors hover:bg-brand-primary/20"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Swap tokens
                </Link>
                <Link
                  to="/explore/creators"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:bg-zinc-800/60"
                >
                  <Vault className="h-3.5 w-3.5" />
                  Explore vaults
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
