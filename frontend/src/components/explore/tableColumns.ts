export type ExploreTableVariant = 'creators' | 'content'

export type ExploreSortKey = 'volume' | 'marketCap' | 'priceChange' | 'new'

export type ExploreTableGroupId = 'identity' | 'market' | 'fees' | 'payout'

export type ExploreTableColumnId =
  | 'rank'
  | 'name'
  | 'feeBadge'
  | 'holders'
  | 'marketCap'
  | 'volume'
  | 'priceChange'
  | 'totalFees'
  | 'payoutTo'

export type ExploreColumnAlign = 'left' | 'right' | 'center'

export type ExploreTableColumn = {
  id: ExploreTableColumnId
  label: string
  group: ExploreTableGroupId
  /** Fixed pixel width for DeFiLlama-style dense tables. */
  widthPx: number
  align?: ExploreColumnAlign
  /** If set, clicking the header should map to this sort key. */
  sortKey?: ExploreSortKey
  /** Sticky-left column (rank/name only). */
  sticky?: boolean
}

export type ExploreTableGroup = {
  id: ExploreTableGroupId
  label: string
}

export const EXPLORE_TABLE_GROUPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'market', label: 'Market' },
  { id: 'fees', label: 'Fees' },
  { id: 'payout', label: 'Payout' },
] as const satisfies ReadonlyArray<ExploreTableGroup>

function getVolumeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '1h': 'Vol 1H',
    '1d': 'Vol 24H',
    '1w': 'Vol 7D',
    '1m': 'Vol 30D',
    '1y': 'Vol 1Y',
  }
  return labels[timeframe] || 'Vol 24H'
}

export function getExploreColumns(opts: { variant: ExploreTableVariant; timeframe?: string; collapseIdentity?: boolean }): ExploreTableColumn[] {
  const timeframe = opts.timeframe ?? '1d'
  const nameLabel = opts.variant === 'content' ? 'Content' : 'Token'
  const collapseIdentity = Boolean(opts.collapseIdentity)
  const centerMarket = opts.variant === 'creators'
  const holdersWidth = opts.variant === 'creators' ? 88 : 96
  const marketCapWidth = opts.variant === 'creators' ? 112 : 120
  const volumeWidth = opts.variant === 'creators' ? 112 : 120
  const deltaWidth = opts.variant === 'creators' ? 102 : 110

  // A DeFiLlama-like table is intentionally dense and fixed-width, with horizontal scroll.
  return [
    { id: 'rank', label: '#', group: 'identity', widthPx: 48, align: 'right', sticky: true },
    { id: 'name', label: nameLabel, group: 'identity', widthPx: collapseIdentity ? 56 : 208, align: 'left', sticky: true },

    { id: 'holders', label: 'Holders', group: 'market', widthPx: holdersWidth, align: centerMarket ? 'center' : 'right' },
    { id: 'volume', label: getVolumeLabel(timeframe), group: 'market', widthPx: volumeWidth, align: centerMarket ? 'center' : 'right', sortKey: 'volume' },
    { id: 'marketCap', label: 'MCap', group: 'market', widthPx: marketCapWidth, align: centerMarket ? 'center' : 'right', sortKey: 'marketCap' },
    { id: 'priceChange', label: 'MCap Δ 24H', group: 'market', widthPx: deltaWidth, align: centerMarket ? 'center' : 'right', sortKey: 'priceChange' },

    { id: 'feeBadge', label: 'Fee %', group: 'fees', widthPx: 72, align: 'center' },
    { id: 'totalFees', label: 'Fees', group: 'fees', widthPx: 110, align: 'center' },

    { id: 'payoutTo', label: 'Payout To', group: 'payout', widthPx: 132, align: 'center' },
  ]
}

export function getGridTemplateColumns(columns: ExploreTableColumn[]): string {
  return columns.map((c) => `${c.widthPx}px`).join(' ')
}

export function getStickyLeftMap(columns: ExploreTableColumn[]): Record<ExploreTableColumnId, number> {
  // Computes the left offsets (in px) for sticky columns, based on the fixed widths.
  let acc = 0
  const out: Partial<Record<ExploreTableColumnId, number>> = {}
  for (const c of columns) {
    if (c.sticky) out[c.id] = acc
    acc += c.widthPx
  }
  return out as Record<ExploreTableColumnId, number>
}

