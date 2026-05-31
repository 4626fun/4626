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

function coercePermitDecimalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) {
    // uint160/uint256 must stay decimal strings — large JS numbers lose precision and stringify to 1e+48.
    if (value <= Number.MAX_SAFE_INTEGER) return String(value)
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) return trimmed
  }
  return null
}

function resolvePermitTokenAddress(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return ADDRESS_RE.test(trimmed) ? trimmed : null
  }
  if (isPlainObject(value)) {
    const nested =
      typeof value.address === 'string'
        ? value.address.trim()
        : typeof value.token === 'string'
          ? value.token.trim()
          : ''
    return ADDRESS_RE.test(nested) ? nested : null
  }
  return null
}

/**
 * Uniswap /swap protobuf JSON expects Permit2 numeric fields as decimal strings
 * (see trade-api PermitSingle examples: amount, expiration, nonce, sigDeadline).
 */
export function sanitizePermitDataForSwapApi(
  permitData: Record<string, unknown>,
): Record<string, unknown> {
  const domain = isPlainObject(permitData.domain) ? { ...permitData.domain } : null
  const valuesRaw = isPlainObject(permitData.values)
    ? permitData.values
    : isPlainObject(permitData.message)
      ? permitData.message
      : null

  if (!domain || !valuesRaw) return permitData

  const chainId = domain.chainId
  if (typeof chainId === 'string' && /^\d+$/.test(chainId.trim())) {
    domain.chainId = Number(chainId.trim())
  }

  const values: Record<string, unknown> = {}

  if (isPlainObject(valuesRaw.details)) {
    const detailsRaw = valuesRaw.details as Record<string, unknown>
    const details: Record<string, string> = {}
    const token = resolvePermitTokenAddress(detailsRaw.token)
    const amount = coercePermitDecimalString(detailsRaw.amount)
    const expiration = coercePermitDecimalString(detailsRaw.expiration)
    const nonce = coercePermitDecimalString(detailsRaw.nonce)

    if (token) details.token = token
    if (amount != null) details.amount = amount
    if (expiration != null) details.expiration = expiration
    if (nonce != null) details.nonce = nonce

    if (Object.keys(details).length > 0) {
      values.details = details
    }
  }

  const sigDeadline = coercePermitDecimalString(valuesRaw.sigDeadline)
  if (sigDeadline != null) values.sigDeadline = sigDeadline

  if (typeof valuesRaw.spender === 'string') {
    const spender = valuesRaw.spender.trim()
    if (ADDRESS_RE.test(spender)) values.spender = spender
  }

  const next: Record<string, unknown> = {
    domain,
    values,
  }

  if (isPlainObject(permitData.types)) {
    next.types = permitData.types
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

  if (isPlainObject(next.permitData)) {
    next.permitData = sanitizePermitDataForSwapApi(next.permitData)
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
