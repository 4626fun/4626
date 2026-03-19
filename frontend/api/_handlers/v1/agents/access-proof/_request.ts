import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

import { agentAccessProofRequestSchema } from '../_accessSchemas.js'
import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { issueAgentAccessProofRequest } from '../../../../../server/_lib/agentAccessProof.js'
import { resolveMembershipForRoom } from '../../../../../server/_lib/agentAccessResolver.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const requestBodySchema = z
  .object({
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    chainId: z.number().int().min(1),
    shareToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    roomKey: z.string().min(1).max(128),
    nonceTtlMs: z.number().int().min(60_000).max(30 * 60_000).optional(),
  })
  .strict()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/agents/access-proof/request',
    kind: 'read',
  })
  if (!g.ok) return

  const rawBody = (await readJsonBody<Record<string, unknown>>(req)) ?? {}
  const parsedBody = requestBodySchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
    } satisfies ApiEnvelope<never>)
  }

  const body = parsedBody.data
  const wallet = body.wallet.toLowerCase() as `0x${string}`
  const shareToken = body.shareToken.toLowerCase() as `0x${string}`
  const membership = await resolveMembershipForRoom({
    wallet,
    chainId: body.chainId,
    shareToken,
    roomKey: body.roomKey,
  })
  if (!membership) {
    return res.status(404).json({
      success: false,
      error: 'Room membership rule not found for the provided shareToken/roomKey',
    } satisfies ApiEnvelope<never>)
  }
  if (!membership.qualified) {
    return res.status(403).json({
      success: false,
      error: `Not currently qualified (${membership.statusReason ?? 'insufficient_balance'})`,
    } satisfies ApiEnvelope<never>)
  }

  const proofRequest = await issueAgentAccessProofRequest({
    wallet,
    chainId: body.chainId,
    shareToken,
    roomKey: body.roomKey,
    nonceTtlMs: body.nonceTtlMs,
  })

  const parsedResponse = agentAccessProofRequestSchema.safeParse(proofRequest)
  if (!parsedResponse.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to serialize access proof request',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: parsedResponse.data,
  } satisfies ApiEnvelope<typeof parsedResponse.data>)
}
