import { executeCdpSwap, fetchCdpSwapPrice, buildCdpPriceRequest } from '@/lib/swap/cdpApi'
import type { SwapNormalizedQuote, SwapReviewRequest, SwapReviewResult } from '@/lib/swap/types'
import { assertValidSwapTransaction, type TransactionRequest } from '@/lib/uniswap/tradingApi'

type CdpLikeFee = {
  amount?: unknown
  token?: unknown
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toRoutingLabel(raw: Record<string, unknown>): string {
  const candidates = [raw.routing, raw.routeType, raw.route, raw.provider]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return 'CDP'
}

function normalizeFeeLike(raw: unknown): { protocolFee?: CdpLikeFee } | undefined {
  const obj = asObject(raw)
  if (!obj) return undefined
  const protocolFee = asObject(obj.protocolFee ?? obj.fee ?? null)
  if (!protocolFee) return undefined
  return {
    protocolFee: {
      amount: protocolFee.amount,
      token: protocolFee.token,
    },
  }
}

function normalizeCdpQuote(raw: Record<string, unknown>): SwapNormalizedQuote {
  const liquidityAvailable = Boolean(raw.liquidityAvailable ?? raw.routeAvailable ?? false)
  const issues = asObject(raw.issues)
  return {
    provider: 'cdp',
    routing: toRoutingLabel(raw),
    liquidityAvailable,
    toAmount: typeof raw.toAmount === 'string' ? raw.toAmount : undefined,
    minToAmount: typeof raw.minToAmount === 'string' ? raw.minToAmount : undefined,
    totalNetworkFee: typeof raw.totalNetworkFee === 'string' ? raw.totalNetworkFee : undefined,
    fees: normalizeFeeLike(raw.fees) as any,
    issues:
      issues && (issues.balance !== undefined || issues.allowance !== undefined)
        ? { balance: issues.balance, allowance: issues.allowance }
        : undefined,
    raw,
    supportsOrderExecution: false,
  }
}

function normalizeExecutionTransaction(params: {
  raw: Record<string, unknown>
  fallbackFrom: string
  chainId: number
}): TransactionRequest | null {
  const tx = asObject(params.raw.transaction ?? params.raw.swap ?? null)
  if (!tx) return null
  const to = typeof tx.to === 'string' ? tx.to : null
  const data = typeof tx.data === 'string' ? tx.data : null
  if (!to || !data) return null
  const normalized: TransactionRequest = {
    to,
    from: typeof tx.from === 'string' ? tx.from : params.fallbackFrom,
    data,
    value: typeof tx.value === 'string' && tx.value.trim() ? tx.value : '0',
    chainId: params.chainId as TransactionRequest['chainId'],
    gasLimit: typeof tx.gasLimit === 'string' ? tx.gasLimit : undefined,
    maxFeePerGas: typeof tx.maxFeePerGas === 'string' ? tx.maxFeePerGas : undefined,
    maxPriorityFeePerGas: typeof tx.maxPriorityFeePerGas === 'string' ? tx.maxPriorityFeePerGas : undefined,
    gasPrice: typeof tx.gasPrice === 'string' ? tx.gasPrice : undefined,
  }
  assertValidSwapTransaction(normalized)
  return normalized
}

export async function reviewCdpSwap(params: {
  request: SwapReviewRequest
}): Promise<SwapReviewResult> {
  const { request } = params
  const cdpRequest = buildCdpPriceRequest({
    chainId: request.chainId,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    amount: request.amount,
    swapper: request.swapper,
    slippageTolerance: request.slippageTolerance,
  })
  const cdpPrice = await fetchCdpSwapPrice(cdpRequest)
  const normalizedQuote = normalizeCdpQuote(cdpPrice)
  if (!normalizedQuote.liquidityAvailable) {
    return {
      quote: normalizedQuote,
      approval: null,
      swapTx: null,
      orderRequest: null,
    }
  }

  const executionPayload = await executeCdpSwap(cdpRequest)
  const swapTx = normalizeExecutionTransaction({
    raw: executionPayload,
    fallbackFrom: request.swapper,
    chainId: request.chainId,
  })
  return {
    quote: normalizedQuote,
    approval: null,
    swapTx,
    orderRequest: null,
  }
}
