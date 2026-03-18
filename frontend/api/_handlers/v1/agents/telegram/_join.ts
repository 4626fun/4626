import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { verifyAgentRoomAccessToken } from '../../../../../server/_lib/agentAccessProof.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const joinBodySchema = z
  .object({
    accessToken: z.string().min(16),
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
    endpoint: 'v1/agents/telegram/join',
    kind: 'read',
  })
  if (!g.ok) return

  const rawBody = (await readJsonBody<Record<string, unknown>>(req)) ?? {}
  const parsedBody = joinBodySchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
    } satisfies ApiEnvelope<never>)
  }

  const verified = await verifyAgentRoomAccessToken(parsedBody.data.accessToken)
  if (!verified.ok) {
    return res.status(401).json({
      success: false,
      error: verified.error,
    } satisfies ApiEnvelope<never>)
  }

  const token = verified.token
  const canJoin = (token.capabilities ?? []).includes('join')
  if (!canJoin) {
    return res.status(403).json({
      success: false,
      error: 'Token is missing join capability',
    } satisfies ApiEnvelope<never>)
  }

  if (!token.roomKey.startsWith('telegram:')) {
    return res.status(403).json({
      success: false,
      error: 'Room token is not valid for Telegram joins',
    } satisfies ApiEnvelope<never>)
  }

  const roomChatId = token.roomKey.slice('telegram:'.length).trim()
  if (!roomChatId) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Telegram room key',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      protocol: 'telegram',
      eligible: true,
      roomKey: token.roomKey,
      roomChatId,
      shareToken: token.shareToken,
      wallet: token.sub,
      chainId: token.chainId,
      expiresAt: token.expiresAt,
      instructions: {
        action: 'telegram.join_holder_room',
        roomChatId,
        wallet: token.sub,
      },
    },
  } satisfies ApiEnvelope<{
    protocol: 'telegram'
    eligible: boolean
    roomKey: string
    roomChatId: string
    shareToken: string
    wallet: string
    chainId: number
    expiresAt: string
    instructions: { action: 'telegram.join_holder_room'; roomChatId: string; wallet: string }
  }>)
}
