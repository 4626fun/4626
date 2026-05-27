const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDBC'])

export function trimSwapAmountTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
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
