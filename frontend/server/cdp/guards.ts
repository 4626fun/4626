const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DECIMAL_INT_RE = /^\d+$/

const SUPPORTED_NETWORKS = new Set(['base', 'ethereum', 'arbitrum', 'optimism', 'polygon'])

export function validateCdpAddress(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !ADDRESS_RE.test(value.trim())) return `Invalid address field: ${field}`
  return null
}

export function validateCdpAmount(value: unknown, field: string): string | null {
  if (typeof value !== 'string' || !DECIMAL_INT_RE.test(value)) {
    return `Invalid ${field}: expected integer base-unit string`
  }
  const normalized = value.replace(/^0+/, '') || '0'
  if (normalized === '0') return `Invalid ${field}: must be greater than zero`
  if (normalized.length > 80) return `Invalid ${field}: value too large`
  return null
}

export function validateCdpNetwork(value: unknown): string | null {
  const network = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!SUPPORTED_NETWORKS.has(network)) {
    return `Unsupported network: ${String(value ?? '') || 'unknown'}`
  }
  return null
}

export function validateCdpSlippageBps(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0 || n > 10_000) {
    return 'Invalid slippageBps: expected integer between 1 and 10000'
  }
  return null
}
