import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

export function isHermitRoomWelcomeEnabled(): boolean {
  const raw = (process.env.HERMIT_ROOM_WELCOME_ENABLED ?? '1').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

function normalizeWalletAddress(value: string): string | null {
  const trimmed = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) return null
  return trimmed
}

/** Returns true only on the first welcome claim for (room, wallet). */
export async function tryInsertHermitRoomWelcomeSent(params: {
  roomId: string
  senderAddress: string
}): Promise<boolean> {
  if (!isHermitRoomWelcomeEnabled()) return false

  const roomId = String(params.roomId ?? '').trim()
  const senderAddress = normalizeWalletAddress(params.senderAddress)
  if (!roomId || !senderAddress) return false

  const db = await getDb()
  if (!db) return false
  await ensureAlfaClubVigilanteSchema()

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.room_welcome_sent (room_id, sender_address, welcomed_at)
      VALUES (${roomId}, ${senderAddress}, NOW())
      ON CONFLICT (room_id, sender_address) DO NOTHING
      RETURNING room_id;
    `
    return Boolean(result.rows?.length)
  } catch {
    return false
  }
}

export function formatHermitRoomWelcome(params: {
  roomId: string
  username?: string | null
}): string {
  const roomId = String(params.roomId ?? '').trim() || 'unknown'
  const username = String(params.username ?? '').trim()
  const greeting = username ? `Welcome, **${username}**` : 'Welcome'
  return [
    `${greeting} — **Agent Hermit** sees you in room **${roomId}**.`,
    '',
    'Creative bot (read-only, no trades): try `/gmeow`, `/meme`, or `/hermit copy <idea>`.',
    'Send `/help` for the full command list.',
  ].join('\n')
}
