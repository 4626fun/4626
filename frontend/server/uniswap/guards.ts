const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const DECIMAL_INT_RE = /^\d+$/

const DEFAULT_ALLOWED_UNISWAP_CHAIN_IDS = new Set([8453])

function normalizeAddress(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!ADDRESS_RE.test(raw)) return null
  return raw.toLowerCase()
}

function parseCsvIntegers(raw: string): Set<number> {
  const out = new Set<number>()
  for (const piece of raw.split(/[\s,]+/g)) {
    const n = Number(piece)
    if (Number.isInteger(n) && n > 0) out.add(n)
  }
  return out
}

function parseCsvAddressSet(raw: string): Set<string> {
  const out = new Set<string>()
  for (const piece of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(piece)
    if (normalized) out.add(normalized)
  }
  return out
}

function parseCsvStringSet(raw: string): Set<string> {
  const out = new Set<string>()
  for (const piece of raw.split(/[\s,]+/g)) {
    const normalized = piece.trim().toUpperCase()
    if (normalized) out.add(normalized)
  }
  return out
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readMaxInputBaseUnits(): bigint | null {
  const raw = String(process.env.UNISWAP_MAX_INPUT_BASE_UNITS ?? '').trim()
  if (!raw || !DECIMAL_INT_RE.test(raw)) return null
  try {
    const parsed = BigInt(raw)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function readTokenAllowlist(): Set<string> {
  const raw = String(process.env.UNISWAP_TOKEN_ALLOWLIST ?? '').trim()
  if (!raw) return new Set()
  return parseCsvAddressSet(raw)
}

function readTokenDenylist(): Set<string> {
  const raw = String(process.env.UNISWAP_TOKEN_DENYLIST ?? '').trim()
  if (!raw) return new Set()
  return parseCsvAddressSet(raw)
}

function readAllowedRouteTypes(): Set<string> {
  const raw = String(process.env.UNISWAP_ALLOWED_ROUTE_TYPES ?? '').trim()
  if (!raw) return new Set()
  return parseCsvStringSet(raw)
}

export function getAllowedUniswapChainIds(): Set<number> {
  const raw = String(process.env.UNISWAP_ALLOWED_CHAIN_IDS ?? '').trim()
  if (!raw) return new Set(DEFAULT_ALLOWED_UNISWAP_CHAIN_IDS)
  const parsed = parseCsvIntegers(raw)
  if (parsed.size === 0) return new Set(DEFAULT_ALLOWED_UNISWAP_CHAIN_IDS)
  return parsed
}

export function validateAddressField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field]
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !ADDRESS_RE.test(value.trim())) return `Invalid address field: ${field}`
  return null
}

export function validateChainIdField(payload: Record<string, unknown>, field: string): string | null {
  if (!(field in payload)) return null
  const chainId = Number(payload[field])
  if (!Number.isInteger(chainId) || !getAllowedUniswapChainIds().has(chainId)) return `Unsupported ${field}`
  return null
}

export function validateIntegerAmountField(payload: Record<string, unknown>, field: string): string | null {
  if (!(field in payload)) return null
  const value = payload[field]
  if (typeof value !== 'string' || !DECIMAL_INT_RE.test(value)) return `Invalid ${field}: expected integer base-unit string`
  const normalized = value.replace(/^0+/, '') || '0'
  if (normalized === '0') return `Invalid ${field}: must be greater than zero`
  if (normalized.length > 40) return `Invalid ${field}: value too large`
  const max = readMaxInputBaseUnits()
  if (max !== null) {
    try {
      const amount = BigInt(normalized)
      if (amount > max) return `Invalid ${field}: exceeds configured max`
    } catch {
      return `Invalid ${field}: expected integer base-unit string`
    }
  }
  return null
}

export function validateTokenPolicy(payload: Record<string, unknown>, fields: string[]): string | null {
  const allowlist = readTokenAllowlist()
  const denylist = readTokenDenylist()
  for (const field of fields) {
    const value = payload[field]
    if (value === undefined || value === null || value === '') continue
    const normalized = normalizeAddress(value)
    if (!normalized) continue
    if (denylist.has(normalized)) return `Token denied by policy: ${field}`
    if (allowlist.size > 0 && !allowlist.has(normalized)) return `Token not allowlisted: ${field}`
  }
  return null
}

function quoteTokenFields(quote: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    tokenIn: quote.tokenIn,
    tokenOut: quote.tokenOut,
  }

  if (normalized.tokenIn == null && isObject(quote.input)) {
    normalized.tokenIn = quote.input.token
  }
  if (normalized.tokenOut == null && isObject(quote.output)) {
    normalized.tokenOut = quote.output.token
  }

  return normalized
}

export function validateQuoteTokenPolicy(quote: Record<string, unknown>): string | null {
  return validateTokenPolicy(quoteTokenFields(quote), ['tokenIn', 'tokenOut'])
}

export function validateRoutePolicy(routing: unknown): string | null {
  const allowed = readAllowedRouteTypes()
  if (allowed.size === 0) return null
  const route = String(routing ?? '').trim().toUpperCase()
  if (!route || !allowed.has(route)) return `Routing not allowed by policy: ${String(routing ?? 'unknown')}`
  return null
}
