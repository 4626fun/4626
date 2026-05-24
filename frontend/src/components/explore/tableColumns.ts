export type ExploreTableVariant = 'creators' | 'content'

export type ExploreSortKey = 'volume' | 'marketCap' | 'priceChange' | 'new' | 'ethosScore'

export type ExploreTableGroupId = 'identity' | 'market' | 'fees' | 'payout'

export type ExploreTableColumnId =
  | 'name'
  | 'holders'
  | 'ethosScore'
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
  /** Sticky-left column (name only). */
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
  switch (timeframe) {
    case '1d':
      return 'Vol 24H'
    case '1y':
      return 'All-time vol'
    case '1w':
      return 'Vol (24h)'
    default:
      return 'Vol 24H'
  }
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
    {
      id: 'name',
      label: nameLabel,
      group: 'identity',
      widthPx: collapseIdentity ? 56 : 208,
      align: 'left',
      sticky: true,
      ...(opts.variant === 'creators' ? { sortKey: 'ethosScore' as const } : {}),
    },

    { id: 'holders', label: 'Holders', group: 'market', widthPx: holdersWidth, align: centerMarket ? 'center' : 'right' },
    { id: 'marketCap', label: 'MCap', group: 'market', widthPx: marketCapWidth, align: centerMarket ? 'center' : 'right', sortKey: 'marketCap' },
    { id: 'priceChange', label: 'MCap Δ 24H', group: 'market', widthPx: deltaWidth, align: centerMarket ? 'center' : 'right', sortKey: 'priceChange' },
    { id: 'volume', label: getVolumeLabel(timeframe), group: 'market', widthPx: volumeWidth, align: centerMarket ? 'center' : 'right', sortKey: 'volume' },

    { id: 'totalFees', label: 'Fees (24h)', group: 'fees', widthPx: 118, align: 'center' },

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

export function getHorizontalScrollStops(columns: ExploreTableColumn[]): number[] {
  const nonStickyWidths = columns.filter((column) => !column.sticky).map((column) => column.widthPx)
  const stops: number[] = [0]
  let acc = 0
  for (const width of nonStickyWidths) {
    acc += width
    stops.push(acc)
  }
  return stops
}
