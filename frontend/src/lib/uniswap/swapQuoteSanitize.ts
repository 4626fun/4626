import { permit2Address } from '@zoralabs/protocol-deployments'
import { getAddress, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

/**
 * Sanitize Uniswap Trading API /swap payloads before upstream submission.
 * Upstream RequestValidationError often surfaces as:
 * `"value" does not match any of the allowed types`
 * when transaction `value` is a JSON number (e.g. 0) instead of a decimal string.
 */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_DATA_RE = /^0x[0-9a-fA-F]+$/
const DECIMAL_RE = /^\d+$/
const BASE_PERMIT2_VERIFIER = getAddress(permit2Address[base.id])
export const BASE_PERMIT2_ALLOWED_SPENDERS = new Set<Address>([
  getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43'),
  getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
  getAddress('0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9'),
])

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

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

function normalizeChainId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || !DECIMAL_RE.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
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

export function assertBasePermit2Safety(params: {
  permitData: Record<string, unknown>
  expectedTokenAddress?: string | null
  allowedSpenders?: Iterable<string | Address>
}): { token: Address | null; spender: Address } {
  const domain = isPlainObject(params.permitData.domain) ? params.permitData.domain : null
  const valuesRaw = isPlainObject(params.permitData.values)
    ? params.permitData.values
    : isPlainObject(params.permitData.message)
      ? params.permitData.message
      : null
  if (!domain || !valuesRaw) {
    throw new Error('Permit2 payload is malformed. Please refresh the quote and try again.')
  }

  const chainId = normalizeChainId(domain.chainId)
  if (chainId !== base.id) {
    throw new Error('Permit2 payload must target Base mainnet. Refresh the quote and try again.')
  }

  const verifyingContract = normalizeAddress(domain.verifyingContract)
  if (!verifyingContract || verifyingContract !== BASE_PERMIT2_VERIFIER) {
    throw new Error('Permit2 payload must use the canonical Permit2 contract. Refresh the quote and try again.')
  }

  const spender = normalizeAddress(valuesRaw.spender)
  if (!spender) {
    throw new Error('Permit2 payload is missing token/spender details. Refresh the quote and try again.')
  }

  const allowedSpenders = new Set<Address>(
    Array.from(params.allowedSpenders ?? BASE_PERMIT2_ALLOWED_SPENDERS).map((value) => getAddress(String(value))),
  )
  if (!allowedSpenders.has(spender)) {
    throw new Error('Permit2 payload spender is not allowlisted. Refresh the quote and try again.')
  }

  const token = isPlainObject(valuesRaw.details)
    ? normalizeAddress(resolvePermitTokenAddress(valuesRaw.details.token))
    : null
  const expectedToken =
    params.expectedTokenAddress && isAddress(params.expectedTokenAddress)
      ? getAddress(params.expectedTokenAddress)
      : null
  if (expectedToken) {
    if (!token) {
      throw new Error('Permit2 payload is missing the expected token. Refresh the quote and try again.')
    }
    if (token !== expectedToken) {
      throw new Error('Permit2 payload token does not match the sell token. Refresh the quote and try again.')
    }
  }

  return { token, spender }
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
