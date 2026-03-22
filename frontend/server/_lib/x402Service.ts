import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getPaywallHtml } from 'x402/paywall'
import { processPriceToAtomicAmount, safeBase64Decode, safeBase64Encode } from 'x402/shared'
import {
  PaymentPayloadSchema,
  settleResponseHeader,
  type Network,
  type PaymentRequirements,
  type SettleResponse,
  type VerifyResponse,
} from 'x402/types'
import { useFacilitator as createFacilitatorClient } from 'x402/verify'

import { getCanonicalOrigin } from './origin.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_NETWORK = 'base' as const
const DEFAULT_PRICE_USD = 1
const DEFAULT_MAX_TIMEOUT_SECONDS = 300
const DEFAULT_PAY_TO = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'
const X402_VERSION = 1
const PAYMENT_ALLOW_HEADERS = [
  'PAYMENT-SIGNATURE',
  'PAYMENT-REQUIRED',
  'PAYMENT-RESPONSE',
  'X-PAYMENT',
  'X-PAYMENT-REQUIRED',
  'X-PAYMENT-RESPONSE',
]
const PAYMENT_EXPOSE_HEADERS = [
  'PAYMENT-REQUIRED',
  'PAYMENT-RESPONSE',
  'X-PAYMENT-REQUIRED',
  'X-PAYMENT-RESPONSE',
]

type X402Network = Extract<Network, 'base' | 'base-sepolia'>

export type X402PaymentRequirementConfig = {
  req: VercelRequest
  resourcePath: string
  description: string
  mimeType?: string
  outputSchema?: Record<string, unknown>
  extra?: Record<string, unknown>
  priceUsd?: number | string
}

export type X402PaymentGateResult =
  | { status: 'missing'; paymentRequirements: PaymentRequirements; priceUsd: number; network: X402Network }
  | {
      status: 'invalid'
      paymentRequirements: PaymentRequirements
      priceUsd: number
      network: X402Network
      invalidReason: string
      verification?: VerifyResponse
      settlement?: SettleResponse
    }
  | {
      status: 'paid'
      paymentRequirements: PaymentRequirements
      priceUsd: number
      network: X402Network
      payer: string | null
      verification: VerifyResponse
      settlement: SettleResponse
    }

function addHeaderValues(res: VercelResponse, name: string, values: string[]) {
  const existing = res.getHeader(name)
  const parts = new Set<string>()
  const readParts = (value: string | string[] | number | undefined) => {
    if (typeof value === 'number') {
      parts.add(String(value))
      return
    }
    const raw = Array.isArray(value) ? value.join(',') : value
    for (const piece of String(raw || '').split(',')) {
      const trimmed = piece.trim()
      if (trimmed) parts.add(trimmed)
    }
  }
  readParts(existing as string | string[] | number | undefined)
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed) parts.add(trimmed)
  }
  res.setHeader(name, Array.from(parts).join(', '))
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeNetwork(raw: string | undefined): X402Network {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'base-sepolia') return 'base-sepolia'
  return DEFAULT_NETWORK
}

function normalizePrice(raw: number | string | undefined): number {
  const parsed = Number(raw ?? DEFAULT_PRICE_USD)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return DEFAULT_PRICE_USD
}

function resolvePayTo(): `0x${string}` {
  const candidates = [
    (process.env.ERC8004_REVIEW_PAY_TO ?? '').trim(),
    (process.env.X402_PAY_TO ?? '').trim(),
    (process.env.XMTP_AGENT_CSW_ADDRESS ?? '').trim(),
    (process.env.XMTP_AGENT_ADDRESS ?? '').trim(),
    (process.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim(),
    DEFAULT_PAY_TO,
  ]
  for (const candidate of candidates) {
    if (isAddressLike(candidate)) return candidate
  }
  return DEFAULT_PAY_TO
}

function resolveResourceUrl(req: VercelRequest, resourcePath: string): string {
  const raw = resourcePath.trim()
  if (/^https?:\/\//i.test(raw)) return raw
  const origin = (() => {
    try {
      return getCanonicalOrigin(req)
    } catch {
      return 'https://4626.fun'
    }
  })()
  if (!raw) return `${origin}/`
  return `${origin}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function getFacilitatorClient() {
  const rawUrl = String(process.env.X402_FACILITATOR_URL ?? '').trim()
  if (/^https?:\/\/.+/i.test(rawUrl)) {
    return createFacilitatorClient({ url: rawUrl as `${string}://${string}` })
  }
  return createFacilitatorClient()
}

function readPaymentHeader(req: VercelRequest): string | null {
  const candidates = [
    req.headers['payment-signature'],
    req.headers['x-payment'],
    req.headers['x-payment-signature'],
    req.headers['payment'],
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (Array.isArray(candidate) && candidate[0] && String(candidate[0]).trim()) return String(candidate[0]).trim()
  }
  return null
}

function parsePaymentHeader(rawHeader: string) {
  const attempts = [rawHeader]
  try {
    attempts.unshift(safeBase64Decode(rawHeader))
  } catch {
    // Ignore invalid base64 and fall back to direct JSON parsing.
  }

  for (const attempt of attempts) {
    try {
      return PaymentPayloadSchema.parse(JSON.parse(attempt))
    } catch {
      continue
    }
  }

  return null
}

function createPaymentEnvelope(paymentRequirements: PaymentRequirements, error?: string) {
  return {
    x402Version: X402_VERSION,
    ...(error ? { error } : {}),
    accepts: [paymentRequirements],
  }
}

function wantsHtmlPaywall(req: VercelRequest): boolean {
  const accept = String(req.headers.accept ?? '').toLowerCase()
  return accept.includes('text/html') && !accept.includes('application/json')
}

export function setX402CorsHeaders(res: VercelResponse) {
  addHeaderValues(res, 'Access-Control-Allow-Headers', PAYMENT_ALLOW_HEADERS)
  addHeaderValues(res, 'Access-Control-Expose-Headers', PAYMENT_EXPOSE_HEADERS)
}

export function buildX402PaymentRequirements(config: X402PaymentRequirementConfig): {
  paymentRequirements: PaymentRequirements
  priceUsd: number
  network: X402Network
} {
  const network = normalizeNetwork(process.env.X402_NETWORK)
  const priceUsd = normalizePrice(config.priceUsd ?? process.env.X402_PRICE_USD)
  const processed = processPriceToAtomicAmount(priceUsd, network)
  if ('error' in processed) {
    throw new Error(processed.error)
  }

  const paymentRequirements: PaymentRequirements = {
    scheme: 'exact',
    network,
    maxAmountRequired: processed.maxAmountRequired,
    resource: resolveResourceUrl(config.req, config.resourcePath),
    description: config.description,
    mimeType: config.mimeType ?? 'application/json',
    outputSchema: config.outputSchema as Record<string, any> | undefined,
    payTo: resolvePayTo(),
    maxTimeoutSeconds: DEFAULT_MAX_TIMEOUT_SECONDS,
    asset: processed.asset.address,
    ...(config.extra ? { extra: config.extra as Record<string, any> } : {}),
  }

  return { paymentRequirements, priceUsd, network }
}

export async function evaluateX402Payment(
  req: VercelRequest,
  config: X402PaymentRequirementConfig,
): Promise<X402PaymentGateResult> {
  const { paymentRequirements, priceUsd, network } = buildX402PaymentRequirements(config)
  const rawHeader = readPaymentHeader(req)
  if (!rawHeader) {
    return { status: 'missing', paymentRequirements, priceUsd, network }
  }

  const paymentPayload = parsePaymentHeader(rawHeader)
  if (!paymentPayload) {
    return {
      status: 'invalid',
      paymentRequirements,
      priceUsd,
      network,
      invalidReason: 'invalid_payment',
    }
  }

  const facilitator = getFacilitatorClient()
  const verification = await facilitator.verify(paymentPayload, paymentRequirements)
  if (!verification.isValid) {
    return {
      status: 'invalid',
      paymentRequirements,
      priceUsd,
      network,
      invalidReason: verification.invalidReason || 'invalid_payment',
      verification,
    }
  }

  const settlement = await facilitator.settle(paymentPayload, paymentRequirements)
  if (!settlement.success) {
    return {
      status: 'invalid',
      paymentRequirements,
      priceUsd,
      network,
      invalidReason: settlement.errorReason || 'unexpected_settle_error',
      verification,
      settlement,
    }
  }

  return {
    status: 'paid',
    paymentRequirements,
    priceUsd,
    network,
    payer: settlement.payer ? String(settlement.payer) : verification.payer ? String(verification.payer) : null,
    verification,
    settlement,
  }
}

export function setSettlementResponseHeaders(res: VercelResponse, settlement: SettleResponse) {
  const encoded = settleResponseHeader(settlement)
  res.setHeader('PAYMENT-RESPONSE', encoded)
  res.setHeader('X-PAYMENT-RESPONSE', encoded)
  setX402CorsHeaders(res)
}

export function sendPaymentRequiredResponse(
  req: VercelRequest,
  res: VercelResponse,
  params: {
    paymentRequirements: PaymentRequirements
    priceUsd: number
    network: X402Network
    error?: string
  },
) {
  const payload = createPaymentEnvelope(params.paymentRequirements, params.error)
  const encoded = safeBase64Encode(JSON.stringify(payload))

  res.statusCode = 402
  res.setHeader('PAYMENT-REQUIRED', encoded)
  res.setHeader('X-PAYMENT-REQUIRED', encoded)
  setX402CorsHeaders(res)

  if (wantsHtmlPaywall(req)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.end(
      getPaywallHtml({
        amount: params.priceUsd,
        paymentRequirements: [params.paymentRequirements],
        currentUrl: resolveResourceUrl(req, req.url ?? params.paymentRequirements.resource),
        testnet: params.network === 'base-sepolia',
        appName: '4626',
        appLogo: 'https://4626.fun/app-icon.png',
        cdpClientKey: (process.env.X402_CDP_CLIENT_KEY ?? '').trim() || undefined,
      }),
    )
  }

  return res.status(402).json(payload)
}
