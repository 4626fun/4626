import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

import {
  agentAccessProofSubmitSchema,
  type AgentMembership,
} from '../_accessSchemas.js'
import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
} from '../../../../../packages/server-core/src/index.js'


import {
  issueAgentRoomAccessToken,
  verifyAgentAccessProofSubmission,
} from '../../../../../server/_lib/agentAccessProof.js'
import { resolveMembershipForRoom } from '../../../../../server/_lib/agentAccessResolver.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const verifyBodySchema = agentAccessProofSubmitSchema
  .extend({
    tokenTtlMs: z.number().int().min(15 * 60_000).max(60 * 60_000).optional(),
  })
  .strict()

function capabilitiesForMembership(membership: AgentMembership): Array<'join' | 'read' | 'write' | 'react' | 'view-members'> {
  switch (membership.type) {
    case 'xmtp':
      return ['join', 'read', 'write', 'react', 'view-members']
    case 'telegram':
      return ['join', 'read', 'write', 'react']
    case 'governance':
      return ['read', 'write']
    case 'vault-ui':
    default:
      return ['read']
  }
}

function statusCodeForVerificationError(message: string): number {
  const text = message.toLowerCase()
  if (text.includes('expired') || text.includes('not_yet_valid')) return 400
  if (text.includes('nonce')) return 401
  if (text.includes('signature') || text.includes('signer')) return 401
  if (text.includes('mismatch')) return 400
  return 400
}

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
    endpoint: 'v1/agents/access-proof/verify',
    kind: 'read',
  })
  if (!g.ok) return

  const rawBody = (await readJsonBody<Record<string, unknown>>(req)) ?? {}
  const parsedBody = verifyBodySchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid proof submission payload',
    } satisfies ApiEnvelope<never>)
  }

  const body = parsedBody.data
  const submission = {
    schema: body.schema,
    proofRequest: body.proofRequest,
    signature: body.signature,
    signer: body.signer,
  }

  let verifiedProof: Awaited<ReturnType<typeof verifyAgentAccessProofSubmission>>
  try {
    verifiedProof = await verifyAgentAccessProofSubmission({ submission })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'proof_verification_failed'
    return res.status(statusCodeForVerificationError(message)).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }

  const membership = await resolveMembershipForRoom({
    wallet: verifiedProof.wallet,
    chainId: verifiedProof.chainId,
    shareToken: verifiedProof.shareToken,
    roomKey: verifiedProof.roomKey,
  })
  if (!membership) {
    return res.status(404).json({
      success: false,
      error: 'Room membership rule not found',
    } satisfies ApiEnvelope<never>)
  }
  if (!membership.qualified) {
    return res.status(403).json({
      success: false,
      error: `Not currently qualified (${membership.statusReason ?? 'insufficient_balance'})`,
    } satisfies ApiEnvelope<never>)
  }

  const roomToken = await issueAgentRoomAccessToken({
    sub: verifiedProof.wallet,
    chainId: verifiedProof.chainId,
    shareToken: verifiedProof.shareToken,
    roomKey: verifiedProof.roomKey,
    ttlMs: body.tokenTtlMs,
    capabilities: capabilitiesForMembership(membership),
  })

  return res.status(200).json({
    success: true,
    data: {
      proofVerified: true,
      signer: verifiedProof.signer,
      recoveredSigner: verifiedProof.recoveredSigner,
      membership,
      roomAccess: roomToken,
    },
  } satisfies ApiEnvelope<{
    proofVerified: boolean
    signer: string
    recoveredSigner: string | null
    membership: AgentMembership
    roomAccess: typeof roomToken
  }>)
}
