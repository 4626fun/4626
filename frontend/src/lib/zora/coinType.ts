export type ZoraCoinType = 'CREATOR' | 'CONTENT' | 'TREND'

/** Normalize Zora API coinType — defaults to CREATOR only when unknown. */
export function normalizeZoraCoinType(raw: unknown): ZoraCoinType {
  const upper = String(raw ?? '').toUpperCase()
  if (upper === 'CONTENT') return 'CONTENT'
  if (upper === 'TREND') return 'TREND'
  return 'CREATOR'
}

export function zoraCoinTypeLabel(coinType: ZoraCoinType): string {
  if (coinType === 'CONTENT') return 'Content coin'
  if (coinType === 'TREND') return 'Trend coin'
  return 'Creator coin'
}

export function splitZoraHoldingsByCoinType<T extends { coinType: ZoraCoinType; usdValue: number; amount: number }>(
  rows: T[],
): { creator: T[]; content: T[]; trend: T[] } {
  const creator: T[] = []
  const content: T[] = []
  const trend: T[] = []
  for (const row of rows) {
    if (row.coinType === 'CONTENT') content.push(row)
    else if (row.coinType === 'TREND') trend.push(row)
    else creator.push(row)
  }
  const sortByValue = (a: T, b: T) => b.usdValue - a.usdValue || b.amount - a.amount
  creator.sort(sortByValue)
  content.sort(sortByValue)
  trend.sort(sortByValue)
  return { creator, content, trend }
}
