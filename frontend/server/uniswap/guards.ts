const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DECIMAL_INT_RE = /^\d+$/

export const ALLOWED_UNISWAP_CHAIN_IDS = new Set([8453])

export function validateAddressField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field]
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !ADDRESS_RE.test(value.trim())) return `Invalid address field: ${field}`
  return null
}

export function validateChainIdField(payload: Record<string, unknown>, field: string): string | null {
  if (!(field in payload)) return null
  const chainId = Number(payload[field])
  if (!Number.isInteger(chainId) || !ALLOWED_UNISWAP_CHAIN_IDS.has(chainId)) return `Unsupported ${field}`
  return null
}

export function validateIntegerAmountField(payload: Record<string, unknown>, field: string): string | null {
  if (!(field in payload)) return null
  const value = payload[field]
  if (typeof value !== 'string' || !DECIMAL_INT_RE.test(value)) return `Invalid ${field}: expected integer base-unit string`
  const normalized = value.replace(/^0+/, '') || '0'
  if (normalized === '0') return `Invalid ${field}: must be greater than zero`
  if (normalized.length > 40) return `Invalid ${field}: value too large`
  return null
}
