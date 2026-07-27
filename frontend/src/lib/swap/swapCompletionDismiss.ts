export type SwapCompletionSettlement = 'pending' | 'confirmed' | 'failed' | 'delayed'

export function classifySwapCompletionReceipt(input: {
  receiptStatus: 'success' | 'reverted'
  replacementReason?: string | null
}): Extract<SwapCompletionSettlement, 'confirmed' | 'failed'> {
  const replacementPreservedSwap =
    input.replacementReason == null || input.replacementReason === 'repriced'
  return input.receiptStatus === 'success' && replacementPreservedSwap
    ? 'confirmed'
    : 'failed'
}

export function shouldResetSwapFormAfterCompletionDismiss(input: {
  swapCompletionConfirmed: boolean
  amountInUnits: string
  completionAmountInUnits: string | null | undefined
  busy: string | null
  txState: string | null
}): boolean {
  if (!input.swapCompletionConfirmed) return false
  if (input.busy != null) return false
  if (input.txState !== 'success') return false
  if (input.completionAmountInUnits == null) return false
  const current = Number(input.amountInUnits)
  const completed = Number(input.completionAmountInUnits)
  if (!Number.isFinite(current) || !Number.isFinite(completed)) return false
  return current === completed
}
