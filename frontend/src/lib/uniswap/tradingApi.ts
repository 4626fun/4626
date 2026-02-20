type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; details?: unknown }

export type TradeQuoteRequest = {
  tokenIn: string
  tokenOut: string
  tokenInChainId: number
  tokenOutChainId: number
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  amount: string
  swapper: string
  slippageTolerance?: number
  autoSlippage?: 'DEFAULT'
  permitAmount?: 'FULL' | 'EXACT'
  urgency?: 'urgent' | 'normal'
  xChainedActionsEnabled?: boolean
}

export type TradeQuoteResponse = Record<string, unknown> & {
  requestId?: string
  routing?: string | number
  classicQuote?: Record<string, unknown>
  bridgeQuote?: Record<string, unknown>
  wrapUnwrapQuote?: Record<string, unknown>
  priorityQuote?: Record<string, unknown>
  chainedQuote?: Record<string, unknown>
  permitSingleData?: Record<string, unknown>
  permitTransferFromData?: Record<string, unknown>
}

export type TransactionRequest = {
  to: string
  from: string
  data: string
  value?: string
  chainId?: number
  gasLimit?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  gasPrice?: string
}

export type UserOpCall = { to: `0x${string}`; data?: `0x${string}`; value?: bigint }

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    const message = json?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return json.data as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    const message = json?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return json.data as T
}

async function patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    const message = json?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return json.data as T
}

export function pickSwapQuote(quote: TradeQuoteResponse): Record<string, unknown> | null {
  return (
    quote.classicQuote ??
    quote.wrapUnwrapQuote ??
    quote.bridgeQuote ??
    quote.priorityQuote ??
    null
  )
}

export async function fetchTradeQuote(body: TradeQuoteRequest): Promise<TradeQuoteResponse> {
  return post<TradeQuoteResponse>('/api/uniswap/quote', body)
}

export async function checkTradeApproval(body: {
  walletAddress: string
  token: string
  amount: string
  chainId: number
  tokenOut?: string
  tokenOutChainId?: number
  includeGasInfo?: boolean
  urgency?: 'urgent' | 'normal'
}): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>('/api/uniswap/checkApproval', body)
}

export async function buildSwap(body: {
  quote: Record<string, unknown>
  signature?: string
  permitData?: Record<string, unknown>
  deadline?: number
  urgency?: 'urgent' | 'normal'
  refreshGasPrice?: boolean
  simulateTransaction?: boolean
  safetyMode?: 'RELAXED' | 'SAFE'
}): Promise<{ requestId?: string; swap: TransactionRequest; gasFee?: string }> {
  return post<{ requestId?: string; swap: TransactionRequest; gasFee?: string }>('/api/uniswap/swap', body)
}

export function assertValidSwapTransaction(tx: TransactionRequest): void {
  if (!tx.to || !tx.data || tx.data === '0x') {
    throw new Error('Invalid swap transaction: missing to/data')
  }
  if (!/^0x[0-9a-fA-F]+$/.test(tx.data)) {
    throw new Error('Invalid swap transaction: data is not valid hex')
  }
}

export async function buildSwap5792(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>('/api/uniswap/swap5792', body)
}

export function toUserOpCallsFrom5792(batch: Record<string, unknown>): UserOpCall[] {
  const calls = Array.isArray(batch.calls) ? batch.calls : []
  return calls
    .map((c) => c as Record<string, unknown>)
    .filter((c) => typeof c.to === 'string')
    .map((c) => ({
      to: c.to as `0x${string}`,
      data: typeof c.data === 'string' ? (c.data as `0x${string}`) : '0x',
      value: typeof c.value === 'string' && c.value.trim() ? BigInt(c.value) : 0n,
    }))
}

export async function buildSwap7702(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>('/api/uniswap/swap7702', body)
}

export async function createCrossChainPlan(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>('/api/uniswap/plan', body)
}

export async function getCrossChainPlan(planId: string): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(`/api/uniswap/plan?planId=${encodeURIComponent(planId)}`)
}

export async function updateCrossChainPlan(planId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return patch<Record<string, unknown>>('/api/uniswap/plan', { planId, ...body })
}
