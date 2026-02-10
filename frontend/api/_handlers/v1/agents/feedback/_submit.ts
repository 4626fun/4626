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

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import {
  getReputationRegistryAddress,
  REPUTATION_REGISTRY_ABI,
} from '../../../../../server/_lib/erc8004.js'
import { indexFeedback, revokeFeedbackIndex } from '../../../../../server/_lib/walletIntelligenceCache.js'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/feedback/submit', kind: 'write' })
  if (!g.ok) return

  const body = (await readJsonBody<SubmitRequest>(req)) ?? {}
  const action = String(body.action ?? '').trim().toLowerCase()
  const registry = getReputationRegistryAddress()

  try {
    if (action === 'give') {
      const agentId = BigInt(String(body.agentId ?? ''))
      const value = BigInt(String(body.value ?? '0'))
      const valueDecimals = Number(body.valueDecimals ?? 0)
      if (valueDecimals > 18) throw new Error('valueDecimals must be 0-18')

      const tag1 = String(body.tag1 ?? '')
      const tag2 = String(body.tag2 ?? '')
      const endpoint = String(body.endpoint ?? '')
      const feedbackURI = String(body.feedbackURI ?? '')

      let feedbackHash: Hex = ZERO_BYTES32
      if (body.feedbackHash && /^0x[a-fA-F0-9]{64}$/.test(body.feedbackHash)) {
        feedbackHash = body.feedbackHash as Hex
      } else if (feedbackURI) {
        // Auto-hash the URI for integrity verification
        feedbackHash = keccak256(toHex(feedbackURI))
      }

      const calldata = encodeFunctionData({
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'giveFeedback',
        args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
      })

      // Index in Supabase (async, non-blocking).
      void indexFeedback({
        agentId: Number(agentId),
        clientAddress: g.ip, // Will be overwritten when on-chain tx is confirmed
        feedbackIndex: 0, // Placeholder — updated when tx is mined
        value: Number(value),
        valueDecimals,
        tag1,
        tag2,
        endpoint,
        feedbackUri: feedbackURI || undefined,
        feedbackHash: feedbackHash !== ZERO_BYTES32 ? feedbackHash : undefined,
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
      const agentId = BigInt(String(body.agentId ?? ''))
      const feedbackIndex = BigInt(String(body.feedbackIndex ?? ''))
      if (feedbackIndex <= 0n) throw new Error('feedbackIndex must be > 0')

      const calldata = encodeFunctionData({
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'revokeFeedback',
        args: [agentId, feedbackIndex],
      })

      // Mark as revoked in Supabase index (async, non-blocking).
      const revokeClient = String(body.clientAddress ?? '').trim()
      if (/^0x[a-fA-F0-9]{40}$/.test(revokeClient)) {
        void revokeFeedbackIndex(Number(agentId), revokeClient, Number(feedbackIndex))
      }

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
      const agentId = BigInt(String(body.agentId ?? ''))
      const clientAddress = String(body.clientAddress ?? '').trim()
      if (!/^0x[a-fA-F0-9]{40}$/.test(clientAddress)) throw new Error('clientAddress is required')
      const feedbackIndex = BigInt(String(body.feedbackIndex ?? ''))
      if (feedbackIndex <= 0n) throw new Error('feedbackIndex must be > 0')
      const responseURI = String(body.responseURI ?? '').trim()
      if (!responseURI) throw new Error('responseURI is required')

      let responseHash: Hex = ZERO_BYTES32
      if (body.responseHash && /^0x[a-fA-F0-9]{64}$/.test(body.responseHash)) {
        responseHash = body.responseHash as Hex
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
