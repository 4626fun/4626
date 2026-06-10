import { getDb } from '../db/postgres.js'
import { ensureTelemetryCreativeLogsSchema } from '../db/schemaBootstrap.js'

type DbRow = Record<string, unknown>

export type HermitMemeRecord = {
  id: number
  ownerAddress: string
  roomId: string
  cid: string | null
  url: string
  caption: string
  tags: string[]
  createdBy: string
  createdAt: string
}

let hermitSchemaEnsured = false

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .slice(0, 12)
}

function mapMemeRow(row: DbRow): HermitMemeRecord {
  return {
    id: asNumber(row.id),
    ownerAddress: asString(row.owner_address),
    roomId: asString(row.room_id),
    cid: asString(row.cid) || null,
    url: asString(row.url),
    caption: asString(row.caption),
    tags: normalizeTags(row.tags),
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at),
  }
}

export async function ensureHermitSchema(): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  if (hermitSchemaEnsured) return true

  await ensureTelemetryCreativeLogsSchema(db as any)
  hermitSchemaEnsured = true
  return true
}

export async function createHermitMeme(params: {
  ownerAddress: string
  roomId: string
  cid: string | null
  url: string
  caption: string
  tags: string[]
  createdBy: string
}): Promise<HermitMemeRecord | null> {
  if (!(await ensureHermitSchema())) return null
  const db = await getDb()
  if (!db) return null
  const tagsJson = JSON.stringify(params.tags ?? [])
  const inserted = await db.sql`
    INSERT INTO hermit_memes (
      owner_address,
      room_id,
      cid,
      url,
      caption,
      tags,
      created_by
    ) VALUES (
      ${params.ownerAddress},
      ${params.roomId},
      ${params.cid},
      ${params.url},
      ${params.caption},
      ${tagsJson}::jsonb,
      ${params.createdBy}
    )
    RETURNING
      id,
      owner_address,
      room_id,
      cid,
      url,
      caption,
      tags,
      created_by,
      created_at;
  `
  return inserted.rows[0] ? mapMemeRow(inserted.rows[0] as DbRow) : null
}

export async function listHermitMemes(params: {
  roomId: string
  limit: number
  tag?: string
}): Promise<HermitMemeRecord[]> {
  if (!(await ensureHermitSchema())) return []
  const db = await getDb()
  if (!db) return []

  if (params.tag?.trim()) {
    const result = await db.sql`
      SELECT
        id,
        owner_address,
        room_id,
        cid,
        url,
        caption,
        tags,
        created_by,
        created_at
      FROM hermit_memes
      WHERE deleted_at IS NULL
        AND room_id = ${params.roomId}
        AND tags ? ${params.tag.trim().toLowerCase()}
      ORDER BY created_at DESC
      LIMIT ${params.limit};
    `
    return result.rows.map((row) => mapMemeRow(row as DbRow))
  }

  const result = await db.sql`
    SELECT
      id,
      owner_address,
      room_id,
      cid,
      url,
      caption,
      tags,
      created_by,
      created_at
    FROM hermit_memes
    WHERE deleted_at IS NULL
      AND room_id = ${params.roomId}
    ORDER BY created_at DESC
    LIMIT ${params.limit};
  `
  return result.rows.map((row) => mapMemeRow(row as DbRow))
}

export async function softDeleteHermitMeme(params: {
  id: number
  ownerAddress: string
  roomId: string
}): Promise<boolean> {
  if (!(await ensureHermitSchema())) return false
  const db = await getDb()
  if (!db) return false
  const result = await db.sql`
    UPDATE hermit_memes
    SET deleted_at = NOW()
    WHERE id = ${params.id}
      AND owner_address = ${params.ownerAddress}
      AND room_id = ${params.roomId}
      AND deleted_at IS NULL;
  `
  return Number(result.rowCount ?? 0) > 0
}
