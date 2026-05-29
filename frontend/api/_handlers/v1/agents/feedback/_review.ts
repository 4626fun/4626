import type { VercelRequest, VercelResponse } from '@vercel/node'

import { encodeFunctionData, keccak256, toHex } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { type FeedbackPayload, getIdentityRegistryAddress, getReputationRegistryAddress, REPUTATION_REGISTRY_ABI } from '../../../../../server/_lib/agent/erc8004.js'
import { buildErc8004TechnicalReview } from '../../../../../server/_lib/agent/erc8004Review.js'
import { tryUploadImmutableJson } from '../../../../../server/_lib/lens/lensGrove.js'
import {
  evaluateX402Payment,
  sendPaymentRequiredResponse,
  setSettlementResponseHeaders,
  setX402CorsHeaders,
} from '../../../../../server/_lib/payments/x402Service.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ReviewRequest = {
  agentId?: number | string
  registrationUrl?: string
  endpoint?: string
  capability?: string
}
const MAX_REGISTRATION_URL_LENGTH = 1_024
const MAX_ENDPOINT_LENGTH = 1_024
const MAX_CAPABILITY_LENGTH = 128

function asObjectBody(input: unknown): ReviewRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as ReviewRequest
}

function parseNonNegativeInt(value: unknown, field: string): number {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${field} is required (non-negative integer).`)
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error(`${field} is required (non-negative integer).`)
  }
  return parsed
}

function normalizeOptionalString(value: unknown, maxLength: number): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return undefined
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const REVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        review: { type: 'object' },
        payment: { type: 'object' },
        feedback: { type: 'object' },
      },
    },
  },
} as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setX402CorsHeaders(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST /api/v1/agents/feedback/review.',
    } satisfies ApiEnvelope<never>)
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/feedback/review', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agent-feedback-review', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentFeedbackReview,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: 65_536 }))
  let agentId = -1
  try {
    agentId = parseNonNegativeInt(body.agentId, 'agentId')
  } catch {
    return res.status(400).json({
      success: false,
      error: 'agentId is required (non-negative integer).',
    } satisfies ApiEnvelope<never>)
  }
  const registrationUrl = normalizeOptionalString(body.registrationUrl, MAX_REGISTRATION_URL_LENGTH)
  const endpoint = normalizeOptionalString(body.endpoint, MAX_ENDPOINT_LENGTH)
  const capability = normalizeOptionalString(body.capability, MAX_CAPABILITY_LENGTH)
  if (registrationUrl && !isHttpUrl(registrationUrl)) {
    return res.status(400).json({ success: false, error: 'registrationUrl must be an http(s) URL.' } satisfies ApiEnvelope<never>)
  }
  if (endpoint && !isHttpUrl(endpoint)) {
    return res.status(400).json({ success: false, error: 'endpoint must be an http(s) URL.' } satisfies ApiEnvelope<never>)
  }

  const paymentGate = await evaluateX402Payment(req, {
    req,
    resourcePath: '/api/v1/agents/feedback/review',
    description: '4626 ERC-8004 paid technical review with Lens payload + giveFeedback calldata.',
    mimeType: 'application/json',
    outputSchema: REVIEW_OUTPUT_SCHEMA,
    extra: {
      service: 'erc8004-review',
      priceAsset: 'USDC',
      reviewMode: 'independent-technical-review',
    },
  })

  if (paymentGate.status === 'missing') {
    return sendPaymentRequiredResponse(req, res, paymentGate)
  }

  if (paymentGate.status === 'invalid') {
    if (paymentGate.settlement) setSettlementResponseHeaders(res, paymentGate.settlement)
    return sendPaymentRequiredResponse(req, res, {
      paymentRequirements: paymentGate.paymentRequirements,
      priceUsd: paymentGate.priceUsd,
      network: paymentGate.network,
      error: paymentGate.invalidReason,
    })
  }

  setSettlementResponseHeaders(res, paymentGate.settlement)

  try {
    const review = await buildErc8004TechnicalReview({
      agentId,
      registrationUrl,
      endpoint,
    })

    const chainId = review.identity.chainId
    const agentRegistry = `eip155:${chainId}:${getIdentityRegistryAddress().toLowerCase()}`
    const feedbackPayload: FeedbackPayload = {
      agentRegistry,
      agentId,
      clientAddress: paymentGate.payer ?? '',
      createdAt: review.generatedAt,
      value: review.score.value,
      valueDecimals: review.score.valueDecimals,
      reasoning: review.reasoning,
      reproducible: review.registration.valid && review.endpoint.checked,
      tag1: 'technical-review',
      tag2: review.score.label.toLowerCase().replace(/\s+/g, '-'),
      attachments: [
        {
          name: '8004scan-profile',
          uri: review.scanUrl,
          description: 'Primary ERC-8004 scanner view for the reviewed agent.',
        },
        ...(review.registration.finalUrl
          ? [{
              name: 'registration',
              uri: review.registration.finalUrl,
              description: 'Registration metadata reviewed by the service.',
            }]
          : []),
        ...(review.endpoint.finalUrl
          ? [{
              name: 'endpoint-check',
              uri: review.endpoint.finalUrl,
              description: 'Endpoint probed during the technical review.',
            }]
          : []),
      ],
      proofOfPayment: {
        protocol: 'x402',
        amount: paymentGate.priceUsd.toFixed(2),
        currency: 'USDC',
        txHash: paymentGate.settlement.transaction || undefined,
        chainId: paymentGate.network === 'base' ? 8453 : 84532,
        timestamp: review.generatedAt,
      },
      capability,
      endpoint: review.endpoint.finalUrl ?? review.endpoint.url ?? undefined,
    }

    const canonicalJson = JSON.stringify(feedbackPayload, null, 2)
    const feedbackHash = keccak256(toHex(canonicalJson))
    const groveAttempt = await tryUploadImmutableJson(feedbackPayload)

    const feedbackURI = groveAttempt.ok ? groveAttempt.result.lensUri : null
    const gatewayUrl = groveAttempt.ok ? groveAttempt.result.gatewayUrl : null
    const groveStatus = groveAttempt.ok ? 'stored' as const : 'unavailable' as const

    const calldata = encodeFunctionData({
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'giveFeedback',
      args: [
        BigInt(agentId),
        BigInt(review.score.value),
        review.score.valueDecimals,
        'technical-review',
        review.score.label.toLowerCase().replace(/\s+/g, '-'),
        review.endpoint.finalUrl ?? review.endpoint.url ?? '',
        feedbackURI ?? '',
        feedbackHash,
      ],
    })

    return res.status(200).json({
      success: true,
      data: {
        review,
        payment: {
          protocol: 'x402',
          network: paymentGate.network,
          payer: paymentGate.payer,
          amountUsd: paymentGate.priceUsd,
          settlement: paymentGate.settlement,
        },
        feedback: {
          payload: feedbackPayload,
          feedbackHash,
          feedbackURI,
          gatewayUrl,
          groveStatus,
          groveError: groveAttempt.ok ? null : groveAttempt.error,
          calldata,
          to: getReputationRegistryAddress(),
          submission: {
            action: 'giveFeedback',
            submitterDisclaimer:
              'This paid service generated an independent review packet. If you want the review posted from 4626’s reviewer identity, run the operator-side submission step separately.',
          },
        },
      },
    } satisfies ApiEnvelope<unknown>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate paid ERC-8004 review'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
