import { getDb } from '../db/postgres.js'
import { ensureChatSchema } from '../db/schemaBootstrap.js'
import { normalizeChatAddress } from './presence.js'

export type ChatFriendState = 'accepted' | 'pending_incoming' | 'pending_outgoing'

export type ChatFriendRecord = {
  address: `0x${string}`
  state: ChatFriendState
  updatedAt: string
}

export type ChatFriendsSnapshot = {
  friends: ChatFriendRecord[]
  incoming: ChatFriendRecord[]
  outgoing: ChatFriendRecord[]
}

export async function listChatFriendSnapshot(viewerAddress: `0x${string}`): Promise<ChatFriendsSnapshot> {
  const db = await getDb()
  if (!db) return { friends: [], incoming: [], outgoing: [] }
  await ensureChatSchema(db)

  const res = await db.sql`
    SELECT
      requester_wallet,
      addressee_wallet,
      status,
      updated_at
    FROM chat_friend_requests
    WHERE
      (requester_wallet = ${viewerAddress} OR addressee_wallet = ${viewerAddress})
      AND status IN ('pending', 'accepted')
    ORDER BY updated_at DESC
    LIMIT 500;
  `

  const friends: ChatFriendRecord[] = []
  const incoming: ChatFriendRecord[] = []
  const outgoing: ChatFriendRecord[] = []

  for (const row of res.rows ?? []) {
    const requester = normalizeChatAddress(row.requester_wallet)
    const addressee = normalizeChatAddress(row.addressee_wallet)
    if (!requester || !addressee) continue
    const status = String(row.status ?? '')
    const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    const isViewerRequester = requester === viewerAddress
    const peer = (isViewerRequester ? addressee : requester) as `0x${string}`

    if (status === 'accepted') {
      friends.push({ address: peer, state: 'accepted', updatedAt })
      continue
    }
    if (status !== 'pending') continue

    if (isViewerRequester) {
      outgoing.push({ address: peer, state: 'pending_outgoing', updatedAt })
    } else {
      incoming.push({ address: peer, state: 'pending_incoming', updatedAt })
    }
  }

  return { friends, incoming, outgoing }
}

export async function sendChatFriendRequest(params: {
  viewerAddress: `0x${string}`
  targetAddress: `0x${string}`
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb()
  if (!db) return { ok: false, reason: 'db_not_configured' }
  await ensureChatSchema(db)

  if (params.viewerAddress === params.targetAddress) {
    return { ok: false, reason: 'self_request_not_allowed' }
  }

  const existing = await db.sql`
    SELECT requester_wallet, addressee_wallet, status
    FROM chat_friend_requests
    WHERE
      (requester_wallet = ${params.viewerAddress} AND addressee_wallet = ${params.targetAddress})
      OR (requester_wallet = ${params.targetAddress} AND addressee_wallet = ${params.viewerAddress})
    ORDER BY updated_at DESC
    LIMIT 2;
  `

  for (const row of existing.rows ?? []) {
    const requester = normalizeChatAddress(row.requester_wallet)
    const addressee = normalizeChatAddress(row.addressee_wallet)
    const status = String(row.status ?? '')
    if (!requester || !addressee) continue
    if (status === 'accepted') return { ok: false, reason: 'already_friends' }
    if (status === 'pending' && requester === params.viewerAddress && addressee === params.targetAddress) {
      return { ok: false, reason: 'request_already_sent' }
    }
    if (status === 'pending' && requester === params.targetAddress && addressee === params.viewerAddress) {
      return { ok: false, reason: 'incoming_request_exists' }
    }
  }

  await db.sql`
    INSERT INTO chat_friend_requests (
      requester_wallet,
      addressee_wallet,
      status,
      created_at,
      updated_at
    ) VALUES (
      ${params.viewerAddress},
      ${params.targetAddress},
      'pending',
      NOW(),
      NOW()
    )
    ON CONFLICT (requester_wallet, addressee_wallet) DO UPDATE SET
      status = 'pending',
      updated_at = NOW();
  `

  return { ok: true }
}

export async function acceptChatFriendRequest(params: {
  viewerAddress: `0x${string}`
  targetAddress: `0x${string}`
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb()
  if (!db) return { ok: false, reason: 'db_not_configured' }
  await ensureChatSchema(db)

  const result = await db.sql`
    UPDATE chat_friend_requests
    SET
      status = 'accepted',
      responded_at = NOW(),
      updated_at = NOW()
    WHERE
      requester_wallet = ${params.targetAddress}
      AND addressee_wallet = ${params.viewerAddress}
      AND status = 'pending'
    RETURNING requester_wallet;
  `

  if ((result.rows ?? []).length === 0) {
    return { ok: false, reason: 'request_not_found' }
  }
  return { ok: true }
}

export async function declineChatFriendRequest(params: {
  viewerAddress: `0x${string}`
  targetAddress: `0x${string}`
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb()
  if (!db) return { ok: false, reason: 'db_not_configured' }
  await ensureChatSchema(db)

  const result = await db.sql`
    UPDATE chat_friend_requests
    SET
      status = 'declined',
      responded_at = NOW(),
      updated_at = NOW()
    WHERE
      requester_wallet = ${params.targetAddress}
      AND addressee_wallet = ${params.viewerAddress}
      AND status = 'pending'
    RETURNING requester_wallet;
  `

  if ((result.rows ?? []).length === 0) {
    return { ok: false, reason: 'request_not_found' }
  }
  return { ok: true }
}

export async function cancelOutgoingChatFriendRequest(params: {
  viewerAddress: `0x${string}`
  targetAddress: `0x${string}`
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb()
  if (!db) return { ok: false, reason: 'db_not_configured' }
  await ensureChatSchema(db)

  await db.sql`
    DELETE FROM chat_friend_requests
    WHERE requester_wallet = ${params.viewerAddress}
      AND addressee_wallet = ${params.targetAddress}
      AND status = 'pending';
  `
  return { ok: true }
}

export async function removeChatFriend(params: {
  viewerAddress: `0x${string}`
  targetAddress: `0x${string}`
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb()
  if (!db) return { ok: false, reason: 'db_not_configured' }
  await ensureChatSchema(db)

  await db.sql`
    DELETE FROM chat_friend_requests
    WHERE status = 'accepted'
      AND (
        (requester_wallet = ${params.viewerAddress} AND addressee_wallet = ${params.targetAddress})
        OR (requester_wallet = ${params.targetAddress} AND addressee_wallet = ${params.viewerAddress})
      );
  `
  return { ok: true }
}
