type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function isMissingRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
  return message.includes('does not exist') || message.includes('relation') && message.includes('privy_user_aliases')
}

/**
 * Resolve all live profile ids for a Privy user id.
 * Alias rows win over direct `profiles.privy_user_id`; tombstones are chased.
 */
export async function listProfileIdsForPrivyUser(db: Db, privyUserId: string): Promise<number[]> {
  try {
    return await listProfileIdsForPrivyUserWithAliases(db, privyUserId)
  } catch (error) {
    if (!isMissingRelationError(error)) throw error
    return await listProfileIdsForPrivyUserDirectOnly(db, privyUserId)
  }
}

export async function resolvePrimaryProfileIdForPrivyUser(
  db: Db,
  privyUserId: string,
): Promise<number | null> {
  const ids = await listProfileIdsForPrivyUser(db, privyUserId)
  return ids[0] ?? null
}

async function listProfileIdsForPrivyUserWithAliases(db: Db, privyUserId: string): Promise<number[]> {
  const rows = await db.sql`
    WITH direct AS (
      SELECT p.id, p.merged_into_profile_id, p.updated_at, p.created_at
      FROM profiles p
      WHERE p.id IN (SELECT profile_id FROM privy_user_aliases WHERE privy_user_id = ${privyUserId})
         OR p.privy_user_id = ${privyUserId}
    ),
    resolved AS (
      SELECT p2.id, p2.updated_at, p2.created_at
      FROM direct d
      JOIN profiles p2
        ON p2.id = COALESCE(d.merged_into_profile_id, d.id)
      WHERE p2.merged_into_profile_id IS NULL
    )
    SELECT DISTINCT id, updated_at, created_at FROM resolved
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC;
  `
  return collectDistinctProfileIds(rows.rows ?? [])
}

async function listProfileIdsForPrivyUserDirectOnly(db: Db, privyUserId: string): Promise<number[]> {
  const rows = await db.sql`
    WITH matched AS (
      SELECT id, merged_into_profile_id, updated_at, created_at
      FROM profiles
      WHERE privy_user_id = ${privyUserId}
    )
    SELECT p.id, p.updated_at, p.created_at
    FROM matched m
    JOIN profiles p ON p.id = COALESCE(m.merged_into_profile_id, m.id)
    WHERE p.merged_into_profile_id IS NULL
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id DESC;
  `
  return collectDistinctProfileIds(rows.rows ?? [])
}

function collectDistinctProfileIds(rows: any[]): number[] {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const row of rows) {
    const idRaw = row?.id
    const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
    if (!Number.isFinite(id) || id <= 0) continue
    const floored = Math.floor(id)
    if (seen.has(floored)) continue
    seen.add(floored)
    ids.push(floored)
  }
  return ids
}
