import { EXPLORE_TABLE_GROUPS, type ExploreTableColumn } from './tableColumns'

const V4_CUTOFF_DATE = new Date('2025-06-06T00:00:00Z')

const FEE_RATES_V4 = {
  total: 0.01,
  creator: 0.5,
  platform: 0.2,
  lpRewards: 0.2,
  protocol: 0.05,
  tradeRef: 0.04,
  doppler: 0.01,
}

const FEE_RATES_LEGACY = {
  total: 0.03,
  creator: 0.5,
  platform: 0.25,
  lpRewards: 0,
  protocol: 0.25,
  tradeRef: 0,
  doppler: 0,
}

export type FeeStatus = {
  isV4: boolean
  isMigrated: boolean
  feeRates: typeof FEE_RATES_V4
}

export function getCoinFeeStatus(
  address: string | undefined,
  createdAt: string | undefined,
  migratedCoins?: Set<string>,
): FeeStatus {
  if (address && migratedCoins?.has(address.toLowerCase())) {
    return { isV4: true, isMigrated: true, feeRates: FEE_RATES_V4 }
  }

  const isV4ByDate = !createdAt || new Date(createdAt) >= V4_CUTOFF_DATE
  return {
    isV4: isV4ByDate,
    isMigrated: false,
    feeRates: isV4ByDate ? FEE_RATES_V4 : FEE_RATES_LEGACY,
  }
}

export function formatCompactNumber(value: string | number | undefined): string {
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

export function formatFeeAmount(volume: string | undefined, totalFeeRate: number, splitRate: number): string {
  if (!volume) return '-'
  const vol = parseFloat(volume)
  if (isNaN(vol) || vol === 0) return '-'
  const fee = vol * totalFeeRate * splitRate
  return formatCompactNumber(fee)
}

export function shortAddress(addr: string | undefined): string {
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

  const sign = positive ? '+' : '-'
  return { text: `${sign}${formatted}`, positive }
}

export function formatMarketCapDeltaPercent(
  deltaRaw: string | undefined,
  marketCapRaw: string | undefined,
): { text: string; positive: boolean } {
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

export function getMarketCapDeltaToneClass(change: { text: string; positive: boolean }): string {
  if (change.text === '-' || change.text === '0%' || change.text === '+0%') {
    return 'text-zinc-400'
  }
  return change.positive ? 'text-emerald-400/90' : 'text-rose-400/90'
}

export function buildGroupSpans(columns: ExploreTableColumn[]) {
  const out: Array<{ id: string; label: string; start: number; end: number }> = []
  for (const group of EXPLORE_TABLE_GROUPS) {
    const firstIdx = columns.findIndex((column) => column.group === group.id)
    if (firstIdx === -1) continue
    let lastIdx = firstIdx
    for (; lastIdx < columns.length; lastIdx += 1) {
      if (columns[lastIdx]!.group !== group.id) break
    }
    out.push({ id: group.id, label: group.label, start: firstIdx, end: lastIdx - 1 })
  }
  return out
}
