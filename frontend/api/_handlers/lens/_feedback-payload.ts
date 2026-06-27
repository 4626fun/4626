/**
 * POST /api/lens/feedback-payload
 *
 * Store an ERC-8004 v2.0 feedback payload on Lens Grove and return the
 * content-addressed `lens://` URI + keccak256 hash for use as
 * `feedbackURI` / `feedbackHash` in the on-chain `giveFeedback` call.
 *
 * Body (JSON): a FeedbackPayload object (see erc8004.ts types).
 *   Required: agentId, value, valueDecimals
 *   Optional: reasoning, tag1, tag2, attachments, proofOfPayment, etc.
 *
 * Returns:
 *   feedbackURI  – lens:// URI pointing to the stored payload
 *   feedbackHash – keccak256 of the JSON payload (for on-chain integrity)
 *   gatewayUrl   – HTTPS gateway URL for the stored payload
 *   payload      – the normalized payload that was stored
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  keccak256,
  toHex } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  readRequestPrincipal,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { tryUploadImmutableJson } from '../../../server/_lib/lens/lensGrove.js'
import { getIdentityRegistryAddress } from '../../../server/_lib/agent/erc8004.js'
import type { FeedbackPayload } from '../../../server/_lib/agent/erc8004.js'


declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type FeedbackPayloadRequest = Partial<FeedbackPayload> & {
  store?: boolean
}

const FEEDBACK_PAYLOAD_BODY_MAX_BYTES = 65_536

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function buildFeedbackPayloadDiscovery() {
  return {
    endpoint: '/api/lens/feedback-payload',
    method: 'POST',
    requiredBody: ['agentId', 'value', 'valueDecimals'],
    optionalBody: [
      'store',
      'clientAddress',
      'reasoning',
      'reproducible',
      'tag1',
      'tag2',
      'attachments',
      'proofOfPayment',
      'skill',
      'domain',
      'context',
      'capability',
      'name',
      'endpoint',
    ],
    example: {
      agentId: 1,
      value: '5',
      valueDecimals: 0,
      store: false,
    },
  } as const
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method === 'GET') {
    const limiter = await checkDurableRateLimit(
      rateLimitKey('lens-feedback-payload', 'get', getClientIp(req)),
      RATE_LIMITS.specRead,
      { failClosed: true },
    )
    if (!limiter.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
      return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
    }
    return res.status(200).json({
      success: true,
      data: buildFeedbackPayloadDiscovery(),
    } satisfies ApiEnvelope<ReturnType<typeof buildFeedbackPayloadDiscovery>>)
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST /api/lens/feedback-payload with JSON body { agentId, value, valueDecimals }.',
    } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('lens-feedback-payload', 'post', getClientIp(req)),
    RATE_LIMITS.agentsWrite,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: FEEDBACK_PAYLOAD_BODY_MAX_BYTES })) as FeedbackPayloadRequest

  // Validate required fields
  const agentId = Number(body.agentId ?? -1)
  if (!Number.isFinite(agentId) || agentId < 0) {
    return res.status(400).json({
      success: false,
      error: 'agentId is required (non-negative integer). Example: POST /api/lens/feedback-payload with {"agentId":1,"value":"5","valueDecimals":0}.',
    } satisfies ApiEnvelope<never>)
  }

  const value = String(body.value ?? '0')
  const valueDecimals = Number(body.valueDecimals ?? 0)
  if (valueDecimals < 0 || valueDecimals > 18) {
    return res.status(400).json({ success: false, error: 'valueDecimals must be 0-18' } satisfies ApiEnvelope<never>)
  }

  // Build CAIP-10 agent registry reference
  const chainId = Number(process.env.ERC8004_AGENT_CHAIN_ID ?? '8453')
  const identityRegistry = getIdentityRegistryAddress()
  const agentRegistry = `eip155:${chainId}:${identityRegistry.toLowerCase()}`

  // Normalize the payload
  const payload: FeedbackPayload = {
    agentRegistry,
    agentId,
    clientAddress: String(body.clientAddress ?? '').trim(),
    createdAt: body.createdAt || new Date().toISOString(),
    value,
    valueDecimals,
    reasoning: body.reasoning,
    reproducible: body.reproducible,
    tag1: body.tag1,
    tag2: body.tag2,
    attachments: body.attachments,
    proofOfPayment: body.proofOfPayment,
    skill: body.skill,
    domain: body.domain,
    context: body.context,
    capability: body.capability,
    name: body.name,
    endpoint: body.endpoint,
  }

  // Remove undefined fields for cleaner JSON
  const cleanPayload = JSON.parse(JSON.stringify(payload)) as FeedbackPayload

  try {
    const shouldStore = body.store !== false
    const hasAuthPrincipal = Boolean(readRequestPrincipal(req))
    if (shouldStore && !hasAuthPrincipal) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to store on Grove. Use session or SIWA receipt, or set store=false.',
      } satisfies ApiEnvelope<never>)
    }

    // Compute the hash of the canonical JSON representation
    const canonicalJson = JSON.stringify(cleanPayload, null, 2)
    const feedbackHash = keccak256(toHex(canonicalJson))

    if (!shouldStore) {
      return res.status(200).json({
        success: true,
        data: {
          payload: cleanPayload,
          feedbackHash,
          feedbackURI: null,
          gatewayUrl: null,
        },
      })
    }

    // Upload to Lens Grove (with retry + graceful degradation)
    const attempt = await tryUploadImmutableJson(cleanPayload)

    if (attempt.ok) {
      return res.status(200).json({
        success: true,
        data: {
          payload: cleanPayload,
          feedbackURI: attempt.result.lensUri,
          feedbackHash,
          gatewayUrl: attempt.result.gatewayUrl,
          storageKey: attempt.result.storageKey,
          statusUrl: attempt.result.statusUrl,
          groveStatus: 'stored' as const,
        },
      })
    }

    // Grove is unavailable — return the hash so the caller can still
    // proceed with the on-chain transaction and re-upload later.
    return res.status(200).json({
      success: true,
      data: {
        payload: cleanPayload,
        feedbackURI: null,
        feedbackHash,
        gatewayUrl: null,
        storageKey: null,
        statusUrl: null,
        groveStatus: 'unavailable' as const,
        groveError: attempt.error,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build feedback payload'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
