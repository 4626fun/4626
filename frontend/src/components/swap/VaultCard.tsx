import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { FileSpreadsheet, TrendingUp, Wallet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'

import { useVault } from '@/hooks/useVault'
import { apiFetch } from '@/lib/apiBase'
import { cn } from '@/lib/utils'

/** Static mapping: share token address -> CCA strategy (for vaults not yet in keepr) */
const SHARE_TO_CCA: Record<string, `0x${string}`> = {
  '0x00f80e71e77b562fdf28522a7b80a7d53438d38b': '0xFe040F54DBF13Dd95d667E5e6bb42d87444549A4' as `0x${string}`,
}

const UNISWAP_AUCTION_BASE = 'https://app.uniswap.org/explore/auctions/base'

type VaultCardConfig = {
  vaultAddress: `0x${string}`
  chainId: number
  creatorCoinAddress: `0x${string}`
  groupId: string
  ccaStrategyAddress?: `0x${string}`
  shareOFTAddress?: `0x${string}`
}

type VaultCardProps = {
  vault: VaultCardConfig
  compact?: boolean
  showManage?: boolean
  withMyVault?: boolean
}

async function fetchAuctionStatus(ccaStrategy: `0x${string}`): Promise<{ isActive: boolean; isGraduated: boolean }> {
  const res = await apiFetch(`/api/v1/auction/status?ccaStrategy=${ccaStrategy}`)
  if (!res.ok) throw new Error('Auction status unavailable')
  const json = (await res.json()) as { success?: boolean; data?: { isActive?: boolean; isGraduated?: boolean } }
  return {
    isActive: Boolean(json.data?.isActive),
    isGraduated: Boolean(json.data?.isGraduated),
  }
}

export function VaultCard({ vault, compact = false, withMyVault = false }: VaultCardProps) {
  const data = useVault(vault.vaultAddress)

  const ccaStrategy = vault.ccaStrategyAddress ?? (vault.shareOFTAddress ? SHARE_TO_CCA[vault.shareOFTAddress.toLowerCase()] : undefined)
  const auctionQuery = useQuery({
    queryKey: ['auction-status', ccaStrategy],
    queryFn: () => fetchAuctionStatus(ccaStrategy!),
    enabled: Boolean(ccaStrategy),
    staleTime: 20_000,
  })

  const totalAssets = data.totalAssets ?? 0n
  const formattedTvl = totalAssets > 0n
    ? Number(formatUnits(totalAssets, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '—'
  const userHasShare = !!data.userShares && data.userShares > 0n
  const vaultPath = useMemo(() => `/vault/${vault.vaultAddress}`, [vault.vaultAddress])

  const shareOFT = vault.shareOFTAddress
  const tokenImageUrl = shareOFT
    ? shareOFT.toLowerCase() === '0x00f80e71e77b562fdf28522a7b80a7d53438d38b'
      ? '/tokens/akita-share.png'
      : `/api/token/image?address=${shareOFT}&chain=${vault.chainId}&size=64`
    : null

  const auctionLive = auctionQuery.data?.isActive === true
  const auctionUrl = ccaStrategy ? `${UNISWAP_AUCTION_BASE}/${ccaStrategy}` : null

  return (
    <article
      className={cn(
        'rounded-2xl border border-white/10 bg-vault-card/70 p-3 transition',
        compact ? 'space-y-2' : 'space-y-3',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          {tokenImageUrl ? (
            <img
              src={tokenImageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover border border-white/10"
              loading="lazy"
            />
          ) : null}
          <div>
            <div className="text-sm font-semibold text-white truncate">
              {data.name ?? 'Vault'}
              <span className="ml-2 inline-block rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-[10px] text-brand-200">
                Creator
              </span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 truncate">Creator coin: {vault.creatorCoinAddress}</div>
            <div className="mt-1 text-[11px] text-zinc-500">Chain {vault.chainId}</div>
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>TVL</div>
          <div className="text-sm text-zinc-200">{formattedTvl}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
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
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">Underlying: {vault.creatorCoinAddress.slice(0, 6)}…{vault.creatorCoinAddress.slice(-4)}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
          APY <span className={data.totalAssets ? 'text-zinc-300' : 'text-zinc-500'}>TBD</span>
        </span>
        {withMyVault && userHasShare ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">Position found</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to={vaultPath}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/8',
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
            'inline-flex h-8 items-center justify-center rounded-lg border border-white/12 px-3 py-1.5 text-xs',
            userHasShare
              ? 'bg-white/5 text-zinc-300 hover:bg-white/8'
              : 'bg-white/[0.025] text-zinc-600 cursor-not-allowed',
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
