import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  guardAgentApiRequest,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  acceptChatFriendRequest,
  cancelOutgoingChatFriendRequest,
  declineChatFriendRequest,
  listChatFriendSnapshot,
  removeChatFriend,
  sendChatFriendRequest,
} from '../../../../server/_lib/chat/friends.js'
import { normalizeChatAddress } from '../../../../server/_lib/chat/presence.js'

type FriendAction = 'send_request' | 'accept_request' | 'decline_request' | 'cancel_request' | 'remove_friend'

function parseAction(value: unknown): FriendAction | null {
  switch (String(value ?? '')) {
    case 'send_request':
    case 'accept_request':
    case 'cancel_request':
    case 'decline_request':
    case 'remove_friend':
      return value as FriendAction
    default:
      return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/chat/friends',
    kind: req.method === 'GET' ? 'read' : 'write',
  })
  if (!g.ok) return

  const address = normalizeChatAddress(g.auth?.address)
  if (!address) return res.status(401).json({ success: false, error: 'Authentication required' })

  const limiter = checkRateLimit(
    rateLimitKey(`v1-chat-friends-${req.method.toLowerCase()}`, address, getClientIp(req)),
    req.method === 'GET' ? RATE_LIMITS.agentsRead : RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  if (req.method === 'GET') {
    const snapshot = await listChatFriendSnapshot(address)
    return res.status(200).json({ success: true, data: snapshot })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 4096 })) ?? {}
  const action = parseAction(body.action)
  const targetAddress = normalizeChatAddress(body.targetAddress)
  if (!action || !targetAddress) {
    return res.status(400).json({ success: false, error: 'invalid_request' })
  }

  let actionResult: { ok: true } | { ok: false; reason: string }
  switch (action) {
    case 'send_request':
      actionResult = await sendChatFriendRequest({ viewerAddress: address, targetAddress })
      break
    case 'accept_request':
      actionResult = await acceptChatFriendRequest({ viewerAddress: address, targetAddress })
      break
    case 'decline_request':
      actionResult = await declineChatFriendRequest({ viewerAddress: address, targetAddress })
      break
    case 'cancel_request':
      actionResult = await cancelOutgoingChatFriendRequest({ viewerAddress: address, targetAddress })
      break
    case 'remove_friend':
      actionResult = await removeChatFriend({ viewerAddress: address, targetAddress })
      break
  }

  if (!actionResult.ok) {
    return res.status(409).json({ success: false, error: actionResult.reason })
  }

  const snapshot = await listChatFriendSnapshot(address)
  return res.status(200).json({ success: true, data: snapshot })
}
