/**
 * Sanitize Uniswap Trading API /swap payloads before upstream submission.
 * Upstream RequestValidationError often surfaces as:
 * `"value" does not match any of the allowed types`
 * when transaction `value` is a JSON number (e.g. 0) instead of a decimal string.
 */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_DATA_RE = /^0x[0-9a-fA-F]+$/
const DECIMAL_RE = /^\d+$/

const INTERNAL_QUOTE_KEYS = new Set([
  '_provider',
  '_cdpParams',
  '_fallbackUsed',
  '_preferredProvider',
  'provider',
  'fallbackUsed',
  'preferredProvider',
  'liquidityAvailable',
  'toAmount',
  'minToAmount',
  'totalNetworkFee',
  'fees',
  'issues',
  'requestId',
  'routing',
  'permitData',
  'permitSingleData',
  'permitTransferFromData',
  'signature',
  'permitTransaction',
  'permitGasFee',
])

const TOKEN_AMOUNT_KEYS = new Set([
  'amount',
  'amountIn',
  'amountOut',
  'startAmount',
  'endAmount',
  'minAmount',
  'portionAmount',
  'expectedAmountIn',
  'expectedAmountOut',
])

const QUOTE_GAS_STRING_FIELDS = new Set([
  'gasLimit',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'gasUseEstimate',
  'blockNumber',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function looksLikeTransaction(value: Record<string, unknown>): boolean {
  const to = value.to
  const data = value.data
  return typeof to === 'string' && ADDRESS_RE.test(to) && typeof data === 'string' && HEX_DATA_RE.test(data)
}

export function coerceSwapTransactionValue(value: unknown): string {
  if (value === undefined || value === null) return '0'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (!Number.isInteger(value) || value < 0) return '0'
    return String(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '0'
    if (DECIMAL_RE.test(trimmed) || HEX_DATA_RE.test(trimmed)) return trimmed
    return '0'
  }
  return '0'
}

function coerceNumericStringField(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) {
    return String(value)
  }
  return undefined
}

export function normalizeSwapTransactionRecord(tx: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...tx }
  next.value = coerceSwapTransactionValue(tx.value)
  for (const field of ['gasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'gasPrice'] as const) {
    const coerced = coerceNumericStringField(tx[field])
    if (coerced !== undefined) next[field] = coerced
  }
  return next
}

function unwrapClassicQuotePayload(quote: Record<string, unknown>): Record<string, unknown> {
  if (isPlainObject(quote.quote)) return quote.quote
  if (isPlainObject(quote.classicQuote)) return quote.classicQuote
  if (isPlainObject(quote.wrapUnwrapQuote)) return quote.wrapUnwrapQuote
  if (isPlainObject(quote.bridgeQuote)) return quote.bridgeQuote
  return quote
}

function deepSanitizeQuoteNode(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map((item) => deepSanitizeQuoteNode(item))
  }

  if (!isPlainObject(value)) {
    if (key && TOKEN_AMOUNT_KEYS.has(key)) {
      const coerced = coerceNumericStringField(value)
      if (coerced !== undefined) return coerced
    }
    if (key && QUOTE_GAS_STRING_FIELDS.has(key)) {
      const coerced = coerceNumericStringField(value)
      if (coerced !== undefined) return coerced
    }
    return value
  }

  if (looksLikeTransaction(value)) {
    return normalizeSwapTransactionRecord(value)
  }

  const next: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    if (INTERNAL_QUOTE_KEYS.has(childKey)) continue
    next[childKey] = deepSanitizeQuoteNode(childValue, childKey)
  }
  return next
}

export function sanitizeClassicQuoteForSwap(quote: Record<string, unknown>): Record<string, unknown> {
  const unwrapped = unwrapClassicQuotePayload(quote)
  const sanitized = deepSanitizeQuoteNode(unwrapped)
  if (!isPlainObject(sanitized)) return {}

  const next: Record<string, unknown> = { ...sanitized }

  if (typeof next.slippage === 'string') {
    const parsed = Number(next.slippage)
    if (Number.isFinite(parsed)) next.slippage = parsed
  }

  for (const field of QUOTE_GAS_STRING_FIELDS) {
    const coerced = coerceNumericStringField(next[field])
    if (coerced !== undefined) next[field] = coerced
  }

  return next
}

export function sanitizeCreateSwapRequestPayload(body: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body }
  delete next.permit2Disabled
  delete next.permitTransaction

  if (isPlainObject(next.quote)) {
    next.quote = sanitizeClassicQuoteForSwap(next.quote)
  }

  return next
}

export function normalizeSwapApiResponsePayload(payload: unknown): unknown {
  if (!isPlainObject(payload)) return payload

  const swap = payload.swap
  if (!isPlainObject(swap)) return payload

  return {
    ...payload,
    swap: normalizeSwapTransactionRecord(swap),
  }
}
