import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { readDeployAuthFromRequest } from '../../../../server/_lib/deployAuth.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../../server/_lib/rateLimit.js'
import { validateRoutePolicy, validateTokenPolicy } from '../../../../server/uniswap/guards.js'
import { isObject, toCleanErrorMessage, uniswapTradeFetch } from '../../../../server/uniswap/trading.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; details?: unknown }
type BootstrapProvider = 'uniswap' | '0x' | 'defillama'

type BootstrapSwapRequest = {
  smartWallet: Address
  ownerAddress: Address
  creatorToken: Address
  creatorAmountBaseUnits: string
  bootstrapBps?: number
  slippageBps?: number
  provider?: BootstrapProvider
  allowFallback?: boolean
}

const BASE_CHAIN_ID = 8453
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const PROVIDERS: readonly BootstrapProvider[] = ['uniswap', '0x', 'defillama'] as const
const DEFAULT_PROVIDER: BootstrapProvider = 'uniswap'
const DEFAULT_BOOTSTRAP_BPS = 100
const MAX_BOOTSTRAP_BPS = 2_000
const DEFAULT_SLIPPAGE_BPS = 100
const MAX_SLIPPAGE_BPS = 2_000
const REQUEST_TIMEOUT_MS = 15_000

type ProviderContext = {
  smartWallet: Address
  creatorToken: Address
  bootstrapCreatorAmount: bigint
  slippageBps: number
}

type ProviderExecution = {
  provider: BootstrapProvider
  status: number
  quoteRequest: Record<string, unknown>
  quote: Record<string, unknown> | null
  swapRequest: Record<string, unknown> | null
  swap: Record<string, unknown> | null
  swapError: string | null
}

function parseProvider(raw: unknown): BootstrapProvider | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === '0x') return '0x'
  if (value === 'uniswap' || value === 'defillama') return value
  return null
}

function readDefaultProvider(): BootstrapProvider {
  return parseProvider(process.env.DEPLOY_BOOTSTRAP_SWAP_DEFAULT_PROVIDER) ?? DEFAULT_PROVIDER
}

function readAllowedProviders(): Set<BootstrapProvider> {
  const raw = String(process.env.DEPLOY_BOOTSTRAP_ALLOWED_PROVIDERS ?? '').trim()
  if (!raw) return new Set(PROVIDERS)
  const set = new Set<BootstrapProvider>()
  for (const piece of raw.split(/[\s,]+/g)) {
    const parsed = parseProvider(piece)
    if (parsed) set.add(parsed)
  }
  if (set.size === 0) return new Set(PROVIDERS)
  return set
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw !== 'string') return fallback
  const value = raw.trim().toLowerCase()
  if (value === 'true' || value === '1' || value === 'yes') return true
  if (value === 'false' || value === '0' || value === 'no') return false
  return fallback
}

function parsePositiveIntString(raw: unknown): bigint | null {
  const value = String(raw ?? '').trim()
  if (!/^\d+$/.test(value)) return null
  try {
    const parsed = BigInt(value)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function parseBps(raw: unknown, fallback: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value)) return null
  return value
}

function buildProviderOrder(provider: BootstrapProvider, allowFallback: boolean): BootstrapProvider[] {
  if (!allowFallback) return [provider]
  if (provider === 'uniswap') return ['uniswap', '0x', 'defillama']
  if (provider === '0x') return ['0x', 'uniswap', 'defillama']
  return ['defillama', '0x', 'uniswap']
}

function parseJsonText(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 1_000) }
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; payload: unknown }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const raw = await response.text()
    return { status: response.status, payload: parseJsonText(raw) }
  } catch (error: any) {
    const aborted = String(error?.name ?? '').toLowerCase() === 'aborterror'
    return {
      status: aborted ? 504 : 502,
      payload: { error: aborted ? 'upstream_timeout' : toCleanErrorMessage(error?.message, 'upstream_unreachable') },
    }
  } finally {
    clearTimeout(timeout)
  }
}

function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) && value !== '0x'
}

function extractSwapTransaction(payload: unknown, fallbackFrom: Address): Record<string, unknown> | null {
  if (!isObject(payload)) return null

  let candidate: Record<string, unknown> | null = null
  const nestedKeys: Array<keyof typeof payload> = ['transaction', 'tx', 'swap']
  for (const key of nestedKeys) {
    const value = payload[key]
    if (isObject(value)) {
      candidate = value as Record<string, unknown>
      break
    }
  }
  if (!candidate && isObject(payload.route)) {
    const routeObj = payload.route as Record<string, unknown>
    if (isObject(routeObj.tx)) candidate = routeObj.tx as Record<string, unknown>
    else if (isObject(routeObj.transaction)) candidate = routeObj.transaction as Record<string, unknown>
  }
  if (!candidate && typeof payload.to === 'string' && payload.to.trim() && payload.data != null) {
    candidate = payload as Record<string, unknown>
  }
  if (!candidate) return null

  const toRaw = String(candidate.to ?? '').trim()
  const dataRaw = candidate.data
  if (!isAddress(toRaw) || !isHexData(dataRaw)) return null

  const fromRaw = String(candidate.from ?? '').trim()
  const from = isAddress(fromRaw) ? getAddress(fromRaw) : fallbackFrom
  const value = candidate.value == null ? '0' : String(candidate.value)

  return {
    ...candidate,
    to: getAddress(toRaw),
    from,
    data: dataRaw,
    value,
  }
}

function normalizeProviderError(payload: unknown, fallback: string): string {
  if (isObject(payload) && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim()
  }
  return toCleanErrorMessage(payload, fallback)
}

function readZeroXApiBase(): string {
  const raw = String(process.env.ZEROX_API_BASE ?? '').trim()
  return raw ? raw.replace(/\/+$/, '') : 'https://api.0x.org'
}

function readDefiLlamaApiBase(): string {
  const raw = String(process.env.DEFILLAMA_SWAP_API_BASE ?? '').trim()
  return raw ? raw.replace(/\/+$/, '') : 'https://api.llama.fi'
}

async function executeViaUniswap(ctx: ProviderContext): Promise<ProviderExecution> {
  const quoteRequest = {
    tokenIn: ctx.creatorToken,
    tokenOut: BASE_USDC,
    tokenInChainId: BASE_CHAIN_ID,
    tokenOutChainId: BASE_CHAIN_ID,
    type: 'EXACT_INPUT',
    amount: ctx.bootstrapCreatorAmount.toString(),
    swapper: ctx.smartWallet,
  } as const

  const quoteUpstream = await uniswapTradeFetch({
    path: '/quote',
    method: 'POST',
    body: quoteRequest as unknown as Record<string, unknown>,
  })
  if (quoteUpstream.status >= 400 || !isObject(quoteUpstream.payload)) {
    return {
      provider: 'uniswap',
      status: quoteUpstream.status,
      quoteRequest,
      quote: null,
      swapRequest: null,
      swap: null,
      swapError: normalizeProviderError(quoteUpstream.payload, 'Failed to fetch bootstrap quote'),
    }
  }

  const routingErr = validateRoutePolicy((quoteUpstream.payload as Record<string, unknown>).routing)
  if (routingErr) {
    return {
      provider: 'uniswap',
      status: 422,
      quoteRequest,
      quote: quoteUpstream.payload as Record<string, unknown>,
      swapRequest: null,
      swap: null,
      swapError: routingErr,
    }
  }

  const quotePayload = quoteUpstream.payload as Record<string, unknown>
  const swapRequest = {
    quote: (quotePayload.quote ?? quotePayload) as Record<string, unknown>,
    includeGasInfo: true,
    refreshGasPrice: true,
    simulateTransaction: false,
  }

  const swapUpstream = await uniswapTradeFetch({
    path: '/swap',
    method: 'POST',
    body: swapRequest as unknown as Record<string, unknown>,
  })
  const swapPayload = swapUpstream.status < 400 ? swapUpstream.payload : null
  const swap = extractSwapTransaction(swapPayload, ctx.smartWallet)
  const swapError =
    swap !== null ? null : normalizeProviderError(swapUpstream.payload, 'Failed to build bootstrap swap transaction')

  return {
    provider: 'uniswap',
    status: swap !== null ? 200 : swapUpstream.status,
    quoteRequest,
    quote: quotePayload,
    swapRequest,
    swap,
    swapError,
  }
}

async function executeViaZeroX(ctx: ProviderContext): Promise<ProviderExecution> {
  const quoteRequest = {
    chainId: BASE_CHAIN_ID,
    sellToken: ctx.creatorToken,
    buyToken: BASE_USDC,
    sellAmount: ctx.bootstrapCreatorAmount.toString(),
    taker: ctx.smartWallet,
    slippageBps: ctx.slippageBps,
  }

  const headers: Record<string, string> = { Accept: 'application/json', '0x-version': 'v2' }
  const apiKey = String(process.env.ZEROX_API_KEY ?? '').trim()
  if (apiKey) headers['0x-api-key'] = apiKey

  const base = readZeroXApiBase()
  const v2Url = new URL(`${base}/swap/allowance-holder/quote`)
  for (const [key, value] of Object.entries(quoteRequest)) {
    v2Url.searchParams.set(key, String(value))
  }

  let upstream = await fetchJson(v2Url.toString(), { method: 'GET', headers })
  if (upstream.status >= 400) {
    const compatibilityV1QuoteParams = {
      sellToken: quoteRequest.sellToken,
      buyToken: quoteRequest.buyToken,
      sellAmount: quoteRequest.sellAmount,
      takerAddress: quoteRequest.taker,
      slippagePercentage: (ctx.slippageBps / 10_000).toFixed(4),
    }
    const v1Url = new URL(`${base}/swap/v1/quote`)
    for (const [key, value] of Object.entries(compatibilityV1QuoteParams)) {
      v1Url.searchParams.set(key, value)
    }
    upstream = await fetchJson(v1Url.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
  }

  const quote = isObject(upstream.payload) ? (upstream.payload as Record<string, unknown>) : null
  const swap = extractSwapTransaction(upstream.payload, ctx.smartWallet)
  const swapError =
    swap !== null ? null : normalizeProviderError(upstream.payload, 'Failed to fetch bootstrap quote from 0x')

  return {
    provider: '0x',
    status: swap !== null ? 200 : upstream.status,
    quoteRequest,
    quote,
    swapRequest: null,
    swap,
    swapError,
  }
}

async function executeViaDefiLlama(ctx: ProviderContext): Promise<ProviderExecution> {
  const quoteRequest = {
    chain: 'base',
    from: ctx.creatorToken,
    to: BASE_USDC,
    amount: ctx.bootstrapCreatorAmount.toString(),
    fromAddress: ctx.smartWallet,
    slippage: (ctx.slippageBps / 100).toString(),
  }

  const base = readDefiLlamaApiBase()
  const url = new URL(`${base}/swap/quote`)
  for (const [key, value] of Object.entries(quoteRequest)) {
    url.searchParams.set(key, value)
  }
  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = String(process.env.DEFILLAMA_API_KEY ?? '').trim()
  if (apiKey) headers['x-api-key'] = apiKey

  const upstream = await fetchJson(url.toString(), { method: 'GET', headers })
  const quote = isObject(upstream.payload) ? (upstream.payload as Record<string, unknown>) : null
  const swap = extractSwapTransaction(upstream.payload, ctx.smartWallet)
  const swapError =
    swap !== null ? null : normalizeProviderError(upstream.payload, 'Failed to fetch bootstrap quote from DefiLlama')

  return {
    provider: 'defillama',
    status: swap !== null ? 200 : upstream.status,
    quoteRequest,
    quote,
    swapRequest: null,
    swap,
    swapError,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const auth = readDeployAuthFromRequest(req)
  if (!auth?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('deploy-bootstrap-swap', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<BootstrapSwapRequest>(req)
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  }

  try {
    const smartWalletRaw = String(body.smartWallet ?? '').trim()
    const ownerAddressRaw = String(body.ownerAddress ?? '').trim()
    const creatorTokenRaw = String(body.creatorToken ?? '').trim()
    if (!isAddress(smartWalletRaw) || !isAddress(ownerAddressRaw) || !isAddress(creatorTokenRaw)) {
      return res.status(400).json({ success: false, error: 'Invalid addresses' } satisfies ApiEnvelope<null>)
    }

    const smartWallet = getAddress(smartWalletRaw)
    const ownerAddress = getAddress(ownerAddressRaw)
    const creatorToken = getAddress(creatorTokenRaw)
    if (ownerAddress.toLowerCase() !== smartWallet.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'ownerAddress must match smartWallet (canonical deploy sender)',
      } satisfies ApiEnvelope<null>)
    }

    const creatorAmount = parsePositiveIntString(body.creatorAmountBaseUnits)
    if (creatorAmount == null) {
      return res.status(400).json({
        success: false,
        error: 'creatorAmountBaseUnits must be a positive integer string',
      } satisfies ApiEnvelope<null>)
    }

    const bootstrapBpsRaw = body.bootstrapBps
    const bootstrapBps = Number.isInteger(bootstrapBpsRaw)
      ? Number(bootstrapBpsRaw)
      : DEFAULT_BOOTSTRAP_BPS
    if (bootstrapBps <= 0 || bootstrapBps > MAX_BOOTSTRAP_BPS) {
      return res.status(400).json({
        success: false,
        error: `bootstrapBps must be between 1 and ${MAX_BOOTSTRAP_BPS}`,
      } satisfies ApiEnvelope<null>)
    }
    const slippageBps = parseBps(body.slippageBps, DEFAULT_SLIPPAGE_BPS)
    if (slippageBps == null || slippageBps <= 0 || slippageBps > MAX_SLIPPAGE_BPS) {
      return res.status(400).json({
        success: false,
        error: `slippageBps must be between 1 and ${MAX_SLIPPAGE_BPS}`,
      } satisfies ApiEnvelope<null>)
    }

    const requestedProvider = parseProvider(body.provider) ?? readDefaultProvider()
    const allowFallback = parseBool(body.allowFallback, true)
    const allowedProviders = readAllowedProviders()
    if (!allowedProviders.has(requestedProvider)) {
      return res.status(400).json({
        success: false,
        error: `provider ${requestedProvider} is not allowed by policy`,
      } satisfies ApiEnvelope<null>)
    }

    const tokenPolicyErr = validateTokenPolicy({ tokenIn: creatorToken, tokenOut: BASE_USDC }, ['tokenIn', 'tokenOut'])
    if (tokenPolicyErr) {
      return res.status(400).json({ success: false, error: tokenPolicyErr } satisfies ApiEnvelope<null>)
    }

    const bootstrapCreatorAmount = (creatorAmount * BigInt(bootstrapBps)) / 10_000n
    if (bootstrapCreatorAmount <= 0n) {
      return res.status(400).json({
        success: false,
        error: 'bootstrap amount rounds to zero; increase creatorAmountBaseUnits or bootstrapBps',
      } satisfies ApiEnvelope<null>)
    }

    const providerOrder = buildProviderOrder(requestedProvider, allowFallback).filter((provider) =>
      allowedProviders.has(provider),
    )
    const ctx: ProviderContext = {
      smartWallet,
      creatorToken,
      bootstrapCreatorAmount,
      slippageBps,
    }
    const attempts: Array<{ provider: BootstrapProvider; status: number; ok: boolean; error: string | null }> = []
    let selected: ProviderExecution | null = null

    for (const provider of providerOrder) {
      const execution =
        provider === 'uniswap'
          ? await executeViaUniswap(ctx)
          : provider === '0x'
            ? await executeViaZeroX(ctx)
            : await executeViaDefiLlama(ctx)
      const ok = execution.swap !== null
      attempts.push({
        provider,
        status: execution.status,
        ok,
        error: execution.swapError,
      })
      if (ok) {
        selected = execution
        break
      }
    }

    if (!selected) {
      return res.status(502).json({
        success: false,
        error: attempts.find((a) => a.error)?.error ?? 'No bootstrap swap route available',
        details: {
          providerRequested: requestedProvider,
          providerOrder,
          attempts,
        },
      } satisfies ApiEnvelope<null>)
    }

    return res.status(200).json({
      success: true,
      data: {
        chainId: BASE_CHAIN_ID,
        providerRequested: requestedProvider,
        providerUsed: selected.provider,
        fallbackUsed: selected.provider !== requestedProvider,
        providerOrder,
        providerAttempts: attempts,
        smartWallet,
        ownerAddress,
        creatorToken,
        tokenOut: BASE_USDC,
        creatorAmountBaseUnits: creatorAmount.toString(),
        bootstrapBps,
        slippageBps,
        bootstrapCreatorAmountBaseUnits: bootstrapCreatorAmount.toString(),
        quoteRequest: selected.quoteRequest,
        quote: selected.quote,
        swapRequest: selected.swapRequest,
        swap: selected.swap,
        swapError: selected.swapError,
      },
    } satisfies ApiEnvelope<Record<string, unknown>>)
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e?.message ? String(e.message) : 'bootstrap_swap_failed',
    } satisfies ApiEnvelope<null>)
  }
}
