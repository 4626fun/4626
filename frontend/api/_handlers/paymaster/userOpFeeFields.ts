/**
 * CDP rejects pm_getPaymasterStubData / pm_getPaymasterData when fee fields are
 * missing or zero. Viem's prepareUserOperation often calls the stub before gas
 * fill and omits maxFeePerGas entirely (while still sending callGasLimit: "0x0").
 * Inject a minimal non-zero stub; real fees are filled later on pm_getPaymasterData.
 */
const STUB_FEE_HEX = '0x1'

function isMissingOrZeroFee(value: unknown): boolean {
  if (typeof value !== 'string') return true
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    return BigInt(trimmed) === 0n
  } catch {
    return true
  }
}

export function ensurePaymasterUserOpFeeFields<T extends Record<string, unknown>>(userOp: T): T {
  const next: Record<string, unknown> = { ...userOp }
  if (isMissingOrZeroFee(next.maxFeePerGas)) {
    next.maxFeePerGas = STUB_FEE_HEX
  }
  if (isMissingOrZeroFee(next.maxPriorityFeePerGas)) {
    next.maxPriorityFeePerGas = STUB_FEE_HEX
  }
  return next as T
}
