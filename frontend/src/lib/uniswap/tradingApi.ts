import { normalizeUniswapError } from './error'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; details?: unknown }

const DEFAULT_RETRIES = 1
const RETRY_BASE_DELAY_MS = 500
const RETRYABLE_STATUS = new Set([503, 502, 429])
const QUOTE_CACHE_TTL_MS = 8_000
const quoteCache = new Map<string, { at: number; data: TradeQuoteResponse }>()
const quoteInFlight = new Map<string, Promise<TradeQuoteResponse>>()

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
  protocols?: string[]
  routingPreference?: string
  spreadOptimization?: string
  generatePermitAsTransaction?: boolean
  walletModeKey?: 'canonical' | 'eoa'
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
  permitData?: Record<string, unknown>
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
export type PermitSignPayload = {
  domain: Record<string, unknown>
  types: Record<string, unknown>
  primaryType: string
  message: Record<string, unknown>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeAmountString(amount: string): string {
  const raw = String(amount ?? '').trim()
  if (!/^\d+$/.test(raw)) {
    throw new Error('Invalid amount: must be a positive integer in smallest units.')
  }
  if (BigInt(raw) <= 0n) {
    throw new Error('Invalid amount: must be greater than zero.')
  }
  return raw
}

function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status)
}

async function post<T>(path: string, body: Record<string, unknown>, retries = DEFAULT_RETRIES): Promise<T> {
  let attempt = 0
  while (true) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
    if (res.ok && json?.success) return json.data as T

    const message = json?.error || `Request failed (${res.status})`
    const normalized = normalizeUniswapError(message)
    if (attempt < retries && isRetryableHttpStatus(res.status)) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
      attempt += 1
      continue
    }
    throw new Error(normalized.message)
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !json?.success) {
    const message = json?.error || `Request failed (${res.status})`
    throw new Error(normalizeUniswapError(message).message)
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
    throw new Error(normalizeUniswapError(message).message)
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

export function pickPermitData(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null
  const candidates = [
    quote.permitData,
    quote.permitSingleData,
    quote.permitTransferFromData,
  ]
  for (const item of candidates) {
    if (item && typeof item === 'object' && !Array.isArray(item)) return item
  }
  return null
}

export function toPermitSignPayload(permitData: Record<string, unknown>): PermitSignPayload | null {
  const domain = permitData.domain
  const typesRaw = permitData.types
  const messageRaw = permitData.values ?? permitData.message
  const explicitPrimaryType = typeof permitData.primaryType === 'string' ? permitData.primaryType.trim() : ''

  if (!domain || typeof domain !== 'object' || Array.isArray(domain)) return null
  if (!typesRaw || typeof typesRaw !== 'object' || Array.isArray(typesRaw)) return null
  if (!messageRaw || typeof messageRaw !== 'object' || Array.isArray(messageRaw)) return null

  const typesEntries = Object.entries(typesRaw as Record<string, unknown>).filter(
    ([key]) => key !== 'EIP712Domain',
  )
  const types = Object.fromEntries(typesEntries)
  const primaryType = explicitPrimaryType || typesEntries[0]?.[0] || ''
  if (!primaryType || !types[primaryType]) return null

  return {
    domain: domain as Record<string, unknown>,
    types,
    primaryType,
    message: messageRaw as Record<string, unknown>,
  }
}

export async function fetchTradeQuote(body: TradeQuoteRequest): Promise<TradeQuoteResponse> {
  const normalizedAmount = normalizeAmountString(body.amount)
  const normalizedBody = normalizedAmount === body.amount ? body : { ...body, amount: normalizedAmount }
  const key = JSON.stringify(normalizedBody)
  const cached = quoteCache.get(key)
  if (cached && Date.now() - cached.at < QUOTE_CACHE_TTL_MS) return cached.data

  const pending = quoteInFlight.get(key)
  if (pending) return pending

  const { walletModeKey: _wm, ...upstreamBody } = normalizedBody
  const request = post<TradeQuoteResponse>('/api/uniswap/quote', upstreamBody)
    .then((data) => {
      quoteCache.set(key, { at: Date.now(), data })
      quoteInFlight.delete(key)
      return data
    })
    .catch((error) => {
      quoteInFlight.delete(key)
      throw error
    })

  quoteInFlight.set(key, request)
  return request
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
  return post<Record<string, unknown>>('/api/uniswap/checkApproval', {
    ...body,
    amount: normalizeAmountString(body.amount),
    urgency: body.urgency ?? 'normal',
  })
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
  const hasSignature = typeof body.signature === 'string' && body.signature.trim().length > 0
  const hasPermitData = typeof body.permitData === 'object' && body.permitData !== null
  if (hasSignature !== hasPermitData) {
    throw new Error('Permit2 signature and permitData must be provided together.')
  }

  const response = await post<{ requestId?: string; swap: TransactionRequest; gasFee?: string }>(
    '/api/uniswap/swap',
    body,
  )
  assertValidSwapTransaction(response.swap)
  return response
}

export function assertValidSwapTransaction(tx: TransactionRequest): void {
  if (!tx.to || !/^0x[a-fA-F0-9]{40}$/.test(tx.to)) {
    throw new Error('Invalid swap transaction: missing or invalid recipient address')
  }
  if (!tx.from || !/^0x[a-fA-F0-9]{40}$/.test(tx.from)) {
    throw new Error('Invalid swap transaction: missing or invalid sender address')
  }
  if (!tx.data || tx.data === '0x') {
    throw new Error('Invalid swap transaction: missing call data')
  }
  if (!/^0x[0-9a-fA-F]+$/.test(tx.data)) {
    throw new Error('Invalid swap transaction: data is not valid hex')
  }
  if (tx.maxFeePerGas && tx.gasPrice) {
    throw new Error('Invalid swap transaction: cannot set both maxFeePerGas and gasPrice')
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
