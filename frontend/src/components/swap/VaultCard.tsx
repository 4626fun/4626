import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { FileSpreadsheet, TrendingUp, Wallet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { erc20Abi } from 'viem'

import { useVault } from '@/hooks/useVault'
import { useZoraCoin } from '@/lib/zora/hooks'
import { apiFetch } from '@/lib/api/apiBase'
import { toShareSymbol } from '@/lib/tokens/tokenSymbols'
import { shareTokenLogo } from '@/lib/uniswap/swapUtils'
import { cn } from '@/lib/shared/utils'

const BASE_BRANDMARK_BLUE = '/base/base-square-blue.svg'

/** Static mapping: share token address -> CCA strategy (for vaults not yet in keepr) */
const SHARE_TO_CCA: Record<string, `0x${string}`> = {
  '0x00f80e71e77b562fdf28522a7b80a7d53438d38b': '0xFe040F54DBF13Dd95d667E5e6bb42d87444549A4' as `0x${string}`,
}

const UNISWAP_AUCTION_BASE = 'https://app.uniswap.org/explore/auctions/base'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type VaultCardConfig = {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  groupId: string
  ccaStrategyAddress?: `0x${string}`
  shareOFTAddress?: `0x${string}`
  graduatedAt?: string | null
  settledAt?: string | null
}

type VaultCardProps = {
  vault: VaultCardConfig
  compact?: boolean
  showManage?: boolean
  withMyVault?: boolean
}

type AuctionStatus = {
  auction?: string | null
  isActive: boolean
  isGraduated: boolean
  lifecyclePhase?: number
  lifecycleAuctionWindowOpen?: boolean
  lifecycleFailedFinalized?: boolean
  currencyRaised?: string
  currencyDecimals?: number
  auctionTokenSymbol?: string
}

type AuctionActivityItem = {
  transactionHash: string
  owner: string
  amountDisplay: string
}

type AuctionActivity = {
  activity: AuctionActivityItem[]
}

async function fetchAuctionStatus(ccaStrategy: `0x${string}`): Promise<AuctionStatus> {
  const res = await apiFetch(`/api/v1/auction/status?ccaStrategy=${ccaStrategy}`)
  if (!res.ok) throw new Error('Auction status unavailable')
  const json = (await res.json()) as {
    success?: boolean
    data?: {
      auction?: string | null
      isActive?: boolean
      isGraduated?: boolean
      lifecyclePhase?: number
      lifecycleAuctionWindowOpen?: boolean
      lifecycleFailedFinalized?: boolean
      currencyRaised?: string
      currencyDecimals?: number
      auctionTokenSymbol?: string
    }
  }
  return {
    auction: typeof json.data?.auction === 'string' ? json.data.auction : null,
    isActive: Boolean(json.data?.isActive),
    isGraduated: Boolean(json.data?.isGraduated),
    lifecyclePhase: typeof json.data?.lifecyclePhase === 'number' ? json.data.lifecyclePhase : undefined,
    lifecycleAuctionWindowOpen: Boolean(json.data?.lifecycleAuctionWindowOpen),
    lifecycleFailedFinalized: Boolean(json.data?.lifecycleFailedFinalized),
    currencyRaised: json.data?.currencyRaised,
    currencyDecimals: json.data?.currencyDecimals ?? 6,
    auctionTokenSymbol: json.data?.auctionTokenSymbol,
  }
}

async function fetchAuctionActivity(ccaStrategy: `0x${string}`): Promise<AuctionActivity> {
  const res = await apiFetch(`/api/v1/auction/activity?ccaStrategy=${ccaStrategy}&limit=2`)
  if (!res.ok) throw new Error('Auction activity unavailable')
  const json = (await res.json()) as {
    success?: boolean
    data?: {
      activity?: AuctionActivityItem[]
    }
  }
  return {
    activity: Array.isArray(json.data?.activity) ? json.data.activity : [],
  }
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0'
  return `$${formatCompactNumber(n)}`
}

function shortAddress(value: string): string {
  if (!value) return 'Unknown'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export function VaultCard({ vault, compact = false, withMyVault = false }: VaultCardProps) {
  const data = useVault(vault.vaultAddress)
  const { data: zoraCoin } = useZoraCoin(vault.creatorCoinAddress)

  const { data: assetSymbol } = useReadContract({
    address: data.asset ?? undefined,
    abi: erc20Abi,
    functionName: 'symbol',
  })

  const { data: assetDecimals } = useReadContract({
    address: data.asset ?? undefined,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  const ccaStrategy = vault.ccaStrategyAddress ?? (vault.shareOFTAddress ? SHARE_TO_CCA[vault.shareOFTAddress.toLowerCase()] : undefined)
  const auctionQuery = useQuery({
    queryKey: ['auction-status', vault.chainId, ccaStrategy],
    queryFn: () => fetchAuctionStatus(ccaStrategy!),
    enabled: Boolean(ccaStrategy),
    staleTime: 20_000,
  })
  const hasOnchainAuction = useMemo(() => {
    const value = auctionQuery.data?.auction
    return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) && value.toLowerCase() !== ZERO_ADDRESS
  }, [auctionQuery.data?.auction])
  const auctionFinished = Boolean(vault.graduatedAt || vault.settledAt || auctionQuery.data?.isGraduated === true)
  const auctionLive =
    !auctionFinished &&
    (auctionQuery.data?.lifecycleAuctionWindowOpen === true || auctionQuery.data?.isActive === true)
  const auctionFailed =
    hasOnchainAuction &&
    !auctionFinished &&
    (auctionQuery.data?.lifecycleFailedFinalized === true || auctionQuery.data?.lifecyclePhase === 6)
  const auctionStatusUnavailable = Boolean(ccaStrategy) && auctionQuery.isError === true
  const activityQuery = useQuery({
    queryKey: ['auction-activity', vault.chainId, ccaStrategy],
    queryFn: () => fetchAuctionActivity(ccaStrategy!),
    enabled: Boolean(ccaStrategy && auctionLive),
    staleTime: 20_000,
  })

  const totalAssets = data.totalAssets ?? 0n
  const normalizedAssetDecimals = typeof assetDecimals === 'number' ? assetDecimals : 18
  const tvlRaw = totalAssets > 0n ? Number(formatUnits(totalAssets, normalizedAssetDecimals)) : 0
  const formattedTvl = totalAssets > 0n ? formatCompactNumber(tvlRaw) : '—'
  const tvlLabel = assetSymbol ? `${formattedTvl} ${assetSymbol}` : `${formattedTvl} tokens`
  const userHasShare = !!data.userShares && data.userShares > 0n
  const vaultPath = useMemo(() => `/vault/${vault.vaultAddress}`, [vault.vaultAddress])
  const displaySymbol = typeof assetSymbol === 'string' && assetSymbol.trim().length > 0 ? assetSymbol.trim() : null
  const zoraSymbol = typeof zoraCoin?.symbol === 'string' && zoraCoin.symbol.trim().length > 0 ? zoraCoin.symbol.trim() : null
  const shareSymbol = toShareSymbol(displaySymbol || zoraSymbol || 'TOKEN')
  const assetPriceUsd = useMemo(() => {
    const direct = Number(zoraCoin?.tokenPrice?.priceInUsdc ?? '')
    if (Number.isFinite(direct) && direct > 0) return direct

    const marketCap = Number(zoraCoin?.marketCap ?? '')
    const totalSupply = Number(zoraCoin?.totalSupply ?? '')
    if (Number.isFinite(marketCap) && marketCap > 0 && Number.isFinite(totalSupply) && totalSupply > 0) {
      return marketCap / totalSupply
    }
    return null
  }, [zoraCoin?.marketCap, zoraCoin?.tokenPrice?.priceInUsdc, zoraCoin?.totalSupply])
  const tvlUsd = assetPriceUsd != null ? tvlRaw * assetPriceUsd : null

  const shareOFT = vault.shareOFTAddress
  const tokenImageUrl = shareOFT ? shareTokenLogo(shareOFT, vault.chainId, 64) : null

  const auctionUrl = ccaStrategy ? `${UNISWAP_AUCTION_BASE}/${ccaStrategy}` : null
  const recentActivity = activityQuery.data?.activity ?? []
  const committedDisplay = useMemo(() => {
    if (!auctionLive || auctionQuery.data?.currencyRaised == null) return null
    const amount = formatCompactNumber(Number(formatUnits(BigInt(auctionQuery.data.currencyRaised), auctionQuery.data.currencyDecimals ?? 6)))
    return auctionQuery.data.auctionTokenSymbol === 'USDC' || !auctionQuery.data.auctionTokenSymbol
      ? `$${amount}`
      : `${amount} ${auctionQuery.data.auctionTokenSymbol}`
  }, [auctionLive, auctionQuery.data?.auctionTokenSymbol, auctionQuery.data?.currencyDecimals, auctionQuery.data?.currencyRaised])
  const title = shareSymbol || data.name || 'Vault'

  return (
    <article
      className={cn(
        'vault-surface-muted vault-hover-lift p-3 transition',
        compact ? 'space-y-2' : 'space-y-3',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-start gap-3">
          {tokenImageUrl ? (
            <img
              src={tokenImageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover border border-white/10"
              loading="lazy"
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white truncate">{title}</div>
              <span className="inline-block rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-[10px] text-brand-200">
                Creator
              </span>
            </div>
            <div className="app-meta-value mt-1 leading-4 text-zinc-500 break-all">
              Share token: {shareOFT ?? 'Unavailable'}
            </div>
            <div className="app-meta-value mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-2 py-0.5 text-zinc-400">
              <img alt="Base" className="h-3.5 w-3.5 rounded-full object-contain shrink-0" loading="lazy" src={BASE_BRANDMARK_BLUE} />
              <span>Base</span>
            </div>
          </div>
        </div>
        <div className="w-[7.5rem] shrink-0 text-right text-xs text-zinc-500">
          <div>{tvlUsd != null ? 'TVL' : 'Assets in vault'}</div>
          <div className="text-sm text-zinc-200">{tvlUsd != null ? formatCompactUsd(tvlUsd) : tvlLabel}</div>
          {tvlUsd != null ? <div className="app-meta-value mt-1 text-zinc-500">{tvlLabel} in vault</div> : null}
        </div>
      </div>

      <div className="app-meta-value flex flex-wrap items-center gap-2 text-zinc-500">
        {auctionLive && auctionUrl ? (
          <a
            href={auctionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-200 hover:bg-emerald-500/25 transition"
          >
            Auction Live Now
          </a>
        ) : null}
        {auctionFinished ? (
          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-sky-200">
            Auction Finished
          </span>
        ) : null}
        {auctionFailed ? (
          <span className="rounded-full border border-rose-400/35 bg-rose-500/10 px-2 py-0.5 text-rose-200">
            Auction Failed
          </span>
        ) : null}
        {auctionStatusUnavailable ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            Auction Status Unavailable
          </span>
        ) : null}
        {committedDisplay ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
            Committed {committedDisplay}
          </span>
        ) : null}
        {withMyVault && userHasShare ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">Position found</span>
        ) : null}
      </div>

      {auctionLive && recentActivity.length > 0 ? (
        <div className="rounded-xl border border-white/12 bg-linear-to-b from-white/8 to-white/3 px-3 py-2 backdrop-blur-sm">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Live activity</div>
          <div className="space-y-1.5">
            {recentActivity.map((item) => (
              <div key={item.transactionHash} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-zinc-400">{shortAddress(item.owner)}</span>
                <span className="text-zinc-200">{item.amountDisplay}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {auctionFailed && ccaStrategy ? (
        <Link
          to={`/complete-auction/${ccaStrategy}`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-500/20"
        >
          Recover Auction + Strategy Funds
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={vaultPath}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-all duration-200 hover:-translate-y-px hover:bg-white/8',
          )}
          title={`Open vault ${vault.vaultAddress}`}
        >
          <Wallet className="h-3.5 w-3.5 mr-1" />
          Deposit
        </Link>
        <button
          type="button"
          onClick={() => {
            if (userHasShare) {
              window.location.assign(vaultPath)
            }
          }}
          disabled={!userHasShare}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-lg border border-white/12 px-3 py-1.5 text-xs transition-all duration-200',
            userHasShare
              ? 'bg-white/5 text-zinc-300 hover:-translate-y-px hover:bg-white/8'
              : 'bg-white/2.5 text-zinc-600 cursor-not-allowed',
          )}
        >
          <TrendingUp className="h-3.5 w-3.5 mr-1" />
          Withdraw
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <Link
          to={`/vault/${vault.vaultAddress}`}
          className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 px-2 py-1 text-zinc-300 hover:text-zinc-100 transition"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          View vault
        </Link>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(vault.vaultAddress).catch(() => {})
          }}
          className="text-zinc-500 hover:text-zinc-300 text-[10px]"
        >
          {vault.vaultAddress.slice(0, 8)}…
        </button>
      </div>
    </article>
  )
}
