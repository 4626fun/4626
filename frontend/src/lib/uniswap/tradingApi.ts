import { normalizeUniswapError } from './error'
import type { components } from './generated/tradeApi'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; details?: unknown }

const DEFAULT_RETRIES = 1
const RETRY_BASE_DELAY_MS = 500
const RETRYABLE_STATUS = new Set([503, 502, 429])
const QUOTE_CACHE_TTL_MS = 8_000
const quoteCache = new Map<string, { at: number; data: TradeQuoteResponse }>()
const quoteInFlight = new Map<string, Promise<TradeQuoteResponse>>()

export type Routing = components['schemas']['Routing']
export type QuoteRequest = components['schemas']['QuoteRequest']
export type QuoteResponse = components['schemas']['QuoteResponse']
export type ApprovalRequest = components['schemas']['ApprovalRequest']
export type ApprovalResponse = components['schemas']['ApprovalResponse']
export type TransactionRequest = components['schemas']['TransactionRequest']
export type CreateSwapRequest = components['schemas']['CreateSwapRequest']
export type CreateSwapResponse = components['schemas']['CreateSwapResponse']
export type OrderRequest = components['schemas']['OrderRequest']
export type OrderResponse = components['schemas']['OrderResponse']
export type WalletCheckDelegationRequestBody = components['schemas']['WalletCheckDelegationRequestBody']
export type WalletCheckDelegationResponseBody = components['schemas']['WalletCheckDelegationResponseBody']

export type TradeQuoteRequest = QuoteRequest & {
  // Local-only: used for caching + execution-mode attribution. Stripped before forwarding upstream.
  walletModeKey?: 'canonical' | 'eoa'
  // Local-only: forwarded to our Vercel handler, which decides whether to set `x-chained-actions-enabled`.
  xChainedActionsEnabled?: boolean
  chainedActionsEnabled?: boolean
}

export type TradeQuoteResponse = QuoteResponse & Record<string, unknown>

// OpenAPI currently types approval/cancel as always-present transactions, but the
// endpoint can return `null` when no approval/cancel is required.
export type TradeApprovalResponse = Omit<ApprovalResponse, 'approval' | 'cancel'> & {
  approval: TransactionRequest | null
  cancel: TransactionRequest | null
} & Record<string, unknown>

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

export type ProtocolSwapRouting = Extract<Routing, 'CLASSIC' | 'WRAP' | 'UNWRAP' | 'BRIDGE'>
export type UniswapXRouting = Extract<Routing, 'DUTCH_LIMIT' | 'DUTCH_V2' | 'DUTCH_V3' | 'LIMIT_ORDER' | 'PRIORITY'>

export function isProtocolSwapRouting(routing: unknown): routing is ProtocolSwapRouting {
  const r = typeof routing === 'string' ? routing : String(routing ?? '')
  return r === 'CLASSIC' || r === 'WRAP' || r === 'UNWRAP' || r === 'BRIDGE'
}

export function isUniswapXRouting(routing: unknown): routing is UniswapXRouting {
  const r = typeof routing === 'string' ? routing : String(routing ?? '')
  return r === 'DUTCH_LIMIT' || r === 'DUTCH_V2' || r === 'DUTCH_V3' || r === 'LIMIT_ORDER' || r === 'PRIORITY'
}

export function pickQuote(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null

  // OpenAPI: `quote` is the canonical oneOf payload. Keep fallbacks for any
  // legacy/experimental response shapes we may have cached.
  const candidate =
    (quote as any).quote ??
    (quote as any).classicQuote ??
    (quote as any).wrapUnwrapQuote ??
    (quote as any).bridgeQuote ??
    (quote as any).priorityQuote ??
    (quote as any).chainedQuote ??
    null

  return isPlainObject(candidate) ? candidate : null
}

// Protocol swaps: POST /swap expects ClassicQuote | WrapUnwrapQuote | BridgeQuote.
export function pickSwapQuote(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null
  if (!isProtocolSwapRouting(quote.routing)) return null
  return pickQuote(quote)
}

// UniswapX gasless orders: POST /order expects DutchQuoteV2 | DutchQuoteV3 | PriorityQuote.
export function pickOrderQuote(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null
  if (!isUniswapXRouting(quote.routing)) return null
  return pickQuote(quote)
}

export function pickPermitData(quote: TradeQuoteResponse | null | undefined): Record<string, unknown> | null {
  if (!quote) return null

  const candidates: unknown[] = [
    (quote as any).permitData, // OpenAPI: NullablePermit | null
    (quote as any).permitSingleData, // legacy
    (quote as any).permitTransferFromData, // legacy
    (quote as any).quote?.permitData, // extremely defensive: nested shapes
  ]

  for (const item of candidates) {
    if (isPlainObject(item)) return item
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

export async function checkTradeApproval(body: ApprovalRequest): Promise<TradeApprovalResponse> {
  const rawAmount = typeof (body as any).amount === 'string' ? ((body as any).amount as string) : ''
  return post<TradeApprovalResponse>('/api/uniswap/checkApproval', {
    ...(body as Record<string, unknown>),
    amount: normalizeAmountString(rawAmount),
    urgency: (body as any).urgency ?? 'normal',
  })
}

export type BuildSwapParams = Omit<CreateSwapRequest, 'quote' | 'permitData'> & {
  quote: Record<string, unknown>
  permitData?: Record<string, unknown>
}

export async function buildSwap(body: BuildSwapParams): Promise<CreateSwapResponse> {
  const hasSignature = typeof body.signature === 'string' && body.signature.trim().length > 0
  const hasPermitData = typeof body.permitData === 'object' && body.permitData !== null
  if (hasSignature !== hasPermitData) {
    throw new Error('Permit2 signature and permitData must be provided together.')
  }

  const response = await post<CreateSwapResponse>('/api/uniswap/swap', body)
  assertValidSwapTransaction(response.swap)
  return response
}

export type CreateOrderParams = Omit<OrderRequest, 'quote'> & {
  quote: Record<string, unknown>
}

export async function createOrder(body: CreateOrderParams): Promise<OrderResponse> {
  // /order has side-effects (submits to filler network). Caller should ensure
  // the user has confirmed before invoking.
  return post<OrderResponse>('/api/uniswap/order', body)
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

export async function fetchDelegationStatus(
  body: WalletCheckDelegationRequestBody,
): Promise<WalletCheckDelegationResponseBody & Record<string, unknown>> {
  return post<WalletCheckDelegationResponseBody & Record<string, unknown>>('/api/uniswap/checkDelegation', body as any)
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
