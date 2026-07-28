export const UNWIND_STEPS = [
  'all',
  'ajna-buffer',
  'strategies',
  'idle',
  'shutdown',
  'drain',
] as const

export type UnwindStep = (typeof UNWIND_STEPS)[number]

export function readCliValue(argv: readonly string[], name: string): string {
  const inlinePrefix = `${name}=`
  const inline = argv.find((arg) => arg.startsWith(inlinePrefix))
  if (inline) return inline.slice(inlinePrefix.length)

  const index = argv.indexOf(name)
  if (index === -1) return ''
  const value = argv[index + 1]
  return !value || value.startsWith('--') ? '' : value
}

export function parseUnwindStep(value: string): UnwindStep {
  const normalized = (value || 'all').toLowerCase()
  if (!UNWIND_STEPS.includes(normalized as UnwindStep)) {
    throw new Error(`Invalid --step "${value}". Expected one of: ${UNWIND_STEPS.join(', ')}`)
  }
  return normalized as UnwindStep
}

export function assertSuccessfulUserOperationReceipt(
  receipt: { success?: boolean },
  label: string,
): void {
  if (receipt.success !== true) {
    throw new Error(`UserOp failed (${label})`)
  }
}

export function evaluateUnwindCompletion(params: {
  totalDebt: bigint
  ajnaAdapterAssets: bigint | null
  ajnaBucketLp: readonly bigint[]
  verificationError?: string | null
}): boolean {
  return (
    params.totalDebt === 0n &&
    params.ajnaAdapterAssets === 0n &&
    params.ajnaBucketLp.every((lp) => lp === 0n) &&
    !params.verificationError
  )
}
