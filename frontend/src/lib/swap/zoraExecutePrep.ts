import type { TransactionRequest } from '@/lib/uniswap/tradingApi'

/** How long review-time Zora execute prep remains valid for submit without re-signing. */
export const ZORA_EXECUTE_PREP_TTL_MS = 45_000

export type ZoraExecutePrepSnapshot = {
  preparedAt: number
  amountIn: string
  slippagePct: number
  tokenIn: string
  tokenOut: string
  executionAddress: string
  swapTo: string
  swapDataPrefix: string
  /** Set when Review-time `assertZoraRouterCallExecutesFromCsw` succeeded. */
  routerValidatedAt?: number
}

export type ZoraExecutePrepMatchParams = {
  amountIn: string
  slippagePct: number
  tokenIn: string
  tokenOut: string
  executionAddress: string
  swapTx: TransactionRequest | null | undefined
  now?: number
}

export function fingerprintSwapTxData(tx: TransactionRequest | null | undefined): string {
  const data = typeof tx?.data === 'string' ? tx.data.trim().toLowerCase() : ''
  if (!data) return ''
  return data.length <= 18 ? data : data.slice(0, 18)
}

export function buildZoraExecutePrepSnapshot(params: {
  amountIn: string
  slippagePct: number
  tokenIn: string
  tokenOut: string
  executionAddress: string
  swapTx: TransactionRequest
  routerValidated?: boolean
}): ZoraExecutePrepSnapshot {
  const to = String(params.swapTx.to ?? '')
    .trim()
    .toLowerCase()
  const now = Date.now()
  return {
    preparedAt: now,
    amountIn: params.amountIn,
    slippagePct: params.slippagePct,
    tokenIn: params.tokenIn.trim().toLowerCase(),
    tokenOut: params.tokenOut.trim().toLowerCase(),
    executionAddress: params.executionAddress.trim().toLowerCase(),
    swapTo: to,
    swapDataPrefix: fingerprintSwapTxData(params.swapTx),
    ...(params.routerValidated ? { routerValidatedAt: now } : {}),
  }
}

export function isZoraExecutePrepCalldataMatch(
  prep: ZoraExecutePrepSnapshot | null | undefined,
  params: ZoraExecutePrepMatchParams,
): boolean {
  if (!prep) return false
  if (prep.amountIn !== params.amountIn) return false
  if (prep.slippagePct !== params.slippagePct) return false
  if (prep.tokenIn !== params.tokenIn.trim().toLowerCase()) return false
  if (prep.tokenOut !== params.tokenOut.trim().toLowerCase()) return false
  if (prep.executionAddress !== params.executionAddress.trim().toLowerCase()) return false

  const swapTx = params.swapTx
  if (!swapTx) return false
  const to = String(swapTx.to ?? '')
    .trim()
    .toLowerCase()
  if (prep.swapTo !== to) return false
  if (prep.swapDataPrefix !== fingerprintSwapTxData(swapTx)) return false
  return true
}

export function isZoraRouterValidationFresh(
  prep: ZoraExecutePrepSnapshot | null | undefined,
  now: number = Date.now(),
): boolean {
  const validatedAt = prep?.routerValidatedAt
  if (typeof validatedAt !== 'number' || validatedAt <= 0) return false
  return now - validatedAt <= ZORA_EXECUTE_PREP_TTL_MS
}

/** True when submit must re-run Zora prepare/build (calldata or router validation stale). */
export function needsZoraSubmitRefresh(
  prep: ZoraExecutePrepSnapshot | null | undefined,
  params: ZoraExecutePrepMatchParams,
): boolean {
  const now = params.now ?? Date.now()
  if (!isZoraExecutePrepCalldataMatch(prep, params)) return true
  if (!isZoraRouterValidationFresh(prep, now)) return true
  return false
}

export function isZoraExecutePrepFresh(
  prep: ZoraExecutePrepSnapshot | null | undefined,
  params: ZoraExecutePrepMatchParams,
): boolean {
  if (!prep) return false
  const now = params.now ?? Date.now()
  if (now - prep.preparedAt > ZORA_EXECUTE_PREP_TTL_MS) return false
  return isZoraExecutePrepCalldataMatch(prep, params)
}

/** Review validated route + matching calldata → skip submit-time sim/gas-estimate/assert. */
export function canFastCanonicalZoraSubmit(params: {
  executionMode: 'canonical' | 'eoa'
  prep: ZoraExecutePrepSnapshot | null | undefined
  quoteIsZora: boolean
  matchParams: ZoraExecutePrepMatchParams
  now?: number
}): boolean {
  if (params.executionMode !== 'canonical' || !params.quoteIsZora) return false
  const now = params.now ?? Date.now()
  if (!isZoraRouterValidationFresh(params.prep, now)) return false
  return isZoraExecutePrepCalldataMatch(params.prep, { ...params.matchParams, now })
}
