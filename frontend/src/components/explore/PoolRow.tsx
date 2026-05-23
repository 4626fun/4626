import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { ZoraCoin } from '@/lib/zora/types'
import { getZoraExploreVolumeColumnRaw, getZoraExploreVolumeForFees } from '@/lib/zora/exploreVolume'
import { getExploreColumns, getGridTemplateColumns, getStickyLeftMap } from './tableColumns'
import {
  buildGroupSpans,
  formatCompactNumber,
  formatFeeAmount,
  formatMarketCapDeltaPercent,
  getCoinFeeStatus,
  getMarketCapDeltaToneClass,
  shortAddress,
} from './rowFormatting'
import { useIdentity } from '@/hooks/useIdentity'

type PoolRowProps = {
  rank: number
  coin: ZoraCoin
  timeframe?: string
  /** Set of migrated coin addresses (lowercase) for accurate fee detection */
  migratedCoins?: Set<string>
  isExpanded?: boolean
  onToggleFees?: () => void
}

type PoolTableHeaderProps = {
  timeframe?: string
  currentSort?: string
  onSortChange?: (sort: string) => void
}

export function PoolRow({
  rank,
  coin,
  timeframe = '1d',
  migratedCoins,
  isExpanded,
  onToggleFees,
}: PoolRowProps) {
  const volumeDisplay = getZoraExploreVolumeColumnRaw(coin, timeframe)
  const volumeForFees = getZoraExploreVolumeForFees(coin)

  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const creatorHandle = coin.creatorProfile?.handle
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''
  const payoutTo = coin.payoutRecipientAddress
  const marketCap = coin.marketCap
  const change = formatMarketCapDeltaPercent(coin.marketCapDelta24h, marketCap)
  const deltaToneClass = getMarketCapDeltaToneClass(change)
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
  const { isV4, isMigrated, feeRates } = getCoinFeeStatus(coin.address, coin.createdAt, migratedCoins)

  const detailPath = `/explore/content/${chain}/${address}`

  // Fee badge tooltip
  const feeTooltip = isMigrated
    ? '1% fee (Migrated to V4)'
    : isV4
      ? '1% fee (V4 - after June 2025)'
      : '3% fee (Legacy - before June 2025)'

  const totalFees = formatFeeAmount(volumeForFees, feeRates.total, 1)
  const feeBreakdown = [
    `Creator ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.creator)}`,
    `Platform ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.platform)}`,
    `LP Lock ${feeRates.lpRewards > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.lpRewards) : '-'}`,
    `Zora ${formatFeeAmount(volumeForFees, feeRates.total, feeRates.protocol)}`,
    `Doppler ${feeRates.doppler > 0 ? formatFeeAmount(volumeForFees, feeRates.total, feeRates.doppler) : '-'}`,
  ].join(' • ')

  const columns = getExploreColumns({ variant: 'content', timeframe })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const feeGroupSpan = useMemo(() => buildGroupSpans(columns).find((g) => g.id === 'fees') ?? null, [columns])
  const stickyCellClass =
    'sticky explore-table-sticky-cell'

  const canToggleFees = typeof onToggleFees === 'function'

  return (
    <>
    <Link
      to={detailPath}
      className="group explore-table-row explore-table-grid items-center text-xs cursor-pointer"
      style={{ gridTemplateColumns }}
    >
      {/* Rank */}
      <span className={`${stickyCellClass} z-20 text-zinc-500 tabular-nums px-3 py-2 text-center sm:text-right`} style={{ left: stickyLeft.rank }}>
        {rank}
      </span>

      {/* Content Name */}
      <div className={`${stickyCellClass} explore-sticky-name-cell relative z-30 px-3 py-2`} style={{ left: stickyLeft.name }}>
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-linear-to-r from-transparent to-zinc-950 opacity-80"
          aria-hidden="true"
        />
        <div className="flex items-center gap-2 min-w-0 justify-start">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-medium text-zinc-400">{name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0 explore-token-name">
            <div className="text-[13px] sm:text-sm font-medium text-white truncate">{name}</div>
            {creatorHandle && <div className="text-[10px] text-zinc-500 truncate">@{creatorHandle}</div>}
          </div>
        </div>
      </div>

      {/* Holders */}
      <span className="text-white tabular-nums px-3 py-2 text-right">{coin.uniqueHolders?.toLocaleString() || '-'}</span>

      {/* Market cap */}
      <span className="text-white tabular-nums px-3 py-2 text-right">{formatCompactNumber(marketCap)}</span>

      {/* Δ 24H */}
      <span className={`tabular-nums px-3 py-2 text-right ${deltaToneClass}`}>
        {change.text}
      </span>

      {/* Volume */}
      <span className="text-white tabular-nums px-3 py-2 text-right">{formatCompactNumber(volumeDisplay)}</span>

      {/* Fee % */}
      <div className="px-3 py-2 text-center">
        <span
          className="inline-flex items-center rounded-md border border-white/10 bg-white/3 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
          title={feeTooltip}
        >
          {isV4 ? '1%' : '3%'}
          {isMigrated ? <span className="ml-0.5 text-zinc-500">*</span> : null}
        </span>
      </div>

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
      </div>
    ) : null}
    </>
  )
}

// Table Header Component
export function PoolTableHeader({ timeframe = '1d', currentSort, onSortChange }: PoolTableHeaderProps) {
  const columns = getExploreColumns({ variant: 'content', timeframe })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const groupSpans = buildGroupSpans(columns)
  const stickyHeaderCellClass = 'sticky z-50 explore-table-sticky-cell border-r border-white/8'
  const stickyGroupClass = 'sticky z-40 explore-table-sticky-cell border-r border-white/8'

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
              className={`px-3 py-2 text-[10px] font-medium text-zinc-600 border-b border-white/8 ${alignClass} ${
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
          const base = 'px-3 py-2'
          const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'

          const labelNode =
            c.id === 'feeBadge' ? (
              <span title="Fee version: 1% (V4, after June 2025) or 3% (Legacy)">{c.label}</span>
            ) : c.id === 'priceChange' ? (
              <span title="Market cap % change over 24H">{c.label}</span>
            ) : c.id === 'totalFees' ? (
              <span title="Total fees (volume × fee %)">{c.label}</span>
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
                <div
                  className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-linear-to-r from-transparent to-zinc-950 opacity-80"
                  aria-hidden="true"
                />
              ) : null}
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Loading skeleton row
export function PoolRowSkeleton() {
  const columns = getExploreColumns({ variant: 'content', timeframe: '1d' })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const stickyCellClass = 'sticky z-10 explore-table-sticky-cell'

  return (
    <div className="explore-table-grid items-center" style={{ gridTemplateColumns }}>
      <div className={`${stickyCellClass} px-3 py-2`} style={{ left: stickyLeft.rank }}>
        <div className="h-3 w-6 bg-white/8 rounded animate-pulse ml-auto" />
      </div>
      <div className={`${stickyCellClass} explore-sticky-name-cell px-3 py-2 shadow-[6px_0_16px_-12px_rgba(0,0,0,0.9)]`} style={{ left: stickyLeft.name }}>
        <div className="flex items-center gap-2 justify-start">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="space-y-1 explore-token-name">
            <div className="h-3 w-24 bg-white/8 rounded animate-pulse" />
            <div className="h-2 w-12 bg-white/8 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {columns
        .filter((c) => c.id !== 'rank' && c.id !== 'name')
        .map((c) => (
          <div key={c.id} className="px-3 py-2">
            <div className={`h-3 bg-white/8 rounded animate-pulse ${c.align === 'right' ? 'ml-auto' : ''}`} style={{ width: c.widthPx > 100 ? 56 : 40 }} />
          </div>
        ))}
    </div>
  )
}
