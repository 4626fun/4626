import { logger } from '../infra/logger.js'
import { getDb } from '../db/postgres.js'
import { ensureAlfaclubPositionAlertSchema } from '../db/schemaBootstrap.js'

declare const process: { env: Record<string, string | undefined> }
let warnedMissingPositionAlertTable = false

type PgLikeError = { code?: string; message?: string }

/** Wallet-scoped Hyperliquid alerts — not tied to an AlfaClub room. */
export const HL_POSITION_ALERT_SCOPE = 'hyperliquid'

export type PositionAlertConfig = {
  roomId: string
  senderAddress: string
  enabled: boolean
  telegramEnabled: boolean
  liquidationWarnPct: number | null
  targetPnlUsd: number | null
  targetProgressPct: number
  lastLiqAlertAt: string | null
  lastTargetAlertAt: string | null
  updatedAt: string
}

type AlertRow = {
  room_id: string
  sender_address: string
  enabled: boolean
  telegram_enabled: boolean
  liquidation_warn_pct: string | null
  target_pnl_usd: string | null
  target_progress_pct: string
  last_liq_alert_at: string | null
  last_target_alert_at: string | null
  updated_at: string
}

function normalizeRoomId(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null
}

function normalizeAddress(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null
}

function parseOptionalPct(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}

function parseOptionalUsd(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function rowToConfig(row: AlertRow): PositionAlertConfig {
  return {
    roomId: row.room_id,
    senderAddress: row.sender_address,
    enabled: row.enabled,
    telegramEnabled: row.telegram_enabled,
    liquidationWarnPct: row.liquidation_warn_pct != null ? Number(row.liquidation_warn_pct) : null,
    targetPnlUsd: row.target_pnl_usd != null ? Number(row.target_pnl_usd) : null,
    targetProgressPct: Number(row.target_progress_pct) || 90,
    lastLiqAlertAt: row.last_liq_alert_at,
    lastTargetAlertAt: row.last_target_alert_at,
    updatedAt: row.updated_at,
  }
}

async function hasPositionAlertTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<boolean> {
  try {
    const result = await db.sql`
      SELECT to_regclass('alfaclub.position_alert') IS NOT NULL AS has_table;
    `
    return Boolean(result.rows?.[0]?.has_table)
  } catch {
    return false
  }
}

function isMissingPositionAlertRelation(error: unknown): boolean {
  const candidate = error as PgLikeError | null | undefined
  if (!candidate) return false
  if (candidate.code === '42P01') return true
  return String(candidate.message ?? '').includes('alfaclub.position_alert')
}

export async function readHyperliquidPositionAlert(
  senderAddress: string,
): Promise<PositionAlertConfig | null> {
  return readPositionAlert({ roomId: HL_POSITION_ALERT_SCOPE, senderAddress })
}

export async function upsertHyperliquidPositionAlert(
  params: Omit<Parameters<typeof upsertPositionAlert>[0], 'roomId'>,
): Promise<PositionAlertConfig | null> {
  return upsertPositionAlert({ ...params, roomId: HL_POSITION_ALERT_SCOPE })
}

export async function disableHyperliquidPositionAlert(senderAddress: string): Promise<boolean> {
  return disablePositionAlert({ roomId: HL_POSITION_ALERT_SCOPE, senderAddress })
}

export async function readPositionAlert(params: {
  roomId: string
  senderAddress: string
}): Promise<PositionAlertConfig | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null

  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubPositionAlertSchema(db)
  const tableExists = await hasPositionAlertTable(db)
  if (!tableExists) return null

  const result = await db.sql`
    SELECT room_id, sender_address, enabled, telegram_enabled,
           liquidation_warn_pct, target_pnl_usd, target_progress_pct,
           last_liq_alert_at, last_target_alert_at, updated_at
    FROM alfaclub.position_alert
    WHERE room_id = ${roomId} AND sender_address = ${senderAddress}
    LIMIT 1;
  `
  const row = result.rows[0] as AlertRow | undefined
  return row ? rowToConfig(row) : null
}

export async function upsertPositionAlert(params: {
  roomId: string
  senderAddress: string
  enabled?: boolean
  telegramEnabled?: boolean
  liquidationWarnPct?: number | null
  targetPnlUsd?: number | null
  targetProgressPct?: number | null
}): Promise<PositionAlertConfig | null> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return null

  const db = await getDb()
  if (!db) return null
  await ensureAlfaclubPositionAlertSchema(db)
  const tableExists = await hasPositionAlertTable(db)
  if (!tableExists) return null

  const existing = await readPositionAlert({ roomId, senderAddress })

  const enabled = params.enabled ?? existing?.enabled ?? true
  const telegramEnabled = params.telegramEnabled ?? existing?.telegramEnabled ?? false
  const liquidationWarnPct =
    params.liquidationWarnPct !== undefined
      ? params.liquidationWarnPct
      : (existing?.liquidationWarnPct ?? null)
  const targetPnlUsd =
    params.targetPnlUsd !== undefined ? params.targetPnlUsd : (existing?.targetPnlUsd ?? null)
  const targetProgressPct =
    params.targetProgressPct ?? existing?.targetProgressPct ?? 90

  try {
    const result = await db.sql`
      INSERT INTO alfaclub.position_alert (
        room_id, sender_address, enabled, telegram_enabled,
        liquidation_warn_pct, target_pnl_usd, target_progress_pct, updated_at
      ) VALUES (
        ${roomId}, ${senderAddress}, ${enabled}, ${telegramEnabled},
        ${liquidationWarnPct}, ${targetPnlUsd}, ${targetProgressPct}, NOW()
      )
      ON CONFLICT (room_id, sender_address) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        telegram_enabled = EXCLUDED.telegram_enabled,
        liquidation_warn_pct = EXCLUDED.liquidation_warn_pct,
        target_pnl_usd = EXCLUDED.target_pnl_usd,
        target_progress_pct = EXCLUDED.target_progress_pct,
        updated_at = NOW()
      RETURNING room_id, sender_address, enabled, telegram_enabled,
                liquidation_warn_pct, target_pnl_usd, target_progress_pct,
                last_liq_alert_at, last_target_alert_at, updated_at;
    `
    const row = result.rows[0] as AlertRow | undefined
    return row ? rowToConfig(row) : null
  } catch (error) {
    logger.warn('position_alert.upsert_failed', {
      roomId,
      senderAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function disablePositionAlert(params: {
  roomId: string
  senderAddress: string
}): Promise<boolean> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return false

  const db = await getDb()
  if (!db) return false
  await ensureAlfaclubPositionAlertSchema(db)
  const tableExists = await hasPositionAlertTable(db)
  if (!tableExists) return false

  try {
    await db.sql`
      UPDATE alfaclub.position_alert
      SET enabled = FALSE, updated_at = NOW()
      WHERE room_id = ${roomId} AND sender_address = ${senderAddress};
    `
    return true
  } catch {
    return false
  }
}

export async function listEnabledPositionAlerts(limit = 200): Promise<PositionAlertConfig[]> {
  try {
    const db = await getDb()
    if (!db) return []
    await ensureAlfaclubPositionAlertSchema(db)
    const tableExists = await hasPositionAlertTable(db)
    if (!tableExists) {
      if (!warnedMissingPositionAlertTable) {
        warnedMissingPositionAlertTable = true
        logger.warn('position_alert.table_missing', {
          message: 'alfaclub.position_alert is missing; returning empty alert set',
        })
      }
      return []
    }
    warnedMissingPositionAlertTable = false

    const capped = Math.min(Math.max(1, limit), 500)
    const result = await db.sql`
      SELECT room_id, sender_address, enabled, telegram_enabled,
             liquidation_warn_pct, target_pnl_usd, target_progress_pct,
             last_liq_alert_at, last_target_alert_at, updated_at
      FROM alfaclub.position_alert
      WHERE enabled = TRUE
        AND (
          liquidation_warn_pct IS NOT NULL
          OR target_pnl_usd IS NOT NULL
        )
      ORDER BY updated_at DESC
      LIMIT ${capped};
    `
    return (result.rows as AlertRow[]).map(rowToConfig)
  } catch (error) {
    if (isMissingPositionAlertRelation(error)) {
      if (!warnedMissingPositionAlertTable) {
        warnedMissingPositionAlertTable = true
        logger.warn('position_alert.table_missing', {
          message: 'alfaclub.position_alert is missing; returning empty alert set',
        })
      }
      return []
    }
    logger.warn('position_alert.list_enabled_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function markPositionAlertFired(params: {
  roomId: string
  senderAddress: string
  kind: 'liq' | 'target'
}): Promise<void> {
  const roomId = normalizeRoomId(params.roomId)
  const senderAddress = normalizeAddress(params.senderAddress)
  if (!roomId || !senderAddress) return

  const db = await getDb()
  if (!db) return

  if (params.kind === 'liq') {
    await db.sql`
      UPDATE alfaclub.position_alert
      SET last_liq_alert_at = NOW(), updated_at = NOW()
      WHERE room_id = ${roomId} AND sender_address = ${senderAddress};
    `
    return
  }
  await db.sql`
    UPDATE alfaclub.position_alert
    SET last_target_alert_at = NOW(), updated_at = NOW()
    WHERE room_id = ${roomId} AND sender_address = ${senderAddress};
  `
}

export type ParsedAlertCommand =
  | { action: 'status' }
  | { action: 'default' }
  | { action: 'off' }
  | { action: 'test' }
  | { action: 'telegram'; enabled: boolean }
  | { action: 'liq'; pct: number }
  | { action: 'target'; usd: number }
  | { action: 'progress'; pct: number }
  | { action: 'invalid'; reason: string }

export type HyperliquidAlertDefaults = {
  liquidationWarnPct: number
  targetPnlUsd: number | null
  targetProgressPct: number
}

/** Default HL alert bundle — overridable via env on Vercel. */
export function readHyperliquidAlertDefaults(): HyperliquidAlertDefaults {
  const liq = parseOptionalPct(process.env.HL_ALERT_DEFAULT_LIQ_PCT ?? '10') ?? 10
  const targetRaw = process.env.HL_ALERT_DEFAULT_TARGET_PNL_USD ?? '5000'
  const targetTrimmed = targetRaw.trim()
  const targetPnlUsd =
    targetTrimmed === '' || targetTrimmed === '0'
      ? null
      : parseOptionalUsd(targetTrimmed.replace(/[$,]/g, ''))
  const targetProgressPct =
    parseOptionalPct(process.env.HL_ALERT_DEFAULT_TARGET_PROGRESS_PCT ?? '90') ?? 90
  return { liquidationWarnPct: liq, targetPnlUsd, targetProgressPct }
}

export function describeHyperliquidAlertDefaults(defaults = readHyperliquidAlertDefaults()): string[] {
  const lines = [`• Liquidation: within **${defaults.liquidationWarnPct}%** on any HL leg`]
  if (defaults.targetPnlUsd != null) {
    lines.push(
      `• Target PnL: **+$${defaults.targetPnlUsd.toLocaleString('en-US')}** combined (fire at **${defaults.targetProgressPct}%**)`,
    )
  }
  return lines
}

export async function enableDefaultHyperliquidPositionAlert(
  senderAddress: string,
  options?: { telegramEnabled?: boolean },
): Promise<PositionAlertConfig | null> {
  const defaults = readHyperliquidAlertDefaults()
  return upsertHyperliquidPositionAlert({
    senderAddress,
    enabled: true,
    liquidationWarnPct: defaults.liquidationWarnPct,
    targetPnlUsd: defaults.targetPnlUsd,
    targetProgressPct: defaults.targetProgressPct,
    ...(options?.telegramEnabled != null ? { telegramEnabled: options.telegramEnabled } : {}),
  })
}

export function parseHermitAlertCommandArgs(args: string): ParsedAlertCommand {
  const trimmed = args.trim()
  if (trimmed.toLowerCase() === 'status') return { action: 'status' }
  if (!trimmed || /^(on|enable|default|start)$/i.test(trimmed)) return { action: 'default' }
  if (/^(off|disable|stop)$/i.test(trimmed)) return { action: 'off' }
  if (/^test$/i.test(trimmed)) return { action: 'test' }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  const head = (parts[0] ?? '').toLowerCase()

  if (head === 'telegram') {
    const mode = (parts[1] ?? 'on').toLowerCase()
    if (mode === 'off' || mode === 'disable') return { action: 'telegram', enabled: false }
    return { action: 'telegram', enabled: true }
  }

  if (head === 'liq' || head === 'liquidation') {
    const pct = parseOptionalPct(parts[1])
    if (pct == null) {
      return {
        action: 'invalid',
        reason:
          'Usage: `/hermit alert liq <percent>` — e.g. `10` warns within 10% of liquidation on any HL leg.',
      }
    }
    return { action: 'liq', pct }
  }

  if (head === 'target' || head === 'gain') {
    const usd = parseOptionalUsd(parts[1]?.replace(/[$,]/g, ''))
    if (usd == null) {
      return {
        action: 'invalid',
        reason: 'Usage: `/hermit alert target <usd>` — e.g. `5000` for +$5,000 unrealized PnL target.',
      }
    }
    return { action: 'target', usd }
  }

  if (head === 'progress') {
    const pct = parseOptionalPct(parts[1])
    if (pct == null) {
      return {
        action: 'invalid',
        reason: 'Usage: `/hermit alert progress <percent>` — e.g. `80` alerts at 80% of your target gain.',
      }
    }
    return { action: 'progress', pct }
  }

  return {
    action: 'invalid',
    reason:
      'Usage: `/hermit alert` (defaults) · `status` · `off` · optional `liq 10` · `target 5000`',
  }
}

export async function resolveTelegramChatIdForWallet(walletAddress: string): Promise<string | null> {
  const address = normalizeAddress(walletAddress)
  if (!address) return null

  const db = await getDb()
  if (!db) return null

  try {
    const result = await db.sql`
      SELECT l.telegram_user_id
      FROM telegram_user_links l
      INNER JOIN profile_wallets pw ON pw.profile_id = l.profile_id
      WHERE lower(pw.address) = ${address}
      ORDER BY l.updated_at DESC NULLS LAST, l.linked_at DESC
      LIMIT 1;
    `
    const row = result.rows[0] as { telegram_user_id?: string | number } | undefined
    if (row?.telegram_user_id == null) return null
    return String(row.telegram_user_id)
  } catch {
    return null
  }
}
