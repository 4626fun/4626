/**
 * Map on-chain ERC20 symbols for CCA auction tokens to product-facing labels.
 * Wrapped share tickers (e.g. wsAKITA) use the same ■-prefixed convention as swap UI.
 */
const SHARE_SYMBOL_PREFIX = '\u25A0' // U+25A0 BLACK SQUARE, matches frontend `tokenSymbols`

function underlyingTickerUpper(raw: string): string {
  let s = (raw ?? '').trim()
  if (!s) return ''
  if (s.startsWith(SHARE_SYMBOL_PREFIX) || s.startsWith('\u25A2')) {
    s = s.slice(1)
  }
  return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/**
 * @param onChainSymbol - `symbol()` from the auction ERC20
 * @returns Display symbol for UI (e.g. wsAKITA -> ■AKITA); passthrough for normal tokens
 */
export function auctionTokenDisplaySymbol(onChainSymbol: string | null | undefined): string | null {
  if (typeof onChainSymbol !== 'string') return null
  const s = onChainSymbol.trim()
  if (!s) return null
  if (s.startsWith(SHARE_SYMBOL_PREFIX)) return s

  const ws = /^ws(.+)$/i.exec(s)
  if (ws) {
    const ticker = underlyingTickerUpper(ws[1] ?? '')
    return ticker ? `${SHARE_SYMBOL_PREFIX}${ticker}` : s
  }

  return s
}
