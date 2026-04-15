import type {
  BuildSwapParams,
  Routing,
  TradeApprovalResponse,
  TradeQuoteResponse,
  TransactionRequest,
} from '@/lib/uniswap/tradingApi'
import {
  assertValidSwapTransaction,
  buildSwap,
  checkTradeApproval,
  createOrder,
  fetchTradeQuote,
  isUniswapXRouting,
  pickOrderQuote,
  pickQuote,
  pickSwapQuote,
  pickPermitData,
  toPermitSignPayload,
} from '@/lib/uniswap/tradingApi'
import { NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'
import type { SwapNormalizedQuote, SwapReviewRequest, SwapReviewResult } from '@/lib/swap/types'

function hasApprovalTransaction(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const approval = (value as { approval?: unknown }).approval
  if (!approval || typeof approval !== 'object') return false
  const tx = approval as Record<string, unknown>
  return typeof tx.to === 'string' && tx.to.length > 0 && typeof tx.data === 'string' && tx.data.length > 0
}

export type UniswapPermitSigner = (args: {
  quote: TradeQuoteResponse
}) => Promise<{ permitData?: Record<string, unknown>; signature?: string }>

function normalizeToTransactionRequest(
  tx: Record<string, unknown>,
  signerAddress: string | null,
  chainId: number,
): TransactionRequest {
  return {
    to: tx.to as string,
    from: (tx.from as string) ?? signerAddress ?? '',
    data: tx.data as string,
    value: typeof tx.value === 'string' && tx.value.trim() ? tx.value : '0',
    chainId: chainId as TransactionRequest['chainId'],
    gasLimit: typeof tx.gasLimit === 'string' ? tx.gasLimit : undefined,
    maxFeePerGas: typeof tx.maxFeePerGas === 'string' ? tx.maxFeePerGas : undefined,
    maxPriorityFeePerGas: typeof tx.maxPriorityFeePerGas === 'string' ? tx.maxPriorityFeePerGas : undefined,
    gasPrice: typeof tx.gasPrice === 'string' ? tx.gasPrice : undefined,
  }
}

function normalizeUniswapQuote(quote: TradeQuoteResponse): SwapNormalizedQuote {
  const quotePayload = (pickQuote(quote) ?? quote) as Record<string, unknown>
  const toAmountCandidate =
    quotePayload.output && typeof quotePayload.output === 'object' && quotePayload.output
      ? (quotePayload.output as Record<string, unknown>).amount
      : quotePayload.amountOut

  const liquidityAvailable = Boolean(
    quotePayload.liquidityAvailable ?? quotePayload.route ?? quotePayload.routeString ?? quote.routing,
  )

  return {
    provider: 'uniswap',
    routing: String(quote.routing ?? 'CLASSIC'),
    liquidityAvailable,
    toAmount: typeof toAmountCandidate === 'string' ? toAmountCandidate : undefined,
    minToAmount:
      typeof quotePayload.minToAmount === 'string'
        ? quotePayload.minToAmount
        : typeof quotePayload.amountOutMin === 'string'
          ? quotePayload.amountOutMin
          : undefined,
    totalNetworkFee:
      typeof quotePayload.gasFeeUSD === 'string'
        ? quotePayload.gasFeeUSD
        : typeof quotePayload.totalNetworkFee === 'string'
          ? quotePayload.totalNetworkFee
          : undefined,
    fees:
      quotePayload.fees && typeof quotePayload.fees === 'object'
        ? (quotePayload.fees as { protocolFee?: { amount?: string; token?: string } })
        : undefined,
    issues:
      quotePayload.issues && typeof quotePayload.issues === 'object'
        ? (quotePayload.issues as { balance?: unknown; allowance?: unknown })
        : undefined,
    raw: quote as Record<string, unknown>,
    supportsOrderExecution: isUniswapXRouting(quote.routing),
  }
}

async function buildUniswapApprovalIfNeeded(request: SwapReviewRequest): Promise<TradeApprovalResponse> {
  if (request.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS) {
    return { approval: null, cancel: null } as TradeApprovalResponse
  }
  return await checkTradeApproval({
    walletAddress: request.swapper,
    token: request.tokenIn,
    amount: request.amount,
    chainId: request.chainId as any,
    tokenOut: request.tokenOut,
    tokenOutChainId: request.chainId as any,
    includeGasInfo: true,
  })
}

export async function reviewUniswapSwap(params: {
  request: SwapReviewRequest
  deadlineSeconds: number
  signPermitIfRequired: UniswapPermitSigner
}): Promise<SwapReviewResult> {
  const { request, deadlineSeconds, signPermitIfRequired } = params
  const [quote, approval] = await Promise.all([
    fetchTradeQuote({
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      tokenInChainId: request.chainId as any,
      tokenOutChainId: request.chainId as any,
      type: 'EXACT_INPUT',
      amount: request.amount,
      swapper: request.swapper,
      slippageTolerance: request.slippageTolerance,
      routingPreference: 'BEST_PRICE',
      permitAmount: 'EXACT',
      walletModeKey: request.executionMode,
      xChainedActionsEnabled: request.xChainedActionsEnabled,
    }),
    buildUniswapApprovalIfNeeded(request),
  ])

  const normalizedQuote = normalizeUniswapQuote(quote)
  if (!normalizedQuote.liquidityAvailable) {
    return {
      quote: normalizedQuote,
      approval: approval as Record<string, unknown>,
      swapTx: null,
      orderRequest: null,
    }
  }

  if (isUniswapXRouting(quote.routing)) {
    const orderQuote = pickOrderQuote(quote)
    if (!orderQuote) throw new Error('Quote does not contain executable UniswapX order payload')
    const permitPayload = await signPermitIfRequired({ quote })
    if (!permitPayload.signature) {
      throw new Error('UniswapX order requires a Permit2 signature. Please refresh and try again.')
    }
    return {
      quote: normalizedQuote,
      approval: approval as Record<string, unknown>,
      swapTx: null,
      orderRequest: {
        quote: orderQuote,
        signature: permitPayload.signature,
        routing: quote.routing as string | undefined,
      },
    }
  }

  const selectedQuote = pickSwapQuote(quote)
  if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
  const permitPayload = await signPermitIfRequired({ quote })
  const requiresApprovalTx = hasApprovalTransaction(approval)
  const buildParams: BuildSwapParams = {
    quote: selectedQuote,
    ...permitPayload,
    includeGasInfo: false,
    refreshGasPrice: true,
    simulateTransaction: !requiresApprovalTx,
    deadline: deadlineSeconds,
  }
  const built = await buildSwap(buildParams)
  assertValidSwapTransaction(built.swap)

  return {
    quote: normalizedQuote,
    approval: approval as Record<string, unknown>,
    swapTx: built.swap,
    orderRequest: null,
  }
}

export async function submitUniswapOrder(orderRequest: {
  quote: Record<string, unknown>
  signature: string
  routing?: Routing
}) {
  return await createOrder({
    quote: orderRequest.quote,
    signature: orderRequest.signature,
    routing: orderRequest.routing,
  })
}

export function getUniswapPermitPayload(quote: TradeQuoteResponse): Record<string, unknown> | null {
  return pickPermitData(quote)
}

export function getUniswapPermitSignPayload(permitData: Record<string, unknown>) {
  return toPermitSignPayload(permitData)
}

export function normalizeUniswapExecutionTx(
  tx: Record<string, unknown>,
  signerAddress: string | null,
  chainId: number,
): TransactionRequest {
  return normalizeToTransactionRequest(tx, signerAddress, chainId)
}
