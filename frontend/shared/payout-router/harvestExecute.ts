import {
  type HexAddress,
  type PayoutRouterBatchAction,
  type PlannedHarvestConversion,
  toProcessBatchArgs,
} from './harvestCommon.js'

export type HarvestBatchSubmitResult = {
  success: boolean
  txHash?: HexAddress
  error?: string
}

export type HarvestExecutionFailure = {
  conversion: PlannedHarvestConversion
  error?: string
  txHash?: HexAddress
}

export type HarvestExecutionSuccess = {
  conversion: PlannedHarvestConversion
  txHash?: HexAddress
}

export type HarvestExecutionOutcome = {
  converted: HarvestExecutionSuccess[]
  failed: HarvestExecutionFailure[]
  primaryBatchTxHash?: HexAddress
  usedPerTokenFallback: boolean
}

/**
 * Submit planned conversions via processBatch. On full-batch revert, optionally retry each token alone.
 */
export async function executePlannedHarvestConversions(params: {
  conversions: PlannedHarvestConversion[]
  submitBatch: (actions: PayoutRouterBatchAction[]) => Promise<HarvestBatchSubmitResult>
  perTokenFallback?: boolean
}): Promise<HarvestExecutionOutcome> {
  const conversions = params.conversions
  if (conversions.length === 0) {
    return { converted: [], failed: [], usedPerTokenFallback: false }
  }

  const perTokenFallback = params.perTokenFallback !== false

  const submit = async (entries: PlannedHarvestConversion[]): Promise<HarvestBatchSubmitResult> =>
    params.submitBatch(toProcessBatchArgs(entries))

  const successEntries = (
    entries: PlannedHarvestConversion[],
    txHash?: HexAddress,
  ): HarvestExecutionSuccess[] => entries.map((conversion) => ({ conversion, txHash }))

  if (conversions.length === 1 || !perTokenFallback) {
    const result = await submit(conversions)
    if (result.success) {
      return {
        converted: successEntries(conversions, result.txHash),
        failed: [],
        primaryBatchTxHash: result.txHash,
        usedPerTokenFallback: false,
      }
    }
    return {
      converted: [],
      failed: conversions.map((conversion) => ({ conversion, error: result.error, txHash: result.txHash })),
      primaryBatchTxHash: result.txHash,
      usedPerTokenFallback: false,
    }
  }

  const batchResult = await submit(conversions)
  if (batchResult.success) {
    return {
      converted: successEntries(conversions, batchResult.txHash),
      failed: [],
      primaryBatchTxHash: batchResult.txHash,
      usedPerTokenFallback: false,
    }
  }

  const converted: HarvestExecutionSuccess[] = []
  const failed: HarvestExecutionFailure[] = []

  for (const conversion of conversions) {
    const singleResult = await submit([conversion])
    if (singleResult.success) {
      converted.push({ conversion, txHash: singleResult.txHash })
      continue
    }
    failed.push({ conversion, error: singleResult.error ?? batchResult.error, txHash: singleResult.txHash })
  }

  return {
    converted,
    failed,
    primaryBatchTxHash: batchResult.txHash,
    usedPerTokenFallback: true,
  }
}
