import { getDb } from '../db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

declare const process: { env: Record<string, string | undefined> }

export type HermitCooldownCommand = 'gmeow' | 'meme'

const DEFAULT_GMEOW_COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_MEME_COOLDOWN_MS = 10 * 60 * 1000

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const value = (raw ?? '').trim()
  if (!/^\d+$/.test(value)) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export function readHermitCommandCooldownMs(command: HermitCooldownCommand): number {
  if (command === 'gmeow') {
    return parsePositiveInt(process.env.HERMIT_GMEOW_COOLDOWN_MS, DEFAULT_GMEOW_COOLDOWN_MS, 3_600_000)
  }
  return parsePositiveInt(process.env.HERMIT_MEME_COOLDOWN_MS, DEFAULT_MEME_COOLDOWN_MS, 3_600_000)
}

export function isHermitCommandCooldownEnabled(): boolean {
  const raw = (process.env.HERMIT_COMMAND_COOLDOWN_ENABLED ?? '1').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

export function resolveHermitCooldownCommand(text: string): HermitCooldownCommand | null {
  const head = String(text ?? '').trim().split(/\s+/, 1)[0]?.toLowerCase() ?? ''
  if (head === '/gmeow' || head.startsWith('/gmeow@')) return 'gmeow'
  if (head === '/meme' || head.startsWith('/meme@')) return 'meme'
  return null
}

export async function checkHermitCommandCooldown(params: {
  roomId: string
  senderAddress: string
  command: HermitCooldownCommand
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  if (!isHermitCommandCooldownEnabled()) return { ok: true }

  const roomId = params.roomId.trim()
  const sender = params.senderAddress.trim().toLowerCase()
  if (!roomId || !/^0x[a-f0-9]{40}$/.test(sender)) return { ok: true }

  const db = await getDb()
  if (!db) return { ok: true }

  const cooldownMs = readHermitCommandCooldownMs(params.command)
  try {
    const result = await db.sql`
      SELECT last_invoked_at
      FROM alfaclub.hermit_command_cooldown
      WHERE room_id = ${roomId}
        AND LOWER(sender_address) = ${sender}
        AND command_key = ${params.command}
      LIMIT 1;
    `
    const row = (result.rows ?? [])[0] as { last_invoked_at?: string | Date } | undefined
    if (!row?.last_invoked_at) return { ok: true }
    const lastMs = Date.parse(String(row.last_invoked_at))
    if (!Number.isFinite(lastMs)) return { ok: true }
    const elapsed = Date.now() - lastMs
    if (elapsed >= cooldownMs) return { ok: true }
    const retryAfterSec = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000))
    return { ok: false, retryAfterSec }
  } catch {
    return { ok: true }
  }
}

export async function recordHermitCommandCooldown(params: {
  roomId: string
  senderAddress: string
  command: HermitCooldownCommand
}): Promise<void> {
  if (!isHermitCommandCooldownEnabled()) return

  const roomId = params.roomId.trim()
  const sender = params.senderAddress.trim().toLowerCase()
  if (!roomId || !/^0x[a-f0-9]{40}$/.test(sender)) return

  const db = await getDb()
  if (!db) return
  await ensureAlfaClubVigilanteSchema()

  try {
    await db.sql`
      INSERT INTO alfaclub.hermit_command_cooldown (
        room_id,
        sender_address,
        command_key,
        last_invoked_at
      ) VALUES (
        ${roomId},
        ${sender},
        ${params.command},
        NOW()
      )
      ON CONFLICT (room_id, sender_address, command_key) DO UPDATE SET
        last_invoked_at = EXCLUDED.last_invoked_at;
    `
  } catch {
    // Best-effort throttle ledger.
  }
}
