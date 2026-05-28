/**
 * Seed alfaclub.room_access_policies from public.alfaclub_rooms_snapshot + alfaclub_creators.
 *
 * Links creator wallet addresses (FriendKey metrics address) to canonical room ids so
 * `/alfa`, daily brief, and radar resolve https://alfaclub.app/room/<id> without relying
 * on ops-room chat activity fallback.
 *
 * Usage (from repo root):
 *   pnpm -C frontend exec tsx scripts/seed-alfaclub-room-policies.ts
 *   pnpm -C frontend exec tsx scripts/seed-alfaclub-room-policies.ts --limit=200 --execute
 *
 * Env:
 *   DATABASE_URL — required
 *   ALFACLUB_DEFAULT_POOL_ADDRESS — optional XYK pool for placeholder policy rows (enabled stays false)
 */
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { ensureAlfaClubVigilanteSchema } from '../server/_lib/alfaclub/schema.js'
import { upsertAlfaClubRoomAccessPolicy } from '../server/_lib/alfaclub/roomAccessPolicy.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code?: number) => never
}

const ZERO_POOL = '0x0000000000000000000000000000000000000001'

function parseArg(name: string): string | null {
  const hit = process.argv.find((arg) => arg === name || arg.startsWith(`${name}=`))
  if (!hit) return null
  if (hit.includes('=')) return hit.split('=').slice(1).join('=').trim() || null
  const idx = process.argv.indexOf(hit)
  return process.argv[idx + 1]?.trim() ?? null
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main(): Promise<void> {
  if (!isDbConfigured()) {
    console.error('DATABASE_URL is not configured.')
    process.exit(1)
  }
  const db = await getDb()
  if (!db) {
    console.error('Failed to open database connection.')
    process.exit(1)
  }

  const limitRaw = parseArg('--limit')
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(5000, Number.parseInt(limitRaw, 10)) : 500
  const execute = hasFlag('--execute')
  const poolAddress = (process.env.ALFACLUB_DEFAULT_POOL_ADDRESS ?? ZERO_POOL).trim() as `0x${string}`

  await ensureAlfaClubVigilanteSchema()

  const result = await db.sql`
    SELECT DISTINCT ON (LOWER(c.creator_address))
      s.room_id::text AS room_id,
      c.token_id::text AS token_id,
      LOWER(c.creator_address) AS creator_address
    FROM public.alfaclub_rooms_snapshot s
    INNER JOIN alfaclub_creators c
      ON LOWER(c.creator_address) = LOWER(s.creator_address)
    WHERE s.creator_address IS NOT NULL
      AND LENGTH(TRIM(s.creator_address)) > 0
      AND s.room_id IS NOT NULL
    ORDER BY
      LOWER(c.creator_address),
      CASE WHEN s.room_id::text = c.token_id THEN 0 ELSE 1 END,
      COALESCE((s.raw->'room'->>'volume')::numeric, 0) DESC NULLS LAST
    LIMIT ${limit};
  `

  const rows = (result.rows ?? []) as Array<{
    room_id: string | null
    token_id: string | null
    creator_address: string | null
  }>

  const candidates = rows.filter((row) => {
    const roomId = String(row.room_id ?? '').trim()
    const tokenId = String(row.token_id ?? '').trim()
    const address = String(row.creator_address ?? '').trim().toLowerCase()
    return roomId && tokenId && /^0x[a-f0-9]{40}$/.test(address)
  })

  console.log(
    JSON.stringify(
      {
        execute,
        limit,
        candidateCount: candidates.length,
        poolAddress,
      },
      null,
      2,
    ),
  )

  if (!execute) {
    console.log('Dry run — pass --execute to upsert policies (enabled=false).')
    for (const row of candidates.slice(0, 10)) {
      console.log(`  room ${row.room_id} · token ${row.token_id} · ${row.creator_address}`)
    }
    if (candidates.length > 10) console.log(`  … and ${candidates.length - 10} more`)
    process.exit(0)
  }

  let upserted = 0
  for (const row of candidates) {
    const roomId = String(row.room_id).trim()
    const tokenId = String(row.token_id).trim()
    const creatorAddress = String(row.creator_address).trim().toLowerCase() as `0x${string}`
    await upsertAlfaClubRoomAccessPolicy({
      roomId,
      tokenId,
      creatorCoinAddress: creatorAddress,
      poolAddress,
      enabled: false,
      actorAddress: null,
    })
    upserted += 1
  }

  console.log(JSON.stringify({ ok: true, upserted }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
