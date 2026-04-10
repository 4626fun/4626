const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_RE = /^0x[0-9a-fA-F]+$/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractCdpTransactionPayload(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null
  const direct = payload.transaction
  if (isObject(direct)) return direct

  const swap = payload.swap
  if (isObject(swap)) {
    if (isObject(swap.transaction)) return swap.transaction
    if (isObject(swap.tx)) return swap.tx
  }

  if (isObject(payload.quote)) {
    const quote = payload.quote as Record<string, unknown>
    if (isObject(quote.transaction)) return quote.transaction
  }

  return null
}

export function validateCdpSwapTransactionPayload(payload: unknown): string | null {
  const tx = extractCdpTransactionPayload(payload)
  if (!tx) return 'CDP swap response missing transaction payload'

  const to = tx.to
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) {
    return 'CDP swap response contains invalid recipient address'
  }
  const from = tx.from
  if (from !== undefined && from !== null && (typeof from !== 'string' || !ADDRESS_RE.test(from))) {
    return 'CDP swap response contains invalid sender address'
  }
  const data = tx.data
  if (typeof data !== 'string' || data === '' || data === '0x' || !HEX_RE.test(data)) {
    return 'CDP swap response contains invalid transaction data'
  }
  const value = tx.value
  if (value !== undefined && value !== null && typeof value !== 'string') {
    return 'CDP swap response contains invalid transaction value'
  }

  return null
}
