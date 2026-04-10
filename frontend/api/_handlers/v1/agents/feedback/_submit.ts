/**
 * POST /api/v1/agents/feedback/submit
 *
 * Build unsigned calldata for giveFeedback / revokeFeedback / appendResponse
 * on the ERC-8004 Reputation Registry.
 *
 * The client signs and submits the transaction (or wraps it in a UserOp via paymaster).
 *
 * Body (JSON):
 *   action: "give" | "revoke" | "respond"
 *
 *   For "give":
 *     agentId, value, valueDecimals, tag1?, tag2?, endpoint?, feedbackURI?, feedbackHash?
 *
 *   For "revoke":
 *     agentId, feedbackIndex
 *
 *   For "respond":
 *     agentId, clientAddress, feedbackIndex, responseURI, responseHash?
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { encodeFunctionData, keccak256, toHex, type Hex } from 'viem'

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
} from '../../../../../packages/server-core/src/index.js'


import {
  getReputationRegistryAddress,
  REPUTATION_REGISTRY_ABI,
} from '../../../../../server/_lib/erc8004.js'

type SubmitRequest = {
  action?: string
  agentId?: number | string
  value?: number | string
  valueDecimals?: number
  tag1?: string
  tag2?: string
  endpoint?: string
  feedbackURI?: string
  feedbackHash?: string
  feedbackIndex?: number | string
  clientAddress?: string
  responseURI?: string
  responseHash?: string
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
const MAX_TAG_LENGTH = 64
const MAX_ENDPOINT_LENGTH = 320
const MAX_URI_LENGTH = 500

function asObjectBody(input: unknown): SubmitRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as SubmitRequest
}

function parseNonNegativeBigInt(value: unknown, field: string, opts: { allowZero?: boolean } = {}): bigint {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) throw new Error(`${field} must be a non-negative integer`)
  const parsed = BigInt(raw)
  if (!opts.allowZero && parsed <= 0n) throw new Error(`${field} must be > 0`)
  return parsed
}

function parseValueDecimals(value: unknown): number {
  const raw = String(value ?? '').trim()
  if (!/^\d+$/.test(raw)) throw new Error('valueDecimals must be 0-18')
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 18) throw new Error('valueDecimals must be 0-18')
  return parsed
}

function boundedString(value: unknown, field: string, maxLength: number): string {
  const out = typeof value === 'string' ? value.trim() : ''
  if (out.length > maxLength) throw new Error(`${field} exceeds max length ${maxLength}`)
  return out
}

function parseOptionalHash(value: unknown, field: string): Hex | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${field} must be a 32-byte hex string`)
  }
  return value as Hex
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/feedback/submit', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agent-feedback-submit', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentFeedbackSubmit,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: 32_768 }))
  const action = String(body.action ?? '').trim().toLowerCase()
  const registry = getReputationRegistryAddress()

  try {
    if (action === 'give') {
      const agentId = parseNonNegativeBigInt(body.agentId, 'agentId', { allowZero: true })
      const value = parseNonNegativeBigInt(body.value ?? '0', 'value', { allowZero: true })
      const valueDecimals = parseValueDecimals(body.valueDecimals ?? 0)
      const tag1 = boundedString(body.tag1, 'tag1', MAX_TAG_LENGTH)
      const tag2 = boundedString(body.tag2, 'tag2', MAX_TAG_LENGTH)
      const endpoint = boundedString(body.endpoint, 'endpoint', MAX_ENDPOINT_LENGTH)
      const feedbackURI = boundedString(body.feedbackURI, 'feedbackURI', MAX_URI_LENGTH)

      let feedbackHash: Hex = ZERO_BYTES32
      const explicitFeedbackHash = parseOptionalHash(body.feedbackHash, 'feedbackHash')
      if (explicitFeedbackHash) {
        feedbackHash = explicitFeedbackHash
      } else if (feedbackURI) {
        // Auto-hash the URI for integrity verification
        feedbackHash = keccak256(toHex(feedbackURI))
      }

      const calldata = encodeFunctionData({
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
      })

      return res.status(200).json({
        success: true,
        data: {
          to: registry,
          calldata,
          action: 'giveFeedback',
          args: {
            agentId: Number(agentId),
            value: Number(value),
            valueDecimals,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash,
          },
        },
      })
    }

    if (action === 'revoke') {
      const agentId = parseNonNegativeBigInt(body.agentId, 'agentId', { allowZero: true })
      const feedbackIndex = parseNonNegativeBigInt(body.feedbackIndex, 'feedbackIndex')

      const calldata = encodeFunctionData({
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'revokeFeedback',
        args: [agentId, feedbackIndex],
      })

      return res.status(200).json({
        success: true,
        data: {
          to: registry,
          calldata,
          action: 'revokeFeedback',
          args: { agentId: Number(agentId), feedbackIndex: Number(feedbackIndex) },
        },
      })
    }

    if (action === 'respond') {
      const agentId = parseNonNegativeBigInt(body.agentId, 'agentId', { allowZero: true })
      const clientAddress = boundedString(body.clientAddress, 'clientAddress', 42)
      if (!/^0x[a-fA-F0-9]{40}$/.test(clientAddress)) throw new Error('clientAddress is required')
      const feedbackIndex = parseNonNegativeBigInt(body.feedbackIndex, 'feedbackIndex')
      const responseURI = boundedString(body.responseURI, 'responseURI', MAX_URI_LENGTH)
      if (!responseURI) throw new Error('responseURI is required')

      let responseHash: Hex = ZERO_BYTES32
      const explicitResponseHash = parseOptionalHash(body.responseHash, 'responseHash')
      if (explicitResponseHash) {
        responseHash = explicitResponseHash
      } else {
        responseHash = keccak256(toHex(responseURI))
      }

      const calldata = encodeFunctionData({
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'appendResponse',
        args: [agentId, clientAddress as `0x${string}`, feedbackIndex, responseURI, responseHash],
      })

      return res.status(200).json({
        success: true,
        data: {
          to: registry,
          calldata,
          action: 'appendResponse',
          args: {
            agentId: Number(agentId),
            clientAddress,
            feedbackIndex: Number(feedbackIndex),
            responseURI,
            responseHash,
          },
        },
      })
    }

    return res.status(400).json({ success: false, error: 'action must be "give", "revoke", or "respond"' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build feedback calldata'
    return res.status(400).json({ success: false, error: msg })
  }
}
