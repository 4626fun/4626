export type ReviewedSwapEconomics = {
  reviewedInputAmount: string | null | undefined
  refreshedInputAmount: string | null | undefined
  reviewedOutputAmount: string | null | undefined
  refreshedOutputAmount: string | null | undefined
}

function parsePositiveInteger(value: string | null | undefined, label: string): bigint {
  const normalized = String(value ?? '').trim()
  if (!/^[0-9]+$/.test(normalized)) {
    throw new Error(`Cannot verify ${label}; refresh the review before submitting.`)
  }
  const parsed = BigInt(normalized)
  if (parsed <= 0n) {
    throw new Error(`Cannot verify ${label}; refresh the review before submitting.`)
  }
  return parsed
}

/**
 * A submit-time refresh may update calldata, nonce, and gas fields, but it may
 * not silently change the exact input or reduce the output accepted at review.
 */
export function assertRefreshedSwapPreservesReview(params: ReviewedSwapEconomics): void {
  const reviewedInput = parsePositiveInteger(params.reviewedInputAmount, 'reviewed swap input')
  const refreshedInput = parsePositiveInteger(params.refreshedInputAmount, 'refreshed swap input')
  if (refreshedInput !== reviewedInput) {
    throw new Error('Swap input changed after review. Review the updated quote before submitting.')
  }

  const reviewedOutput = parsePositiveInteger(params.reviewedOutputAmount, 'reviewed swap output')
  const refreshedOutput = parsePositiveInteger(params.refreshedOutputAmount, 'refreshed swap output')
  if (refreshedOutput < reviewedOutput) {
    throw new Error('Swap output worsened after review. Review the updated quote before submitting.')
  }
}
