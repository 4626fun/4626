/**
 * CDP rejects pm_getPaymasterStubData / pm_getPaymasterData when fee fields are
 * missing. Viem's prepareUserOperation often calls the stub before gas fill and
 * omits maxFeePerGas entirely (while still sending callGasLimit: "0x0").
 * Inject zeroish placeholders so the field is present; real fees are filled later.
 */
const ZEROISH_FEE_HEX = '0x0'

function hasFeeField(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function ensurePaymasterUserOpFeeFields<T extends Record<string, unknown>>(userOp: T): T {
  const next: Record<string, unknown> = { ...userOp }
  if (!hasFeeField(next.maxFeePerGas)) {
    next.maxFeePerGas = ZEROISH_FEE_HEX
  }
  if (!hasFeeField(next.maxPriorityFeePerGas)) {
    next.maxPriorityFeePerGas = ZEROISH_FEE_HEX
  }
  return next as T
}
