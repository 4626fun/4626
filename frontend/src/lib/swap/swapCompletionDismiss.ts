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

/** Pending/delayed completions still represent an in-flight value-moving swap. */
export function isSwapExecutionLocked(settlement: SwapCompletionSettlement | null | undefined): boolean {
  return settlement === 'pending' || settlement === 'delayed'
}

export function canAutoDismissSwapCompletion(settlement: SwapCompletionSettlement): boolean {
  return settlement === 'confirmed'
}

/**
 * Pending stays non-dismissible so the notice cannot clear the in-flight lock.
 * Delayed is manually dismissible as an explicit recovery acknowledgment.
 */
export function canManuallyDismissSwapCompletion(settlement: SwapCompletionSettlement): boolean {
  return settlement !== 'pending'
}

/**
 * Caller-level guard for review/submit paths while settlement is unresolved.
 * `settlement: null` means "this caller does not know classified settlement" —
 * do not default to pending (that would re-lock confirmed/failed tx-hash
 * completions). Receipt-wait pending is enforced by the page-level lock.
 */
export function shouldBlockSwapSubmitWhileSettling(input: {
  hasSwapCompletion: boolean
  settlement: SwapCompletionSettlement | null | undefined
}): boolean {
  if (!input.hasSwapCompletion) return false
  if (input.settlement == null) return false
  return isSwapExecutionLocked(input.settlement)
}

/** Ordinary token/side/chain edits must preserve an in-flight completion lock. */
export function shouldClearSwapCompletionOnTradeReset(options?: {
  clearCompletion?: boolean
}): boolean {
  return Boolean(options?.clearCompletion)
}


/**
 * Preserve a completion through transient disconnects. Only a resolved switch
 * from one execution account to another makes the old account's lock irrelevant.
 */
export function shouldClearSwapCompletionForExecutionAddressChange(input: {
  previousExecutionAddress: string | null | undefined
  nextExecutionAddress: string | null | undefined
}): boolean {
  const previous = input.previousExecutionAddress?.trim().toLowerCase()
  const next = input.nextExecutionAddress?.trim().toLowerCase()
  return Boolean(previous && next && previous !== next)
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
