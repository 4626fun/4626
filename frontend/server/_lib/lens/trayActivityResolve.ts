import { getTrayWalletActivityBaseEtherscan, type TrayOnchainActivityRow } from './baseTrayActivityEtherscan.js'

export type { TrayOnchainActivityRow }

export type TrayActivityBatchResult = {
  asOf: number
  results: Record<string, TrayOnchainActivityRow[]>
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let idx = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const current = idx++
      out[current] = await fn(items[current]!)
    }
  })
  await Promise.all(workers)
  return out
}

export async function resolveTrayWalletActivityBatch(
  addresses: string[],
  options: { limitPerWallet?: number } = {},
): Promise<TrayActivityBatchResult> {
  const list = addresses.map((raw) => raw.trim().toLowerCase()).filter(Boolean)
  const limitPerWallet = options.limitPerWallet ?? 15
  const resolvedList = await mapWithLimit(list, 3, (addr) =>
    getTrayWalletActivityBaseEtherscan(addr, { limit: limitPerWallet }),
  )

  const results: Record<string, TrayOnchainActivityRow[]> = {}
  list.forEach((addr, i) => {
    results[addr] = resolvedList[i] ?? []
  })

  return { asOf: Date.now(), results }
}

export function mergeTrayActivityRows(rows: TrayOnchainActivityRow[]): TrayOnchainActivityRow[] {
  const byHash = new Map<string, TrayOnchainActivityRow>()
  for (const row of rows) {
    const existing = byHash.get(row.txHash)
    if (!existing || existing.timestampMs < row.timestampMs) {
      byHash.set(row.txHash, row)
    }
  }
  return Array.from(byHash.values()).sort((a, b) => b.timestampMs - a.timestampMs)
}
