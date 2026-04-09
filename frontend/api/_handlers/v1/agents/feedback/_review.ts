import type { VercelRequest, VercelResponse } from '@vercel/node'

import { encodeFunctionData, keccak256, toHex } from 'viem'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'


import { type FeedbackPayload, getIdentityRegistryAddress, getReputationRegistryAddress, REPUTATION_REGISTRY_ABI } from '../../../../../server/_lib/erc8004.js'
import { buildErc8004TechnicalReview } from '../../../../../server/_lib/erc8004Review.js'
import { tryUploadImmutableJson } from '../../../../../server/_lib/lensGrove.js'
import {
  evaluateX402Payment,
  sendPaymentRequiredResponse,
  setSettlementResponseHeaders,
  setX402CorsHeaders,
} from '../../../../../server/_lib/x402Service.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ReviewRequest = {
  agentId?: number | string
  registrationUrl?: string
  endpoint?: string
  capability?: string
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
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody(req, { maxBytes: 65_536 })) ?? {}
  const agentId = Number(body.agentId ?? -1)
  if (!Number.isFinite(agentId) || agentId < 0 || Math.floor(agentId) !== agentId) {
    return res.status(400).json({
      success: false,
      error: 'agentId is required (non-negative integer).',
    } satisfies ApiEnvelope<never>)
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
      registrationUrl: typeof body.registrationUrl === 'string' ? body.registrationUrl.trim() : undefined,
      endpoint: typeof body.endpoint === 'string' ? body.endpoint.trim() : undefined,
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
      capability: typeof body.capability === 'string' ? body.capability.trim() || undefined : undefined,
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
