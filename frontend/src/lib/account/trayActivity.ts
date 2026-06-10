import type { AppActivityEntry } from '@/lib/account/appActivityJournal'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'

export type TrayOnchainActivityRow = {
  txHash: string
  walletAddress: string
  timestampMs: number
  title: string
  subtitle: string
  kind: 'swap' | 'transfer' | 'contract' | 'unknown'
  failed: boolean
}

export type AccountTrayActivityBatch = {
  asOf: number
  results: Record<string, TrayOnchainActivityRow[]>
  merged: TrayOnchainActivityRow[]
}

export type TrayActivityRow = {
  id: string
  source: 'onchain' | 'app'
  txHash: string | null
  walletAddress: string
  walletLabel: string
  title: string
  subtitle: string
  timestampMs: number
  failed: boolean
}

function normalizeAddresses(addresses: string[]): string[] {
  const uniq = new Set<string>()
  for (const a of addresses) {
    const trimmed = String(a || '').trim().toLowerCase()
    if (!trimmed) continue
    uniq.add(trimmed)
  }
  return Array.from(uniq).sort()
}

export async function fetchAccountTrayActivityBatch(params: {
  addresses: string[]
  limitPerWallet?: number
}): Promise<AccountTrayActivityBatch | null> {
  const list = normalizeAddresses(params.addresses)
  if (list.length === 0) return null

  const qs = new URLSearchParams({
    ids: list.join(','),
    limit: String(params.limitPerWallet ?? 15),
  })

  const res = await fetch(`/api/wallet/trayActivity?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  const body = await parseApiEnvelope<AccountTrayActivityBatch>(res)
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(resolveApiErrorMessage(body, `tray_activity_http_${res.status}`))
  }
  return body.data
}

export function formatTrayActivityWhen(timestampMs: number): string {
  const deltaMs = Date.now() - timestampMs
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'Just now'
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function basescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`
}

export function buildMergedTrayActivityRows(params: {
  wallets: Array<{ address: string; label: string }>
  onchainMerged: TrayOnchainActivityRow[]
  appEntries: AppActivityEntry[]
  limit?: number
}): TrayActivityRow[] {
  const walletLabelByAddress = new Map(
    params.wallets.map((wallet) => [wallet.address.trim().toLowerCase(), wallet.label]),
  )
  const rows: TrayActivityRow[] = []

  for (const entry of params.appEntries) {
    const walletAddress = entry.walletAddress.trim().toLowerCase()
    rows.push({
      id: `app:${entry.id}`,
      source: 'app',
      txHash: entry.txHash,
      walletAddress,
      walletLabel: walletLabelByAddress.get(walletAddress) ?? 'Wallet',
      title: 'Swap on 4626',
      subtitle: `${entry.amountInUnits} → ${entry.estimatedOut}`,
      timestampMs: entry.completedAtMs,
      failed: false,
    })
  }

  for (const row of params.onchainMerged) {
    rows.push({
      id: `chain:${row.txHash}`,
      source: 'onchain',
      txHash: row.txHash,
      walletAddress: row.walletAddress,
      walletLabel: walletLabelByAddress.get(row.walletAddress) ?? 'Wallet',
      title: row.title,
      subtitle: row.subtitle,
      timestampMs: row.timestampMs,
      failed: row.failed,
    })
  }

  const byKey = new Map<string, TrayActivityRow>()
  for (const row of rows) {
    const key = row.txHash?.toLowerCase() ?? row.id
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, row)
      continue
    }
    if (row.source === 'app') {
      byKey.set(key, {
        ...row,
        failed: existing.failed || row.failed,
      })
      continue
    }
    if (existing.source === 'app') continue
    if (row.timestampMs >= existing.timestampMs) {
      byKey.set(key, row)
    }
  }

  const limit = params.limit ?? 30
  return Array.from(byKey.values())
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, limit)
}
