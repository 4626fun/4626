import type { TransactionRequest } from '@/lib/uniswap/tradingApi'

export type SwapReviewRequest = {
  tokenIn: string
  tokenOut: string
  chainId: number
  amount: string
  swapper: string
  slippageTolerance: number
  executionMode: 'canonical' | 'eoa'
  xChainedActionsEnabled?: boolean
}

export type SwapNormalizedIssue = {
  balance?: unknown
  allowance?: unknown
}

export type SwapNormalizedFee = {
  amount?: string
  token?: string
}

export type SwapNormalizedFees = {
  protocolFee?: SwapNormalizedFee
}

export type SwapNormalizedQuote = {
  provider: 'uniswap' | 'cdp'
  routing: string
  liquidityAvailable: boolean
  toAmount?: string
  minToAmount?: string
  totalNetworkFee?: string
  fees?: SwapNormalizedFees
  issues?: SwapNormalizedIssue
  raw: Record<string, unknown>
  supportsOrderExecution: boolean
}

export type SwapReviewResult = {
  quote: SwapNormalizedQuote
  approval: Record<string, unknown> | null
  swapTx: TransactionRequest | null
  orderRequest: { quote: Record<string, unknown>; signature: string; routing?: string } | null
}
