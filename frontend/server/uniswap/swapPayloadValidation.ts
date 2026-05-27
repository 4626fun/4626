import { coerceSwapTransactionValue, normalizeSwapApiResponsePayload } from '../../src/lib/uniswap/swapQuoteSanitize.js'

import { isObject } from './trading.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const HEX_RE = /^0x[0-9a-fA-F]+$/
const DECIMAL_RE = /^\d+$/

function isNumericString(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)) {
    return true
  }
  if (typeof value !== 'string' || !value.trim()) return false
  const raw = value.trim()
  return HEX_RE.test(raw) || DECIMAL_RE.test(raw)
}

export { normalizeSwapApiResponsePayload }

export function validateSwapTransactionPayload(payload: unknown): string | null {
  if (!isObject(payload)) return 'Invalid swap response from Uniswap API'

  const tx = payload.swap
  if (!isObject(tx)) return 'Uniswap swap response missing transaction payload'

  const to = tx.to
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) {
    return 'Uniswap swap response contains invalid recipient address'
  }
  const from = tx.from
  if (typeof from !== 'string' || !ADDRESS_RE.test(from)) {
    return 'Uniswap swap response contains invalid sender address'
  }

  const data = tx.data
  if (typeof data !== 'string' || data === '' || data === '0x' || !HEX_RE.test(data)) {
    return 'Uniswap swap response contains invalid transaction data'
  }

  if ('value' in tx && tx.value != null && !isNumericString(tx.value)) {
    return 'Uniswap swap response contains invalid transaction value'
  }
  // Normalize for downstream viem/ERC-4337 callers (API may return JSON numbers).
  if ('value' in tx) {
    ;(tx as Record<string, unknown>).value = coerceSwapTransactionValue(tx.value)
  }
  if ('gasLimit' in tx && tx.gasLimit != null && !isNumericString(tx.gasLimit)) {
    return 'Uniswap swap response contains invalid gas limit'
  }
  if ('maxFeePerGas' in tx && tx.maxFeePerGas != null && !isNumericString(tx.maxFeePerGas)) {
    return 'Uniswap swap response contains invalid maxFeePerGas'
  }
  if ('maxPriorityFeePerGas' in tx && tx.maxPriorityFeePerGas != null && !isNumericString(tx.maxPriorityFeePerGas)) {
    return 'Uniswap swap response contains invalid maxPriorityFeePerGas'
  }
  if ('gasPrice' in tx && tx.gasPrice != null && !isNumericString(tx.gasPrice)) {
    return 'Uniswap swap response contains invalid gasPrice'
  }
  if (tx.maxFeePerGas != null && tx.gasPrice != null) {
    return 'Uniswap swap response contains conflicting gas fields'
  }

  if ('chainId' in tx && tx.chainId != null) {
    const chainId = Number(tx.chainId)
    if (!Number.isInteger(chainId) || chainId <= 0) {
      return 'Uniswap swap response contains invalid chainId'
    }
  }

  return null
}
