/** User-facing progress while Zora/canonical swap prep runs (Permit2 + quote refresh are automatic). */
export const SWAP_PREPARE_STATUS = 'Preparing swap…'

export function swapPermitProgressStatus(executionMode: 'canonical' | 'eoa'): string {
  return executionMode === 'eoa'
    ? 'Confirm the allowance signature in your wallet…'
    : SWAP_PREPARE_STATUS
}

/** Shown when router / CSW simulation reverts before submit (not a balance error). */
export const SWAP_SIMULATION_FAILED_MESSAGE =
  'This swap would fail on-chain — usually because the quote is stale, slippage is too tight, or the pool cannot fill this size. Try a smaller amount, increase slippage, wait ~30s if another swap is still confirming, then retry.'

/** Permit2 `InvalidNonce()` (`0x756688fe`) — embedded permit nonce was already consumed. */
export const PERMIT2_INVALID_NONCE_MESSAGE =
  'This swap\'s Permit2 authorization is stale (nonce already used). Refresh the quote and try again. If another swap is still confirming, wait ~30 seconds first.'

/** @deprecated Use {@link SWAP_SIMULATION_FAILED_MESSAGE} — kept for existing imports/tests. */
export const ZORA_SWAP_SIMULATION_FAILED_MESSAGE = SWAP_SIMULATION_FAILED_MESSAGE
