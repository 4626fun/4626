import { normalizeUniswapError } from './error'
import type { components } from './generated/tradeApi'
import { apiFetch } from '@/lib/api/apiBase'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { APP_ORIGIN, MARKETING_ORIGIN } from '@/lib/env/host'
import { buildCdpPriceRequest, executeCdpSwap, fetchCdpSwapPrice } from '@/lib/swap/cdpApi'
import {
  resolveSwapProviderSelection,
  shouldFallbackToUniswap,
  shouldFallbackToZoraTrade,
  type SwapProvider,
} from '@/lib/swap/providerConfig'
import {
  buildSwapFromZoraQuote,
  fetchZoraTradeQuoteFromApi,
  readZoraCallFromQuote,
  shouldUseZoraTradeRoute,
  zoraTradeQuoteToResponse,
} from '@/lib/zora/zoraTradeApi'
import {
  coerceSwapTransactionValue,
  normalizeSwapApiResponsePayload,
  sanitizeClassicQuoteForSwap,
  sanitizePermitDataForSwapApi,
} from '@/lib/uniswap/swapQuoteSanitize'

const DEFAULT_RETRIES = 2
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
  providerOverride?: 'uniswap' | 'cdp'
  /** When true and pair is on Base, quote via Zora coins SDK (creator-coin pools). */
  useZoraTradeRoute?: boolean
}

export type TradeQuoteResponse = QuoteResponse & Record<string, unknown>

type CdpExecuteParams = {
  network: string
  fromToken: string
  toToken: string
  fromAmount: string
  taker?: string
  slippageBps?: number
  account?: string
}

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

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(5_000, seconds * 1_000)
  const dateMs = Date.parse(trimmed)
  if (!Number.isFinite(dateMs)) return null
  return Math.min(5_000, Math.max(0, dateMs - Date.now()))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripPermit2Fields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPermit2Fields)
  if (!isPlainObject(value)) return value

  const next: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (
      key === 'permitData' ||
      key === 'permitSingleData' ||
      key === 'permitTransferFromData' ||
      key === 'signature'
    ) {
      continue
    }
    next[key] = stripPermit2Fields(item)
  }
  return next
}

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string): boolean {
  const localHosts = ['localhost', '127.0.0.1']
  try {
    const { hostname } = new URL(origin)
    return localHosts.includes(hostname)
  } catch {
    return false
  }
}

function getUniswapApiBases(path: string): string[] | undefined {
  if (typeof window === 'undefined') return undefined
  if (!path.startsWith('/api/uniswap/')) return undefined

  const currentOrigin = normalizeOrigin(window.location.origin)
  if (!currentOrigin || isLocalOrigin(currentOrigin)) return undefined

  const bases = new Set<string>()
  for (const candidate of [currentOrigin, APP_ORIGIN, MARKETING_ORIGIN]) {
    const origin = normalizeOrigin(candidate)
    if (!origin) continue
    bases.add(origin)
  }
  return bases.size > 0 ? [...bases] : undefined
}

async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  // Keep node test runners stable: tests mock `global.fetch` with lightweight
  // objects that do not implement full Response headers.
  if (typeof window === 'undefined') {
    return fetch(path, init)
  }
  return apiFetch(path, init, getUniswapApiBases(path))
}

async function post<T>(path: string, body: Record<string, unknown>, retries = DEFAULT_RETRIES): Promise<T> {
  let attempt = 0
  while (true) {
    const res = await requestApi(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await parseApiEnvelope<T>(res)
    if (res.ok && json?.success) return json.data as T

    const message = resolveApiErrorMessage(json, `Request failed (${res.status})`)
    const normalized = normalizeUniswapError(message)
    if (attempt < retries && isRetryableHttpStatus(res.status)) {
      const retryAfterMs = parseRetryAfterMs(typeof res.headers?.get === 'function' ? res.headers.get('Retry-After') : null)
      await sleep(retryAfterMs ?? RETRY_BASE_DELAY_MS * 2 ** attempt)
      attempt += 1
      continue
    }
    throw new Error(normalized.message)
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await requestApi(path)
  const json = await parseApiEnvelope<T>(res)
  if (!res.ok || !json?.success) {
    const message = resolveApiErrorMessage(json, `Request failed (${res.status})`)
    throw new Error(normalizeUniswapError(message).message)
  }
  return json.data as T
}

async function patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await requestApi(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseApiEnvelope<T>(res)
  if (!res.ok || !json?.success) {
    const message = resolveApiErrorMessage(json, `Request failed (${res.status})`)
    throw new Error(normalizeUniswapError(message).message)
  }
  return json.data as T
}

function attachProviderMetadata(
  quote: TradeQuoteResponse,
  provider: SwapProvider,
  options?: { fallbackUsed?: boolean; preferredProvider?: SwapProvider },
): TradeQuoteResponse {
  return {
    ...quote,
    provider,
    fallbackUsed: Boolean(options?.fallbackUsed),
    preferredProvider: options?.preferredProvider ?? provider,
    quote: isPlainObject((quote as any).quote)
      ? {
          ...(quote as any).quote,
          _provider: provider,
          _fallbackUsed: Boolean(options?.fallbackUsed),
          _preferredProvider: options?.preferredProvider ?? provider,
        }
      : (quote as any).quote,
  } as TradeQuoteResponse
}

function buildCdpExecuteParamsFromQuote(body: BuildSwapParams): CdpExecuteParams | null {
  const quote = isPlainObject(body.quote) ? body.quote : null
  if (!quote) return null
  const provider = typeof quote._provider === 'string' ? quote._provider.trim().toLowerCase() : ''
  if (provider !== 'cdp') return null
  const params = isPlainObject(quote._cdpParams) ? quote._cdpParams : null
  if (!params) return null
  const network = typeof params.network === 'string' ? params.network.trim() : ''
  const fromToken = typeof params.fromToken === 'string' ? params.fromToken.trim() : ''
  const toToken = typeof params.toToken === 'string' ? params.toToken.trim() : ''
  const fromAmount = typeof params.fromAmount === 'string' ? params.fromAmount.trim() : ''
  if (!network || !fromToken || !toToken || !fromAmount) return null
  return {
    network,
    fromToken,
    toToken,
    fromAmount,
    taker: typeof params.taker === 'string' && params.taker.trim() ? params.taker.trim() : undefined,
    account: typeof params.account === 'string' && params.account.trim() ? params.account.trim() : undefined,
    slippageBps: Number.isFinite(Number(params.slippageBps)) ? Number(params.slippageBps) : undefined,
  }
}

function extractCdpSwapTransaction(payload: Record<string, unknown>): TransactionRequest | null {
  const transaction =
    (isPlainObject(payload.transaction) && payload.transaction) ||
    (isPlainObject(payload.swap) && isPlainObject((payload.swap as Record<string, unknown>).transaction)
      ? ((payload.swap as Record<string, unknown>).transaction as Record<string, unknown>)
      : null) ||
    (isPlainObject(payload.quote) && isPlainObject((payload.quote as Record<string, unknown>).transaction)
      ? ((payload.quote as Record<string, unknown>).transaction as Record<string, unknown>)
      : null)
  if (!transaction) return null
  const to = typeof transaction.to === 'string' ? transaction.to : ''
  const data = typeof transaction.data === 'string' ? transaction.data : ''
  const from = typeof transaction.from === 'string' ? transaction.from : ''
  if (!to || !data) return null
  return {
    to,
    from,
    data,
    value: coerceSwapTransactionValue(transaction.value),
    chainId: (Number.isFinite(Number(transaction.chainId)) && Number(transaction.chainId) > 0
      ? Number(transaction.chainId)
      : 8453) as TransactionRequest['chainId'],
    gasLimit: typeof transaction.gasLimit === 'string' ? transaction.gasLimit : undefined,
    maxFeePerGas: typeof transaction.maxFeePerGas === 'string' ? transaction.maxFeePerGas : undefined,
    maxPriorityFeePerGas:
      typeof transaction.maxPriorityFeePerGas === 'string' ? transaction.maxPriorityFeePerGas : undefined,
    gasPrice: typeof transaction.gasPrice === 'string' ? transaction.gasPrice : undefined,
  }
}

async function fetchTradeQuoteFromUniswap(body: TradeQuoteRequest): Promise<TradeQuoteResponse> {
  const { walletModeKey: _wm, providerOverride: _providerOverride, ...upstreamBody } = body
  return await post<TradeQuoteResponse>(API_ENDPOINTS.uniswap.quote, upstreamBody)
}

function isPrimaryQuoteWithoutRoute(quote: TradeQuoteResponse): boolean {
  const providerRaw =
    typeof (quote as { provider?: unknown }).provider === 'string'
      ? String((quote as { provider?: string }).provider).trim().toLowerCase()
      : ''
  if (providerRaw === 'zora') return false
  if ((quote as { liquidityAvailable?: boolean }).liquidityAvailable === false) return true

  const picked = pickQuote(quote)
  const outputAmount =
    (picked?.output as { amount?: unknown } | undefined)?.amount ??
    (quote as { toAmount?: unknown }).toAmount ??
    picked?.amountOut
  const normalizedOut = String(outputAmount ?? '').trim()
  return !normalizedOut || normalizedOut === '0'
}

async function fetchZoraTradeQuoteForRequest(
  body: TradeQuoteRequest,
  normalizedAmount: string,
): Promise<TradeQuoteResponse> {
  const swapper = String(body.swapper ?? '').trim()
  if (!swapper) throw new Error('Swapper address is required for Zora trade quotes')
  const zoraPayload = await fetchZoraTradeQuoteFromApi({
    tokenIn: body.tokenIn,
    tokenOut: body.tokenOut,
    amountIn: normalizedAmount,
    sender: swapper,
    slippagePct: Number(body.slippageTolerance ?? 0.5),
  })
  return zoraTradeQuoteToResponse({
    tokenIn: body.tokenIn,
    tokenOut: body.tokenOut,
    amountIn: normalizedAmount,
    payload: zoraPayload,
  })
}

async function fetchPrimaryProviderQuote(
  body: TradeQuoteRequest,
  effectivePrimary: SwapProvider,
  effectiveFallback: SwapProvider | null,
): Promise<TradeQuoteResponse> {
  if (effectivePrimary === 'uniswap') {
    const quote = await fetchTradeQuoteFromUniswap(body)
    return attachProviderMetadata(quote, 'uniswap')
  }
  try {
    const cdpQuote = await fetchTradeQuoteFromCdp(body)
    return attachProviderMetadata(cdpQuote, 'cdp')
  } catch (error) {
    if (effectiveFallback !== 'uniswap' || !shouldFallbackToUniswap(error)) {
      throw error
    }
    const fallbackQuote = await fetchTradeQuoteFromUniswap(body)
    return attachProviderMetadata(fallbackQuote, 'uniswap', {
      fallbackUsed: true,
      preferredProvider: 'cdp',
    })
  }
}

async function fetchTradeQuoteFromCdp(body: TradeQuoteRequest): Promise<TradeQuoteResponse> {
  const sameChain = Number(body.tokenInChainId) === Number(body.tokenOutChainId)
  if (!sameChain) {
    throw new Error('CDP swaps currently support same-network pairs only.')
  }
  const cdpRequest = buildCdpPriceRequest({
    chainId: Number(body.tokenInChainId),
    tokenIn: body.tokenIn,
    tokenOut: body.tokenOut,
    amount: String(body.amount),
    swapper: body.swapper,
    slippageTolerance: Number(body.slippageTolerance ?? 1),
  })
  const raw = await fetchCdpSwapPrice(cdpRequest)
  const liquidityAvailable =
    typeof raw.liquidityAvailable === 'boolean' ? raw.liquidityAvailable : Boolean(raw.toAmount)
  const quote = {
    requestId:
      typeof raw.requestId === 'string' && raw.requestId.trim().length > 0
        ? raw.requestId
        : `cdp-${Date.now()}`,
    routing: 'CLASSIC',
    quote: {
      input: {
        amount: cdpRequest.fromAmount,
        token: cdpRequest.fromToken,
      },
      output: {
        amount: typeof raw.toAmount === 'string' ? raw.toAmount : '',
        token: cdpRequest.toToken,
      },
      minToAmount: typeof raw.minToAmount === 'string' ? raw.minToAmount : undefined,
      totalNetworkFee: typeof raw.totalNetworkFee === 'string' ? raw.totalNetworkFee : undefined,
      fees: isPlainObject(raw.fees) ? raw.fees : undefined,
      issues: isPlainObject(raw.issues) ? raw.issues : undefined,
      _provider: 'cdp',
      _cdpParams: cdpRequest,
    },
    liquidityAvailable,
    toAmount: typeof raw.toAmount === 'string' ? raw.toAmount : undefined,
    minToAmount: typeof raw.minToAmount === 'string' ? raw.minToAmount : undefined,
    totalNetworkFee: typeof raw.totalNetworkFee === 'string' ? raw.totalNetworkFee : undefined,
    fees: isPlainObject(raw.fees) ? raw.fees : undefined,
    issues: isPlainObject(raw.issues) ? raw.issues : undefined,
    permitData: null,
  } as unknown as TradeQuoteResponse
  return quote
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
  // compatibility/experimental response shapes we may have cached.
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
    (quote as any).permitSingleData, // compatibility
    (quote as any).permitTransferFromData, // compatibility
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
  const providerSelection = resolveSwapProviderSelection()
  const forcedProvider =
    body.providerOverride === 'cdp' || body.providerOverride === 'uniswap' ? body.providerOverride : null
  const effectivePrimary = forcedProvider ?? providerSelection.primary
  const effectiveFallback =
    forcedProvider === 'uniswap' || forcedProvider === 'cdp' ? null : providerSelection.fallback
  const key = JSON.stringify({
    providerMode: forcedProvider ? `forced-${forcedProvider}` : providerSelection.mode,
    body: normalizedBody,
  })
  const cached = quoteCache.get(key)
  if (cached && Date.now() - cached.at < QUOTE_CACHE_TTL_MS) return cached.data

  const pending = quoteInFlight.get(key)
  if (pending) return pending

  const zoraEligible = shouldUseZoraTradeRoute(normalizedBody, Boolean(normalizedBody.useZoraTradeRoute))

  const request = (async () => {
    try {
      const quote = await fetchPrimaryProviderQuote(normalizedBody, effectivePrimary, effectiveFallback)
      if (zoraEligible && isPrimaryQuoteWithoutRoute(quote)) {
        throw new Error('No route for pair')
      }
      return quote
    } catch (error) {
      if (!zoraEligible || !shouldFallbackToZoraTrade(error)) {
        throw error
      }
      const preferredProvider =
        effectivePrimary === 'cdp' && effectiveFallback === 'uniswap' ? 'cdp' : effectivePrimary
      const zoraQuote = await fetchZoraTradeQuoteForRequest(normalizedBody, normalizedAmount)
      return {
        ...zoraQuote,
        fallbackUsed: true,
        preferredProvider,
      } as TradeQuoteResponse
    }
  })()
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

export async function checkTradeApproval(body: ApprovalRequest & { permit2Disabled?: boolean }): Promise<TradeApprovalResponse> {
  const providerSelection = resolveSwapProviderSelection()
  if (providerSelection.mode === 'cdp') {
    return { approval: null, cancel: null } as TradeApprovalResponse
  }
  const rawAmount = typeof (body as any).amount === 'string' ? ((body as any).amount as string) : ''
  return post<TradeApprovalResponse>(API_ENDPOINTS.uniswap.checkApproval, {
    ...(body as Record<string, unknown>),
    amount: normalizeAmountString(rawAmount),
    urgency: (body as any).urgency ?? 'normal',
  })
}

export type BuildSwapParams = Omit<CreateSwapRequest, 'quote' | 'permitData'> & {
  quote: Record<string, unknown>
  permitData?: Record<string, unknown>
  permit2Disabled?: boolean
}

export async function buildSwap(
  body: BuildSwapParams & { executionAddress?: string; chainId?: number },
): Promise<CreateSwapResponse> {
  const normalizedBody = body.permit2Disabled ? (stripPermit2Fields(body) as BuildSwapParams) : body
  const hasSignature = typeof normalizedBody.signature === 'string' && normalizedBody.signature.trim().length > 0
  const hasPermitData = typeof normalizedBody.permitData === 'object' && normalizedBody.permitData !== null
  if (hasSignature !== hasPermitData) {
    throw new Error('Permit2 signature and permitData must be provided together.')
  }

  const quoteRecord = normalizedBody.quote as Record<string, unknown>
  const isZoraClassicQuote =
    quoteRecord._provider === 'zora' ||
    (isPlainObject(quoteRecord._zoraCall) &&
      typeof (quoteRecord._zoraCall as Record<string, unknown>).target === 'string')
  if (isZoraClassicQuote) {
    const executionAddress = String(body.executionAddress ?? '').trim()
    const chainId = Number(body.chainId ?? 8453)
    if (!executionAddress) {
      throw new Error('Execution address is required to build a Zora swap transaction')
    }
    return buildSwapFromZoraQuote({
      quote: {
        routing: 'CLASSIC',
        provider: 'zora',
        zoraCall: quoteRecord._zoraCall ?? readZoraCallFromQuote({ quote: quoteRecord } as TradeQuoteResponse),
        quote: quoteRecord,
      } as unknown as TradeQuoteResponse,
      executionAddress,
      chainId,
    })
  }

  const cdpParams = buildCdpExecuteParamsFromQuote(normalizedBody)
  if (cdpParams) {
    const response = await executeCdpSwap(cdpParams)
    const tx = extractCdpSwapTransaction(response)
    if (!tx) {
      throw new Error('CDP swap response did not include executable transaction payload.')
    }
    assertValidSwapTransaction(tx)
    return { swap: tx } as CreateSwapResponse
  }

  const swapBody: Record<string, unknown> = {
    ...normalizedBody,
    quote: sanitizeClassicQuoteForSwap(normalizedBody.quote as Record<string, unknown>),
  }
  if (isPlainObject(swapBody.permitData)) {
    swapBody.permitData = sanitizePermitDataForSwapApi(swapBody.permitData)
  }
  const response = await post<CreateSwapResponse>(API_ENDPOINTS.uniswap.swap, swapBody)
  const normalized = normalizeSwapApiResponsePayload(response) as CreateSwapResponse
  assertValidSwapTransaction(normalized.swap)
  return normalized
}

export type CreateOrderParams = Omit<OrderRequest, 'quote'> & {
  quote: Record<string, unknown>
}

export async function createOrder(body: CreateOrderParams): Promise<OrderResponse> {
  // /order has side-effects (submits to filler network). Caller should ensure
  // the user has confirmed before invoking.
  return post<OrderResponse>(API_ENDPOINTS.uniswap.order, body)
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
  const raw = tx as TransactionRequest & { value?: unknown }
  raw.value = coerceSwapTransactionValue(raw.value) as TransactionRequest['value']
}

export async function buildSwap5792(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>(API_ENDPOINTS.uniswap.swap5792, body)
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
  return post<Record<string, unknown>>(API_ENDPOINTS.uniswap.swap7702, body)
}

export async function fetchDelegationStatus(
  body: WalletCheckDelegationRequestBody,
): Promise<WalletCheckDelegationResponseBody & Record<string, unknown>> {
  return post<WalletCheckDelegationResponseBody & Record<string, unknown>>(API_ENDPOINTS.uniswap.checkDelegation, body as any)
}

export async function createCrossChainPlan(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>(API_ENDPOINTS.uniswap.plan, body)
}

export async function getCrossChainPlan(planId: string): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>(`${API_ENDPOINTS.uniswap.plan}?planId=${encodeURIComponent(planId)}`)
}

export async function updateCrossChainPlan(planId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return patch<Record<string, unknown>>(API_ENDPOINTS.uniswap.plan, { planId, ...body })
}
