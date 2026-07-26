export type HeroMcapHistoryPoint = {
  date: string
  creatorCoinsMarketCapUsd: number | null
}

/** Drop / rewrite snapshot points that are clearly spoof-FDV spikes vs a robust baseline. */
export const DEFAULT_HERO_MCAP_HISTORY_OUTLIER_MULTIPLE = 3

function median(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Median of the lower half — resists a few extreme upper spikes dominating the baseline. */
function robustBaseline(values: ReadonlyArray<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const lower = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
  return median(lower)
}

function interpolate(left: number, right: number, leftIndex: number, rightIndex: number, index: number): number {
  if (rightIndex <= leftIndex) return left
  const t = (index - leftIndex) / (rightIndex - leftIndex)
  return left + (right - left) * t
}

/**
 * Replace extreme mcap history outliers (e.g. illiquid spoof FDV days) with
 * linear interpolation across neighboring inlier points so the hero sparkline
 * stays readable after a liquidity-gate cutover.
 */
export function sanitizeHeroMcapHistory<T extends HeroMcapHistoryPoint>(
  history: ReadonlyArray<T>,
  options: { outlierMultiple?: number } = {},
): T[] {
  const multiple = options.outlierMultiple ?? DEFAULT_HERO_MCAP_HISTORY_OUTLIER_MULTIPLE
  if (!Number.isFinite(multiple) || multiple <= 1 || history.length === 0) {
    return history.map((row) => ({ ...row }))
  }

  const values = history.map((row) => {
    const n = row.creatorCoinsMarketCapUsd
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
  })
  const finite = values.filter((v): v is number => v != null)
  const baseline = robustBaseline(finite)
  if (baseline == null || baseline <= 0) {
    return history.map((row) => ({ ...row }))
  }

  const ceiling = baseline * multiple
  const isOutlier = values.map((v) => v != null && v > ceiling)

  return history.map((row, index) => {
    if (!isOutlier[index]) return { ...row }

    let leftIndex = -1
    let leftValue = 0
    for (let i = index - 1; i >= 0; i -= 1) {
      if (!isOutlier[i] && values[i] != null) {
        leftIndex = i
        leftValue = values[i]!
        break
      }
    }

    let rightIndex = -1
    let rightValue = 0
    for (let i = index + 1; i < values.length; i += 1) {
      if (!isOutlier[i] && values[i] != null) {
        rightIndex = i
        rightValue = values[i]!
        break
      }
    }

    let replacement: number | null = null
    if (leftIndex >= 0 && rightIndex >= 0) {
      replacement = interpolate(leftValue, rightValue, leftIndex, rightIndex, index)
    } else if (leftIndex >= 0) {
      replacement = leftValue
    } else if (rightIndex >= 0) {
      replacement = rightValue
    }

    return {
      ...row,
      creatorCoinsMarketCapUsd: replacement,
    }
  })
}
