import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { getZoraExploreVolumeColumnRaw, getZoraExploreVolumeForFees } from '@/lib/zora/exploreVolume'
import { usePublicClient } from 'wagmi'
import { base } from 'wagmi/chains'
import { getAddress, isAddress, type Address } from 'viem'
import { useQuery } from '@tanstack/react-query'
import type { ZoraCoin } from '@/lib/zora/types'
import { getExploreColumns, getGridTemplateColumns, getStickyLeftMap } from './tableColumns'
import {
  buildGroupSpans,
  formatCompactNumber,
  formatFeeAmount,
  formatMarketCapDeltaPercent,
  getCoinFeeStatus,
  getMarketCapDeltaToneClass,
  resolveExploreFees24hDisplay,
  shortAddress,
} from './rowFormatting'
import { fetchCoinbaseSmartWalletOwners } from '@/lib/aa/coinbaseErc4337'
import { useIdentity } from '@/hooks/useIdentity'
import { LoadingText } from '@/components/ui/LoadingState'
import { type EthosScoreValue } from '@/components/chat/EthosScorePill'
import { CreatorEthosAvatar } from '@/components/explore/CreatorEthosAvatar'
import { ExploreFeeInfoHint, EXPLORE_FEE_VERSION_HEADER_HINT } from '@/components/explore/ExploreFeeInfoHint'
import { ExploreTableSparkline } from '@/components/explore/ExploreTableSparkline'
import type { ExploreTableSparkline as ExploreTableSparklineData } from '@/features/explore/exploreTableSparklines'

type TokenRowProps = {
  coin: ZoraCoin
  linkPrefix?: string
  timeframe?: string
  collapseIdentity?: boolean
  /** Set of migrated coin addresses (lowercase) for accurate fee detection */
  migratedCoins?: Set<string>
  ethosUserkey?: string | null
  ethosScore?: EthosScoreValue | null
  trend30d?: ExploreTableSparklineData | null
  isExpanded?: boolean
  onToggleFees?: () => void
}

type TokenTableHeaderProps = {
  timeframe?: string
  collapseIdentity?: boolean
  currentSort?: string
  onSortChange?: (sort: string) => void
}

function IdentityAddressChip({ address }: { address: string }) {
  const identity = useIdentity(address)
  const resolved = identity.source !== 'address'
  const label = resolved ? identity.displayName : shortAddress(address)
  const title = resolved
    ? `${identity.displayName} · ${address}`
    : address
  return (
    <span
      className={`rounded-full border border-white/10 bg-white/3 px-2 py-1 text-[10px] ${resolved ? 'text-zinc-100' : 'text-zinc-200'}`}
      title={title}
    >
      {label}
    </span>
  )
}

export function TokenRow({
  coin,
  linkPrefix = '/explore/creators',
  timeframe = '1d',
  collapseIdentity = false,
  migratedCoins,
  ethosUserkey,
  ethosScore,
  trend30d,
  isExpanded,
  onToggleFees,
}: TokenRowProps) {
  const publicClient = usePublicClient({ chainId: base.id })
  const volumeDisplay = getZoraExploreVolumeColumnRaw(coin, timeframe)
  const volumeForFees = getZoraExploreVolumeForFees(coin)

  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const symbol = coin.symbol || ''
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  
  // Check if name and symbol are effectively the same (for creator coins)
  const nameNormalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const symbolNormalized = symbol.toLowerCase().replace(/[^a-z0-9]/g, '')
  const isSameNameSymbol = nameNormalized === symbolNormalized || !symbol || symbol === name
  const address = coin.address || ''
  const payoutTo = coin.payoutRecipientAddress
  const marketCap = coin.marketCap
  const change = formatMarketCapDeltaPercent(coin.marketCapDelta24h, marketCap)
  const payoutIdentity = useIdentity(payoutTo ?? null)
  const payoutResolved = payoutIdentity.source !== 'address'
  const payoutDisplay = payoutTo
    ? payoutResolved
      ? payoutIdentity.displayName
      : shortAddress(payoutTo)
    : '-'
  const payoutTitle = payoutTo
    ? payoutResolved
      ? `${payoutIdentity.displayName} · ${payoutTo}`
      : payoutTo
    : undefined
  
  // Determine fee structure (checks migration status first, then creation date)
  const { feeRates } = getCoinFeeStatus(coin.address, coin.createdAt, migratedCoins)

  const detailPath = `${linkPrefix}/${chain}/${address}`

  const totalFees = resolveExploreFees24hDisplay(coin.fees24hUsd, volumeForFees, feeRates.total)
  const deltaToneClass = getMarketCapDeltaToneClass(change)
  const feeBreakdown = [
    `Creator ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.creator)}`,
    `Platform ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.platform)}`,
    `LP Lock ${feeRates.lpRewards > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.lpRewards) : '-'}`,
    `Zora ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.protocol)}`,
    `Doppler ${feeRates.doppler > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.doppler) : '-'}`,
  ].join(' • ')

  const columns = getExploreColumns({ variant: 'creators', timeframe, collapseIdentity })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const feeGroupSpan = useMemo(() => buildGroupSpans(columns).find((g) => g.id === 'fees') ?? null, [columns])

  // Sticky identity cells stay flat so rows read like Uniswap's continuous list.
  const stickyCellClass =
    'sticky explore-table-sticky-cell'

  const canToggleFees = typeof onToggleFees === 'function'

  const cswCandidates = useMemo(() => {
    const out: Address[] = []
    const push = (value?: string) => {
      if (!value || !isAddress(value)) return
      const addr = getAddress(value)
      if (!out.includes(addr)) out.push(addr)
    }
    push(coin.payoutRecipientAddress)
    push(coin.creatorAddress)
    return out
  }, [coin.creatorAddress, coin.payoutRecipientAddress])

  const candidateKey = cswCandidates.join('|')
  const cswOwnersQuery = useQuery({
    queryKey: ['coinbaseSmartWalletOwners', candidateKey],
    enabled: Boolean(isExpanded && publicClient && cswCandidates.length > 0),
    queryFn: async () => {
      if (!publicClient) return { address: null as Address | null, owners: [] as Address[], error: 'Missing public client' }

      let lastError: string | undefined
      for (const candidate of cswCandidates) {
        try {
          const owners = await fetchCoinbaseSmartWalletOwners({
            publicClient,
            smartWallet: candidate,
            maxOwners: 24,
          })
          if (owners.length > 0) {
            return { address: candidate, owners, error: undefined }
          }
        } catch (e: any) {
          lastError = e?.message ? String(e.message) : 'Failed to read owners'
        }
      }

      return { address: cswCandidates[0] ?? null, owners: [] as Address[], error: lastError }
    },
    staleTime: 60_000,
    retry: 0,
  })

  const cswOwners: {
    status: 'idle' | 'loading' | 'ready'
    address: Address | null
    owners: Address[]
    error?: string
  } = (() => {
    if (!isExpanded) return { status: 'idle', address: null, owners: [] }
    if (cswCandidates.length === 0) return { status: 'idle', address: null, owners: [] }
    if (cswOwnersQuery.isLoading) return { status: 'loading', address: null, owners: [] }
    const data = cswOwnersQuery.data
    if (data) return { status: 'ready', address: data.address, owners: data.owners, error: data.error }
    // If query is disabled (missing client), treat as idle until expanded + ready.
    return { status: 'idle', address: null, owners: [] }
  })()

  return (
    <div className="group explore-table-row-wrap">
      <Link
        to={detailPath}
        className="explore-table-row explore-table-grid items-center text-xs cursor-pointer"
        style={{ gridTemplateColumns }}
      >
        {/* Token Name */}
        <div
          className={`${stickyCellClass} explore-sticky-name-cell relative z-30 px-3 py-2`}
          style={{ left: stickyLeft.name }}
        >
          <div className="flex items-center gap-2.5 min-w-0 justify-start">
            <CreatorEthosAvatar
              coin={coin}
              imageUrl={avatarUrl}
              fallbackLabel={name}
              ethosUserkey={ethosUserkey}
              ethosScore={ethosScore}
              size="sm"
            />
            <div className="min-w-0 explore-token-name">
              {isSameNameSymbol ? (
                // Single display for matching name/symbol (common for creator coins)
                <div className="text-[13px] sm:text-[15px] font-medium text-white truncate">{symbol || name}</div>
              ) : (
                // Separate display when different
                <>
                  <div className="text-[13px] sm:text-sm font-medium text-white truncate">{name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{symbol}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Holders */}
        <span className="text-white tabular-nums px-3 py-2 text-center">{coin.uniqueHolders?.toLocaleString() || '-'}</span>

        {/* Market cap */}
        <span className="text-white tabular-nums px-3 py-2 text-center">{formatCompactNumber(marketCap)}</span>

        {/* Δ 24H */}
        <span className={`tabular-nums px-3 py-2 text-center ${deltaToneClass}`}>
          {change.text}
        </span>

        {/* 30D trend */}
        <div className="px-3 py-2 flex items-center justify-center">
          {trend30d ? (
            <ExploreTableSparkline values={trend30d.values} changePercent={trend30d.changePercent} />
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </div>

        {/* Volume */}
        <span className="text-white tabular-nums px-3 py-2 text-center">{formatCompactNumber(volumeDisplay)}</span>

        {/* Total Fees */}
        <div className="px-3 py-2 text-center flex items-center justify-center gap-1 text-zinc-200 tabular-nums" title={feeBreakdown}>
          <span>{totalFees}</span>
          {canToggleFees ? (
            <button
              type="button"
              aria-label="Toggle fee breakdown"
              aria-expanded={Boolean(isExpanded)}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onToggleFees?.()
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          ) : null}
        </div>

        {/* Payout To */}
        <span className={`truncate px-3 py-2 text-center app-meta-value ${payoutResolved ? 'text-zinc-200' : 'text-zinc-300'}`} title={payoutTitle}>
          {payoutDisplay}
        </span>
      </Link>
      {isExpanded ? (
        <div className="app-meta-value min-w-max border-b border-white/8 text-zinc-400">
          <div className="explore-table-grid" style={{ gridTemplateColumns }}>
            <div
              className="px-3 py-3"
              style={{
                gridColumn: feeGroupSpan ? `${feeGroupSpan.start + 1} / ${feeGroupSpan.end + 2}` : '1 / -1',
              }}
            >
              <div className="grid gap-2">
                <div>
                  <span className="text-zinc-500">Creator</span>{' '}
                  <span className="text-zinc-200">{formatFeeAmount(volumeForFees, feeRates.total, feeRates.creator)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Platform</span>{' '}
                  <span className="text-zinc-200">{formatFeeAmount(volumeForFees, feeRates.total, feeRates.platform)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">LP Lock</span>{' '}
                  <span className="text-zinc-200">
                    {feeRates.lpRewards > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.lpRewards) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Zora</span>{' '}
                  <span className="text-zinc-200">{formatFeeAmount(volumeForFees, feeRates.total, feeRates.protocol)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Doppler</span>{' '}
                  <span className="text-zinc-200">
                    {feeRates.doppler > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.doppler) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-white/8 pt-3 px-3 pb-3">
            <div className="app-meta-value font-medium text-zinc-500">CSW owners</div>
            {cswCandidates.length === 0 ? (
              <div className="text-zinc-500">No creator or payout address available.</div>
            ) : cswOwners.status === 'loading' ? (
              <LoadingText intent="processing" size="sm" labelOverride="Loading owners..." />
            ) : cswOwners.owners.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {cswOwners.owners.map((owner) => (
                  <IdentityAddressChip key={owner} address={owner} />
                ))}
              </div>
            ) : (
              <div className="text-zinc-500">
                {cswOwners.error ? cswOwners.error : 'No CSW owners found for payout/creator address.'}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// Table Header Component
export function TokenTableHeader({ timeframe = '1d', collapseIdentity = false, currentSort, onSortChange }: TokenTableHeaderProps) {
  const columns = getExploreColumns({ variant: 'creators', timeframe, collapseIdentity })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const groupSpans = buildGroupSpans(columns)

  const stickyHeaderCellClass = 'sticky z-50 explore-table-sticky-cell'
  const stickyGroupClass = 'sticky z-40 explore-table-sticky-cell'

  return (
    <div className="explore-table-header-shell">
      {/* Group labels */}
      <div className="explore-table-grid" style={{ gridTemplateColumns }}>
        {groupSpans.map((g) => {
          const slice = columns.slice(g.start, g.end + 1)
          const hasSticky = slice.some((c) => c.sticky)
          const left = hasSticky ? stickyLeft[columns[g.start]!.id] : undefined
          const alignClass = g.id === 'identity' ? 'text-left' : 'text-center'
          return (
            <div
              key={g.id}
              className={`px-3 py-2 text-[10px] font-medium text-zinc-600 ${alignClass} ${
                hasSticky ? stickyGroupClass : ''
              } ${g.id === 'identity' ? 'explore-sticky-identity-group-header' : ''}`}
              style={{
                gridColumn: `${g.start + 1} / ${g.end + 2}`,
                ...(hasSticky ? { left } : null),
              }}
            >
              {g.label}
            </div>
          )
        })}
      </div>

      {/* Column labels */}
      <div className="explore-table-grid text-[10px] text-zinc-500 font-medium" style={{ gridTemplateColumns }}>
        {columns.map((c) => {
          const isSticky = Boolean(c.sticky)
          const left = isSticky ? stickyLeft[c.id] : undefined
          const base = 'px-3 py-2 border-b-0'
          const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'

          const labelNode =
            c.id === 'priceChange' ? (
              <span title="Market cap % change over 24H">{c.label}</span>
            ) : c.id === 'trend30d' ? (
              <span title="30-day price trend from indexed Zora swap activity">{c.label}</span>
            ) : c.id === 'name' && c.sortKey === 'ethosScore' ? (
              <span title="Sort by Ethos score (highest first). Score badge appears on the avatar.">{c.label}</span>
            ) : c.id === 'totalFees' ? (
              <span className="inline-flex items-center justify-center gap-0.5" title={EXPLORE_FEE_VERSION_HEADER_HINT}>
                {c.label}
                <ExploreFeeInfoHint title={EXPLORE_FEE_VERSION_HEADER_HINT} />
              </span>
            ) : (
              <span>{c.label}</span>
            )

          const sortable = Boolean(c.sortKey)
          const active = sortable && typeof currentSort === 'string' && currentSort === c.sortKey

          const label =
            sortable && typeof onSortChange === 'function' ? (
              <button
                type="button"
                onClick={() => onSortChange(c.sortKey!)}
                className={`group inline-flex items-center gap-1 ${active ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
                title={`Sort by ${c.label}`}
              >
                {labelNode}
                <span className={`text-[9px] ${active ? 'text-zinc-300' : 'text-zinc-700 group-hover:text-zinc-400'}`}>
                  {active ? '▼' : '↕'}
                </span>
              </button>
            ) : (
              labelNode
            )

          return (
            <div
              key={c.id}
              className={`${base} ${align} ${isSticky ? stickyHeaderCellClass : ''} ${
                c.id === 'name' ? 'relative explore-sticky-name-header-cell' : ''
              }`}
              style={isSticky ? { left } : undefined}
            >
              {c.id === 'name' ? (
                <span className="explore-token-header-label">{label}</span>
              ) : null}
              {c.id !== 'name' ? label : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Loading skeleton row
export function TokenRowSkeleton({ collapseIdentity = false }: { collapseIdentity?: boolean }) {
  const columns = getExploreColumns({ variant: 'creators', timeframe: '1d', collapseIdentity })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const stickyCellClass = 'sticky z-10 explore-table-sticky-cell'

  return (
    <div className="explore-table-row explore-table-grid items-center" style={{ gridTemplateColumns }}>
      <div className={`${stickyCellClass} explore-sticky-name-cell px-3 py-2`} style={{ left: stickyLeft.name }}>
        <div className="flex items-center gap-2 justify-start">
          <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse sm:h-10 sm:w-10" />
          <div className="space-y-1 explore-token-name">
            <div className="h-3 w-24 bg-white/8 rounded animate-pulse" />
            <div className="h-2 w-12 bg-white/8 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {columns
        .filter((c) => c.id !== 'name')
        .map((c) => (
          <div key={c.id} className="px-3 py-2">
            <div className={`h-3 bg-white/8 rounded animate-pulse ${c.align === 'right' ? 'ml-auto' : ''}`} style={{ width: c.widthPx > 100 ? 56 : 40 }} />
          </div>
        ))}
    </div>
  )
}
