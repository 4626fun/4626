import { formatUnits } from 'viem'

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDBC'])

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

/** Round a decimal string to cents without losing large integer precision. */
function roundBalanceStringToCents(normalized: string): string {
  const negative = normalized.startsWith('-')
  const unsigned = (negative ? normalized.slice(1) : normalized).trim()
  if (!unsigned || unsigned === '0') return '0'
  if (!/^\d*\.?\d+$/.test(unsigned)) {
    const n = parseSwapDisplayNumber(unsigned)
    return n == null ? '0' : roundBalanceStringToCents(String(Math.abs(n)))
  }

  const prefix = negative ? '-' : ''
  const [intPartRaw = '0', fracPart = ''] = unsigned.split('.')
  let intDigits = intPartRaw.replace(/^0+(?=\d)/, '') || '0'

  const d0 = fracPart[0] ?? '0'
  const d1 = fracPart[1] ?? '0'
  const d2 = fracPart[2] ?? '0'

  let c0 = Number(d0)
  let c1 = Number(d1)
  if (d2 >= '5') {
    c1 += 1
    if (c1 >= 10) {
      c1 = 0
      c0 += 1
      if (c0 >= 10) {
        c0 = 0
        intDigits = (BigInt(intDigits) + 1n).toString()
      }
    }
  }

  const groupedInt = BigInt(intDigits).toLocaleString('en-US')
  if (!fracPart || (c0 === 0 && c1 === 0)) {
    return `${prefix}${groupedInt}`
  }

  return trimSwapAmountTrailingZeros(`${prefix}${groupedInt}.${c0}${String(c1)}`)
}

function formatBalanceCentsLabelFromNormalized(normalized: string): string {
  return roundBalanceStringToCents(normalized.replace(/^-/, ''))
}

/**
 * Token balance labels: comma-grouped with up to 2 decimals for holdings (654,538.89);
 * stables pinned to cents when >= 1; smaller fractional amounts keep extra precision.
 */
export function formatSwapTokenBalanceLabel(raw: string | number, symbol?: string): string {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/,/g, '')
  if (!normalized || normalized === '0' || normalized === '0.0') return '0'

  const n = parseSwapDisplayNumber(normalized)
  if (n == null || n === 0) return '0'

  const abs = Math.abs(n)
  const stable = symbol ? STABLE_SYMBOLS.has(symbol.toUpperCase()) : false

  if (stable) {
    if (abs >= 1) {
      return formatBalanceCentsLabelFromNormalized(normalized)
    }
    return trimSwapAmountTrailingZeros(abs.toFixed(6))
  }

  if (abs >= 1) {
    return formatBalanceCentsLabelFromNormalized(normalized)
  }
  if (abs >= 0.01) {
    return formatBalanceCentsLabelFromNormalized(normalized)
  }
  if (abs >= 0.00001) {
    return trimSwapAmountTrailingZeros(abs.toFixed(5))
  }
  if (abs >= 0.000001) {
    return trimSwapAmountTrailingZeros(abs.toFixed(6))
  }
  return trimSwapAmountTrailingZeros(abs.toPrecision(4))
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

/** Uniswap-like quoted output formatting — not for in-progress sell-side typing. */
export function formatSwapDisplayAmount(raw: string, symbol?: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === '.' || normalized === '-') {
    return trimmed
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return trimmed
  if (n === 0) return '0'

  const stable = symbol ? STABLE_SYMBOLS.has(symbol.toUpperCase()) : false

  if (stable) {
    if (n >= 1) return trimSwapAmountTrailingZeros(n.toFixed(2))
    return trimSwapAmountTrailingZeros(n.toFixed(6))
  }

  if (n >= 1_000_000) {
    return trimSwapAmountTrailingZeros(
      n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }),
    )
  }
  if (n >= 1) {
    return trimSwapAmountTrailingZeros(n.toFixed(6))
  }
  if (n >= 0.000001) {
    return trimSwapAmountTrailingZeros(n.toPrecision(6))
  }
  return trimSwapAmountTrailingZeros(n.toExponential(4))
}
