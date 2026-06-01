import { formatUnits } from 'viem'

import {
  formatUniswapSwapTradeAmount,
  formatUniswapTokenBalanceAmount,
} from '@/lib/swap/uniswapNumberFormat'

export type SwapBalanceUnits = {
  raw: bigint
  decimals: number
}

/** Sell amount from on-chain balance — never round up past `raw`. */
export function amountUnitsFromBalancePercent(balance: SwapBalanceUnits, percent: number): string {
  const pct = Math.max(0, Math.min(100, percent))
  if (balance.raw <= 0n || pct <= 0) return '0'
  if (pct >= 100) {
    return trimSwapAmountTrailingZeros(formatUnits(balance.raw, balance.decimals))
  }
  const scaled = (balance.raw * BigInt(Math.round(pct))) / 100n
  if (scaled <= 0n) return '0'
  return trimSwapAmountTrailingZeros(formatUnits(scaled, balance.decimals))
}

export function trimSwapAmountTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export function parseSwapDisplayNumber(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** Wallet balance chip — Uniswap NumberType.TokenTx rules. */
export function formatSwapTokenBalanceLabel(raw: string | number, _symbol?: string): string {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/,/g, '')
  if (!normalized || normalized === '0' || normalized === '0.0') return '0'

  const n = parseSwapDisplayNumber(normalized)
  if (n == null || n === 0) return '0'

  return formatUniswapTokenBalanceAmount(Math.abs(n))
}

/** Uniswap token-selector USD line — always cents precision, comma grouped below $1M. */
export function formatSwapTokenUsdLabel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  if (value >= 1_000_000_000) {
    return `$${trimSwapAmountTrailingZeros((value / 1_000_000_000).toFixed(2))}B`
  }
  if (value >= 1_000_000) {
    return `$${trimSwapAmountTrailingZeros((value / 1_000_000).toFixed(2))}M`
  }
  return `$${trimSwapAmountTrailingZeros(
    value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )}`
}

/** Read-only quote output — Uniswap NumberType.SwapTradeAmount rules. */
export function formatSwapDisplayAmount(raw: string, _symbol?: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === '.' || normalized === '-') {
    return trimmed
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return trimmed
  if (n === 0) return '0'

  return formatUniswapSwapTradeAmount(Math.abs(n))
}
