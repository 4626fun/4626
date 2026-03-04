// Utility helpers for consistent token naming/symbol grammar.
// Share (OFT) tokens use a black square prefix; Vault share tokens use a white square prefix.
// Current format is creator-centric (e.g., AKITA).

export const SHARE_SYMBOL_PREFIX = '■' // U+25A0, Black Square
export const VAULT_SYMBOL_PREFIX = '▢' // U+25A2, White Square with Rounded Corners

function titleCase(word: string): string {
  if (!word) return ''
  const lower = word.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Strip current Unicode badge prefixes to recover the underlying ticker.
 */
export function normalizeUnderlyingSymbol(raw: string): string {
  const symbol = (raw ?? '').trim()
  if (!symbol) return ''
  if (symbol.startsWith(SHARE_SYMBOL_PREFIX) || symbol.startsWith(VAULT_SYMBOL_PREFIX)) {
    return symbol.slice(1)
  }
  return symbol
}

export function underlyingSymbolUpper(raw: string): string {
  const core = normalizeUnderlyingSymbol(raw)
  return core ? core.toUpperCase() : ''
}

export function toShareSymbol(rawUnderlying: string): string {
  const ticker = underlyingSymbolUpper(rawUnderlying)
  return ticker ? `${SHARE_SYMBOL_PREFIX}${ticker}` : ''
}

export function toVaultSymbol(rawUnderlying: string): string {
  const ticker = underlyingSymbolUpper(rawUnderlying)
  return ticker ? `${VAULT_SYMBOL_PREFIX}${ticker}` : ''
}

/**
 * Charm vault symbols should stay creator-centric and avoid quote symbols
 * (e.g. USDC/WETH), which can get visually filtered on some explorers.
 * Example: AKITA -> charmAKITA
 */
export function toCharmVaultSymbol(rawUnderlying: string): string {
  const ticker = underlyingSymbolUpper(rawUnderlying).replace(/[^A-Z0-9]/g, '')
  if (!ticker) return 'charm4626'
  return `charm${ticker.slice(0, 12)}`
}

export function toShareName(rawUnderlying: string, creatorName?: string): string {
  const base = creatorName?.trim() || normalizeUnderlyingSymbol(rawUnderlying)
  if (!base) return ''
  return `${titleCase(base)} Share Token`
}

export function toVaultName(rawUnderlying: string, creatorName?: string): string {
  const base = creatorName?.trim() || normalizeUnderlyingSymbol(rawUnderlying)
  if (!base) return ''
  return `${titleCase(base)} Vault Token`
}
