import { getDb } from './postgres.js'

export type WaitlistLookup = {
  found: boolean
  appAccessStatus: string | null
  joinedAt: string | null
}

export async function lookupWaitlistByFid(fid: number): Promise<WaitlistLookup> {
  if (!Number.isFinite(fid) || fid <= 0) return { found: false, appAccessStatus: null, joinedAt: null }
  const db = await getDb()
  if (!db) return { found: false, appAccessStatus: null, joinedAt: null }

  const result = await db.sql`
    SELECT app_access_status, created_at
    FROM profiles
    WHERE farcaster_fid = ${Math.floor(fid)}
    ORDER BY created_at DESC
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return { found: false, appAccessStatus: null, joinedAt: null }

  const createdAtValue = row.created_at ? new Date(row.created_at) : null
  return {
    found: true,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    joinedAt: createdAtValue && Number.isFinite(createdAtValue.getTime()) ? createdAtValue.toISOString() : null,
  }
}
