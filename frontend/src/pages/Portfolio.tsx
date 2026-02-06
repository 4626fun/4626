import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'
import { fetchDebankTokenList, type DebankToken, type DebankTokenList } from '@/lib/debank/client'
import { fetchZoraCoin } from '@/lib/zora/client'
import type { ZoraCoin } from '@/lib/zora/types'

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function formatUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const n = v
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatAmount(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const n = v
  if (n === 0) return '0'
  if (n >= 10_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function isEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let idx = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const current = idx++
      out[current] = await fn(items[current]!)
    }
  })
  await Promise.all(workers)
  return out
}

function seededSeries(seed: string, base: number, points: number): number[] {
  // deterministic pseudo-random series (no external data required)
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const rand = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return (h >>> 0) / 4294967296
  }
  const out: number[] = []
  let v = Number.isFinite(base) ? base : 0
  const amp = Math.max(1, v * 0.03)
  for (let i = 0; i < points; i++) {
    const drift = (rand() - 0.5) * amp
    v = Math.max(0, v + drift)
    out.push(v)
  }
  return out
}

function Sparkline({ series }: { series: number[] }) {
  const w = 640
  const h = 220
  const pad = 10
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = Math.max(1e-6, max - min)

  const d = series
    .map((v, i) => {
      const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const area = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]">
      <defs>
        <linearGradient id="cvSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff4d4d" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ff4d4d" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cvSparkFill)" />
      <path d={d} fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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
}

export function Portfolio() {
  const params = useParams<{ address?: string }>()
  const { address: wagmiAddress } = useAccount()
  const siwe = useSiweAuth()
  const queryClient = useQueryClient()
  const routeAddress = typeof params.address === 'string' ? params.address.trim() : ''
  const publicAddress = routeAddress && isEvmAddress(routeAddress) ? routeAddress.toLowerCase() : null
  const isPublicMode = Boolean(publicAddress)
  const effectiveAddress = useMemo(() => {
    if (publicAddress) return publicAddress
    const a = (wagmiAddress || siwe.authAddress || '').trim()
    return isEvmAddress(a) ? a.toLowerCase() : null
  }, [publicAddress, siwe.authAddress, wagmiAddress])

  const [tab, setTab] = useState<'overview' | 'tokens' | 'nfts' | 'activity'>('overview')
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

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
    setEditError(null)
  }, [portfolioQuery.data?.profile])

  const patchMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        displayName: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
        website: editWebsite.trim() || null,
        avatarUrl: editAvatarUrl.trim() || null,
        bannerUrl: editBannerUrl.trim() || null,
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
    const toks = tokenListQuery.data?.tokens ?? []
    const addrs = toks
      .map((t) => String(t?.id || '').toLowerCase())
      .filter((a) => isEvmAddress(a))
      .sort()
    return addrs.join(',')
  }, [tokenListQuery.data?.tokens])

  const zoraCoinsQuery = useQuery({
    queryKey: ['portfolio', 'zoraCoinsForTokens', effectiveAddress, tokenAddressesKey],
    enabled: Boolean(effectiveAddress) && tokenAddressesKey.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async (): Promise<Record<string, ZoraCoin | null>> => {
      const toks = tokenListQuery.data?.tokens ?? []
      const addresses = toks
        .map((t) => String(t?.id || '').toLowerCase())
        .filter((a) => isEvmAddress(a))
      const uniq = Array.from(new Set(addresses))

      const pairs = await mapWithLimit(uniq, 6, async (addrLc) => {
        try {
          const coin = await fetchZoraCoin(addrLc as any)
          return [addrLc, coin] as const
        } catch {
          return [addrLc, null] as const
        }
      })

      const out: Record<string, ZoraCoin | null> = {}
      for (const [addrLc, coin] of pairs) out[addrLc] = coin
      return out
    },
  })

  type Holding = { token: DebankToken; coin: ZoraCoin; coinType: 'CREATOR' | 'CONTENT' }

  const holdings = useMemo(() => {
    const toks = tokenListQuery.data?.tokens ?? []
    const coinMap = zoraCoinsQuery.data ?? {}

    const out: Holding[] = []
    for (const t of toks) {
      const addrLc = String(t?.id || '').toLowerCase()
      if (!isEvmAddress(addrLc)) continue
      const coin = coinMap[addrLc] ?? null
      if (!coin) continue
      const ct = String((coin as any)?.coinType || '').toUpperCase()
      if (ct !== 'CREATOR' && ct !== 'CONTENT') continue
      out.push({ token: t, coin, coinType: ct as 'CREATOR' | 'CONTENT' })
    }
    out.sort((a, b) => (b.token.usdValue ?? 0) - (a.token.usdValue ?? 0))
    return out
  }, [tokenListQuery.data?.tokens, zoraCoinsQuery.data])

  const creatorHoldings = useMemo(() => holdings.filter((h) => h.coinType === 'CREATOR'), [holdings])
  const contentHoldings = useMemo(() => holdings.filter((h) => h.coinType === 'CONTENT'), [holdings])

  const creatorContentUsd = useMemo(() => {
    let sum = 0
    for (const h of holdings) sum += typeof h.token.usdValue === 'number' && Number.isFinite(h.token.usdValue) ? h.token.usdValue : 0
    return sum
  }, [holdings])

  const series = useMemo(() => {
    const seed = `${effectiveAddress || 'anon'}:${timeframe}`
    return seededSeries(seed, creatorContentUsd ?? 0, 64)
  }, [creatorContentUsd, effectiveAddress, timeframe])

  const tokenMeta = useMemo(() => {
    const isLoading = tokenListQuery.isLoading || zoraCoinsQuery.isLoading
    const ready = !isLoading && tokenListQuery.data != null
    return { isLoading, ready }
  }, [tokenListQuery.data, tokenListQuery.isLoading, zoraCoinsQuery.isLoading])

  function TokensTable(props: { items: Holding[]; emptyLabel: string }) {
    const { items, emptyLabel } = props
    if (tokenMeta.isLoading) return <div className="p-4 text-[12px] text-zinc-600">Loading balances…</div>
    if (!effectiveAddress) return <div className="p-4 text-[12px] text-zinc-600">Connect a wallet to view balances.</div>
    if (items.length === 0) return <div className="p-4 text-[12px] text-zinc-600">{emptyLabel}</div>

    return (
      <div className="divide-y divide-zinc-800/70">
        <div className="px-4 py-2.5 grid grid-cols-[minmax(0,1fr)_92px_92px_104px] gap-3 text-[11px] text-zinc-600">
          <div>Token</div>
          <div className="text-right">Price</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Value</div>
        </div>
        {items.map((h) => {
          const t = h.token
          const name = t.symbol || t.name || h.coin.symbol || h.coin.name || t.id
          const price = typeof t.price === 'number' ? t.price : null
          return (
            <div key={`${h.coinType}:${t.id}`} className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_92px_92px_104px] gap-3 items-center">
              <div className="min-w-0 flex items-center gap-3">
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt="" className="w-7 h-7 rounded-full border border-white/10" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[12px] text-white truncate">{name}</div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] border ${
                        h.coinType === 'CREATOR'
                          ? 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'
                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
                      }`}
                    >
                      {h.coinType === 'CREATOR' ? 'Creator' : 'Content'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-600 font-mono truncate">{shortAddr(String(t.id || ''))}</div>
                </div>
              </div>
              <div className="text-[12px] text-zinc-200 tabular-nums text-right">{price != null ? formatUsd(price) : '—'}</div>
              <div className="text-[12px] text-zinc-200 tabular-nums text-right">{formatAmount(t.amount)}</div>
              <div className="text-[12px] text-zinc-200 tabular-nums text-right">{formatUsd(t.usdValue)}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative pb-24 md:pb-0 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {/* Header (Uniswap-style) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1.5 text-[12px] text-zinc-300 font-mono truncate">
                {effectiveAddress ? shortAddr(effectiveAddress) : 'Connect wallet'}
              </div>
            </div>
            <div className="hidden sm:block w-full max-w-[440px]">
              <div className="rounded-full border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-[12px] text-zinc-500">
                Search tokens, pools, and wallets
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-3 text-[12px]">
            {(['overview', 'tokens', 'nfts', 'activity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 border ${
                  tab === t ? 'border-white/10 bg-white/6 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200'
                } transition-colors`}
              >
                {t === 'nfts' ? 'NFTs' : t[0]!.toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Overview */}
        {tab === 'overview' ? (
          <div className="mt-6 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.02 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[12px] text-white">{isPublicMode ? 'Public portfolio' : 'Portfolio profile'}</div>
                  <div className="text-[11px] text-zinc-600">Canonical wallets + field provenance.</div>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {portfolioQuery.isLoading ? 'Syncing…' : portfolioQuery.data ? 'Synced' : 'Not synced'}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 text-[12px] text-zinc-300">
                <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-[0.14em]">Connected wallet</div>
                  <div className="mt-1 font-mono text-zinc-200">{effectiveAddress ? shortAddr(effectiveAddress) : '—'}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    SIWE: {siwe.authAddress ? shortAddr(siwe.authAddress) : 'Not signed in'}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-[0.14em]">Profile</div>
                  {portfolioQuery.data?.profile ? (
                    <div className="mt-2 space-y-1 text-[11px]">
                      <div>
                        Display: <span className="text-zinc-200">{portfolioQuery.data.profile.displayName ?? '—'}</span>
                      </div>
                      <div>
                        Embedded:{' '}
                        <span className="font-mono text-zinc-200">
                          {portfolioQuery.data.profile.primaryEmbeddedEoa ? shortAddr(portfolioQuery.data.profile.primaryEmbeddedEoa) : '—'}
                        </span>
                      </div>
                      <div>
                        CSW:{' '}
                        <span className="font-mono text-zinc-200">
                          {portfolioQuery.data.profile.primarySmartWallet ? shortAddr(portfolioQuery.data.profile.primarySmartWallet) : '—'}
                        </span>
                      </div>
                      <div className="text-zinc-500">
                        Access: <span className="text-zinc-300">{portfolioQuery.data.profile.appAccessStatus ?? '—'}</span>
                        {' · '}Updated: <span className="text-zinc-300">{formatDateTime(portfolioQuery.data.profile.updatedAt)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-zinc-500">
                      No profile record yet. Sign in to sync.
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-[0.14em]">On-chain summary</div>
                  <div className="mt-2 text-[11px]">
                    Total: <span className="text-zinc-200">{formatUsd(portfolioQuery.data?.onchainSummary?.totalUsdValue)}</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">As of {formatDateTime(portfolioQuery.data?.onchainSummary?.asOf ?? null)}</div>
                  {!isPublicMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        void walletSyncMutation.mutateAsync()
                      }}
                      className="mt-3 rounded-lg border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/5 disabled:opacity-60"
                      disabled={walletSyncMutation.isPending}
                    >
                      {walletSyncMutation.isPending ? 'Refreshing…' : 'Refresh wallets'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-[0.14em] mb-2">Linked wallets</div>
                {portfolioQuery.data?.wallets?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {portfolioQuery.data.wallets.map((wallet) => (
                      <div key={wallet.address} className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-300">
                        <span className="font-mono">{shortAddr(wallet.address)}</span>
                        {wallet.isCanonicalSmartWallet ? <span className="ml-1 text-indigo-300">CSW</span> : null}
                        {wallet.isEmbeddedEoa ? <span className="ml-1 text-emerald-300">Embedded</span> : null}
                        {wallet.isPrimary ? <span className="ml-1 text-amber-300">Primary</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-500">No linked wallets yet.</div>
                )}
              </div>

              {!isPublicMode ? (
                <div className="mt-3 rounded-xl border border-zinc-800/80 bg-black/30 p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-[0.14em] mb-2">Manual profile fields</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-[12px] text-zinc-200"
                      placeholder="Display name"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-[12px] text-zinc-200"
                      placeholder="Website"
                      value={editWebsite}
                      onChange={(e) => setEditWebsite(e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-[12px] text-zinc-200"
                      placeholder="Avatar URL"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-[12px] text-zinc-200"
                      placeholder="Banner URL"
                      value={editBannerUrl}
                      onChange={(e) => setEditBannerUrl(e.target.value)}
                    />
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950/70 px-3 py-2 text-[12px] text-zinc-200 min-h-[84px]"
                    placeholder="Bio"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                  />
                  {editError ? <div className="mt-2 text-[11px] text-rose-300">{editError}</div> : null}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => patchMutation.mutate()}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-100 hover:bg-white/5 disabled:opacity-60"
                      disabled={patchMutation.isPending}
                    >
                      {patchMutation.isPending ? 'Saving…' : 'Save profile'}
                    </button>
                    <div className="text-[10px] text-zinc-500">Externally sourced fields are locked for edits.</div>
                  </div>
                </div>
              ) : null}
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Chart card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden"
              >
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-600">Creator + content coins</div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <div className="text-[34px] font-light tracking-tight text-white tabular-nums">{formatUsd(creatorContentUsd)}</div>
                    <div className="text-[12px] text-rose-300 tabular-nums">—</div>
                  </div>
                </div>
                <div className="px-3">
                  <Sparkline series={series} />
                </div>
                <div className="p-4 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTimeframe(t)}
                        className={`rounded-full px-3 py-1.5 text-[11px] border ${
                          timeframe === t ? 'border-white/10 bg-white/6 text-white' : 'border-zinc-900 text-zinc-500 hover:text-zinc-200'
                        } transition-colors`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    {tokenMeta.isLoading ? 'Loading…' : tokenListQuery.data ? 'Live balances' : '—'}
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-left hover:bg-white/4 transition-colors disabled:opacity-70"
                    disabled
                  >
                    <div className="text-[12px] text-zinc-300 font-medium flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-zinc-500" />
                      Send
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-left hover:bg-white/4 transition-colors disabled:opacity-70"
                    disabled
                  >
                    <div className="text-[12px] text-zinc-300 font-medium flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-zinc-500" />
                      Receive
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-left hover:bg-white/4 transition-colors disabled:opacity-70"
                    disabled
                  >
                    <div className="text-[12px] text-zinc-300 font-medium flex items-center gap-2">
                      <Plus className="w-4 h-4 text-zinc-500" />
                      Buy
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-left hover:bg-white/4 transition-colors disabled:opacity-70"
                    disabled
                  >
                    <div className="text-[12px] text-zinc-300 font-medium flex items-center gap-2">
                      <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                      More
                    </div>
                  </button>
                </div>
                <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-[11px] text-zinc-600">Swapped this week</div>
                  <div className="mt-1 text-[16px] text-white tabular-nums">—</div>
                </div>
              </motion.div>
            </div>

            {/* Lower grids */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Tokens */}
              <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-white">Holdings</div>
                    <div className="text-[11px] text-zinc-600">
                      {effectiveAddress ? `${creatorHoldings.length} creator • ${contentHoldings.length} content` : '—'}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-600">Base</div>
                </div>
                <div className="divide-y divide-zinc-800/70">
                  <div className="px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-zinc-600">Creator coins</div>
                  <TokensTable items={creatorHoldings} emptyLabel="No creator coin balances found." />
                  <div className="px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-zinc-600">Content coins</div>
                  <TokensTable items={contentHoldings} emptyLabel="No content coin balances found." />
                </div>
              </div>

              {/* Activity */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                  <div className="text-[12px] text-white">Recent activity</div>
                  <div className="text-[11px] text-zinc-600">Last 7 days</div>
                </div>
                <div className="p-4 text-[12px] text-zinc-600">
                  Activity feed coming next. For now, use Explore → Transactions.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab !== 'overview' ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 text-[12px] text-zinc-600">
            {tab === 'tokens' ? 'Token list coming next.' : tab === 'nfts' ? 'NFTs view coming next.' : 'Activity view coming next.'}
          </div>
        ) : null}
      </div>
    </div>
  )
}
