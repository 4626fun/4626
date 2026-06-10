/**
 * Seed alfaclub.room_access_policies from public.alfaclub_rooms_snapshot + alfaclub_creators.
 *
 * Usage (from repo root):
 *   pnpm -C frontend exec tsx scripts/seed-alfaclub-room-policies.ts
 *   pnpm -C frontend exec tsx scripts/seed-alfaclub-room-policies.ts --limit=200 --execute
 *
 * Env:
 *   DATABASE_URL — required
 *   ALFACLUB_DEFAULT_POOL_ADDRESS — optional XYK pool for placeholder policy rows
 */
import { isDbConfigured } from '../server/_lib/db/postgres.js'
import { syncCreatorRoomPoliciesFromSnapshot } from '../server/_lib/alfaclub/roomPolicySync.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code?: number) => never
}

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

  const limitRaw = parseArg('--limit')
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(5000, Number.parseInt(limitRaw, 10)) : 500
  const execute = hasFlag('--execute')

  if (!execute) {
    const preview = await syncCreatorRoomPoliciesFromSnapshot({ limit, dryRun: true })
    console.log(
      JSON.stringify(
        {
          execute: false,
          limit,
          candidateCount: preview.candidateCount,
          note: 'Dry run — pass --execute to upsert policies (enabled=false).',
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  const result = await syncCreatorRoomPoliciesFromSnapshot({ limit, dryRun: false })
  console.log(JSON.stringify({ ok: result.ok, limit, ...result }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
