import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { ZoraCoin } from '@/lib/zora/types'
import { EXPLORE_TABLE_GROUPS, getExploreColumns, getGridTemplateColumns, getStickyLeftMap } from './tableColumns'

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

// V4 cutoff: June 6, 2025 (Zora V4 mainnet launch)
const V4_CUTOFF_DATE = new Date('2025-06-06T00:00:00Z')

// Zora V4 Fee Structure (1% total fee) - coins created after June 2025 OR migrated
const FEE_RATES_V4 = {
  total: 0.01,        // 1% total trading fee
  creator: 0.50,      // 50% of fees → Creator/payoutRecipient
  platform: 0.20,     // 20% of fees → Platform Referral
  lpRewards: 0.20,    // 20% of fees → Locked LP (not distributed)
  protocol: 0.05,     // 5% of fees → Zora Protocol
  tradeRef: 0.04,     // 4% of fees → Trade Referral
  doppler: 0.01,      // 1% of fees → Doppler (LP hook)
}

// Legacy Fee Structure (3% total fee) - coins created before June 2025 that haven't migrated
const FEE_RATES_LEGACY = {
  total: 0.03,        // 3% total trading fee
  creator: 0.50,      // 50% of fees → Creator/payoutRecipient
  platform: 0.25,     // 25% of fees → Platform Referral
  lpRewards: 0.00,    // No LP rewards in legacy
  protocol: 0.25,     // 25% of fees → Zora Protocol
  tradeRef: 0.00,     // No trade referral in legacy
  doppler: 0.00,      // No Doppler in legacy
}

type FeeStatus = {
  isV4: boolean
  isMigrated: boolean
  feeRates: typeof FEE_RATES_V4
}

/**
 * Determine fee status for a coin
 * Priority: 1) Check if migrated, 2) Check creation date
 */
function getCoinFeeStatus(
  address: string | undefined,
  createdAt: string | undefined,
  migratedCoins?: Set<string>
): FeeStatus {
  // Check if coin has migrated to V4
  if (address && migratedCoins?.has(address.toLowerCase())) {
    return { isV4: true, isMigrated: true, feeRates: FEE_RATES_V4 }
  }
  
  // Fall back to creation date check
  const isV4ByDate = !createdAt || new Date(createdAt) >= V4_CUTOFF_DATE
  return {
    isV4: isV4ByDate,
    isMigrated: false,
    feeRates: isV4ByDate ? FEE_RATES_V4 : FEE_RATES_LEGACY
  }
}

function formatCompactNumber(value: string | number | undefined): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  if (num >= 0.01) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

function formatFeeAmount(volume: string | undefined, totalFeeRate: number, splitRate: number): string {
  if (!volume) return '-'
  const vol = parseFloat(volume)
  if (isNaN(vol) || vol === 0) return '-'
  const fee = vol * totalFeeRate * splitRate
  return formatCompactNumber(fee)
}

function shortAddress(addr: string | undefined): string {
  if (!addr) return '-'
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDeltaPercentValue(value: number): { text: string; positive: boolean } {
  if (!Number.isFinite(value)) return { text: '-', positive: true }
  const positive = value >= 0
  const abs = Math.abs(value)

  let formatted: string
  if (abs >= 1000) {
    formatted = `${Math.round(abs)}%`
  } else if (abs >= 10) {
    formatted = `${abs.toFixed(1)}%`
  } else if (abs >= 0.01) {
    formatted = `${abs.toFixed(2)}%`
  } else if (abs > 0) {
    formatted = '<0.01%'
  } else {
    formatted = '0%'
  }

  return { text: `${positive ? '+' : '-'}${formatted}`, positive }
}

function formatMarketCapDeltaPercent(deltaRaw: string | undefined, marketCapRaw: string | undefined): { text: string; positive: boolean } {
  if (!deltaRaw) return { text: '-', positive: true }
  const delta = parseFloat(deltaRaw)
  if (!Number.isFinite(delta)) return { text: '-', positive: true }

  let percent = delta
  const abs = Math.abs(delta)
  if (abs > 200) {
    const marketCap = marketCapRaw ? parseFloat(marketCapRaw) : NaN
    if (Number.isFinite(marketCap) && marketCap !== 0) {
      const prev = marketCap - delta
      if (prev !== 0) percent = (delta / prev) * 100
    }
  }

  return formatDeltaPercentValue(percent)
}

function buildGroupSpans(columns: ReturnType<typeof getExploreColumns>) {
  const out: Array<{ id: string; label: string; start: number; end: number }> = []
  for (const g of EXPLORE_TABLE_GROUPS) {
    const firstIdx = columns.findIndex((c) => c.group === g.id)
    if (firstIdx === -1) continue
    const lastIdx = (() => {
      let i = firstIdx
      for (; i < columns.length; i++) {
        if (columns[i].group !== g.id) break
      }
      return i - 1
    })()
    out.push({ id: g.id, label: g.label, start: firstIdx, end: lastIdx })
  }
  return out
}

export function PoolRow({
  rank,
  coin,
  timeframe = '1d',
  migratedCoins,
  isExpanded,
  onToggleFees,
}: PoolRowProps) {
  // Use timeframe for future API support
  const volume = timeframe === '1d' ? coin.volume24h : coin.volume24h // TODO: support other timeframes
  
  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const creatorHandle = coin.creatorProfile?.handle
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''
  const payoutTo = coin.payoutRecipientAddress
  const marketCap = coin.marketCap
  const change = formatMarketCapDeltaPercent(coin.marketCapDelta24h, marketCap)

  // Determine fee structure (checks migration status first, then creation date)
  const { isV4, isMigrated, feeRates } = getCoinFeeStatus(coin.address, coin.createdAt, migratedCoins)

  const detailPath = `/explore/content/${chain}/${address}`

  // Fee badge tooltip
  const feeTooltip = isMigrated
    ? '1% fee (Migrated to V4)'
    : isV4
      ? '1% fee (V4 - after June 2025)'
      : '3% fee (Legacy - before June 2025)'

  const totalFees = formatFeeAmount(volume, feeRates.total, 1)
  const feeBreakdown = [
    `Creator ${formatFeeAmount(volume, feeRates.total, feeRates.creator)}`,
    `Platform ${formatFeeAmount(volume, feeRates.total, feeRates.platform)}`,
    `LP Lock ${feeRates.lpRewards > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.lpRewards) : '-'}`,
    `Zora ${formatFeeAmount(volume, feeRates.total, feeRates.protocol)}`,
    `Doppler ${feeRates.doppler > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.doppler) : '-'}`,
  ].join(' • ')

  const columns = getExploreColumns({ variant: 'content', timeframe })
  const gridTemplateColumns = getGridTemplateColumns(columns)
  const stickyLeft = getStickyLeftMap(columns)
  const stickyCellClass =
    'sticky bg-zinc-950/70 backdrop-blur-sm group-hover:bg-zinc-900/40 border-r border-zinc-800/60'

  const canToggleFees = typeof onToggleFees === 'function'

  return (
    <>
    <Link
      to={detailPath}
      className="group grid items-center text-xs hover:bg-zinc-800/30 transition-colors cursor-pointer min-w-max"
      style={{ gridTemplateColumns }}
    >
      {/* Rank */}
      <span className={`${stickyCellClass} z-20 text-zinc-500 tabular-nums px-3 py-2 text-center sm:text-right`} style={{ left: stickyLeft.rank }}>
        {rank}
      </span>

      {/* Content Name */}
      <div className={`${stickyCellClass} relative z-30 px-3 py-2`} style={{ left: stickyLeft.name }}>
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-r from-transparent to-zinc-950 opacity-80"
          aria-hidden="true"
        />
        <div className="flex items-center gap-2 min-w-0 justify-center sm:justify-start">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
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

      {/* Volume */}
      <span className="text-white tabular-nums px-3 py-2 text-right">{formatCompactNumber(volume)}</span>

      {/* Δ 24H */}
      <span className={`tabular-nums px-3 py-2 text-right ${change.positive ? 'text-emerald-300' : 'text-rose-300'}`}>
        {change.text}
      </span>

      {/* Fee % */}
      <div className="px-3 py-2 text-center">
        <span
          className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-zinc-300"
          title={feeTooltip}
        >
          {isV4 ? '1%' : '3%'}
          {isMigrated ? <span className="ml-0.5 text-zinc-500">*</span> : null}
        </span>
      </div>

      {/* Total Fees */}
      <div className="px-3 py-2 text-right flex items-center justify-end gap-1 text-zinc-200 tabular-nums" title={feeBreakdown}>
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
            className="inline-flex items-center justify-center rounded-full border border-white/10 p-1 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        ) : null}
      </div>

      {/* Payout To */}
      <span className="text-zinc-400 font-mono text-[10px] truncate px-3 py-2" title={payoutTo || undefined}>
        {shortAddress(payoutTo)}
      </span>
    </Link>
    {isExpanded ? (
      <div className="px-6 py-3 text-[11px] text-zinc-400 border-b border-zinc-800/50 bg-zinc-950/40 min-w-max">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <span className="text-zinc-500">Creator</span>{' '}
            <span className="text-zinc-200">{formatFeeAmount(volume, feeRates.total, feeRates.creator)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Platform</span>{' '}
            <span className="text-zinc-200">{formatFeeAmount(volume, feeRates.total, feeRates.platform)}</span>
          </div>
          <div>
            <span className="text-zinc-500">LP Lock</span>{' '}
            <span className="text-zinc-200">
              {feeRates.lpRewards > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.lpRewards) : '-'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Zora</span>{' '}
            <span className="text-zinc-200">{formatFeeAmount(volume, feeRates.total, feeRates.protocol)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Doppler</span>{' '}
            <span className="text-zinc-200">
              {feeRates.doppler > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.doppler) : '-'}
            </span>
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
  const stickyHeaderCellClass = 'sticky z-50 bg-zinc-950 border-r border-zinc-800/60'
  const stickyGroupClass = 'sticky z-40 bg-zinc-950 border-r border-zinc-800/60'

  return (
    <div className="bg-zinc-950 border-b border-zinc-800">
      {/* Group labels */}
      <div className="grid" style={{ gridTemplateColumns }}>
        {groupSpans.map((g) => {
          const slice = columns.slice(g.start, g.end + 1)
          const hasSticky = slice.some((c) => c.sticky)
          const left = hasSticky ? stickyLeft[columns[g.start].id] : undefined
          return (
            <div
              key={g.id}
              className={`px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-600 border-b border-zinc-800/60 text-left ${
                hasSticky ? stickyGroupClass : ''
              }`}
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
      <div className="grid text-[10px] text-zinc-500 uppercase tracking-wider" style={{ gridTemplateColumns }}>
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
              className={`${base} ${align} ${isSticky ? stickyHeaderCellClass : ''} ${c.id === 'name' ? 'relative' : ''}`}
              style={isSticky ? { left } : undefined}
            >
              {c.id === 'name' ? (
                <div
                  className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-r from-transparent to-zinc-950 opacity-80"
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
  const stickyCellClass = 'sticky z-10 bg-zinc-900/70 backdrop-blur-sm'

  return (
    <div className="grid items-center min-w-max" style={{ gridTemplateColumns }}>
      <div className={`${stickyCellClass} px-3 py-2`} style={{ left: stickyLeft.rank }}>
        <div className="h-3 w-6 bg-zinc-800 rounded animate-pulse ml-auto" />
      </div>
      <div className={`${stickyCellClass} px-3 py-2 shadow-[6px_0_16px_-12px_rgba(0,0,0,0.9)]`} style={{ left: stickyLeft.name }}>
        <div className="flex items-center gap-2 justify-center sm:justify-start">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="space-y-1 explore-token-name">
            <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
            <div className="h-2 w-12 bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {columns
        .filter((c) => c.id !== 'rank' && c.id !== 'name')
        .map((c) => (
          <div key={c.id} className="px-3 py-2">
            <div className={`h-3 bg-zinc-800 rounded animate-pulse ${c.align === 'right' ? 'ml-auto' : ''}`} style={{ width: c.widthPx > 100 ? 56 : 40 }} />
          </div>
        ))}
    </div>
  )
}
