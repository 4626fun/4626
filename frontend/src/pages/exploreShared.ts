const IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'

export function isSupportedExploreChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function toDisplayAssetUrl(value?: string): string | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (normalized.startsWith('ipfs://')) {
    const path = normalized.slice('ipfs://'.length).replace(/^ipfs\//, '').replace(/^\/+/, '')
    if (!path) return undefined
    return `${IPFS_GATEWAY}${path}`
  }
  return normalized
}

export function formatShortAddress(value: string | null | undefined, fallback = '-'): string {
  if (!value) return fallback
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value < 0.01) return `$${value.toFixed(6)}`
  return `$${value.toFixed(2)}`
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

export function formatTimestamp(ts: number): string {
  const ms = ts < 1_000_000_000_000 ? ts * 1000 : ts
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateLabel(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTokenAmount(value: number): string {
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs === 0) return '0'
  if (abs < 0.0001) return abs.toExponential(2)
  if (abs < 1) return abs.toFixed(6)
  if (abs < 1000) return abs.toFixed(4)
  return abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
