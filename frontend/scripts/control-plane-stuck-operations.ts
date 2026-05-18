import { getDb } from '../server/_lib/db/postgres.js'

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

async function main() {
  const thresholdMinutes = parsePositiveInt(process.env.CONTROL_PLANE_STUCK_MINUTES, 30, 1, 24 * 60)
  const limit = parsePositiveInt(process.env.CONTROL_PLANE_STUCK_LIMIT, 50, 1, 500)
  const failOnStuck = String(process.env.CONTROL_PLANE_STUCK_FAIL_ON_FOUND ?? '0').trim() === '1'

  const db = await getDb()
  if (!db) throw new Error('db_not_configured')

  let result: { rows: Array<{
    operation_id: string
    operation_kind: string
    status: string
    scope_type: string
    scope_id: string
    age_minutes: number
    updated_at: string
  }> }
  try {
    result = await db.sql<{
      operation_id: string
      operation_kind: string
      status: string
      scope_type: string
      scope_id: string
      age_minutes: number
      updated_at: string
    }>`
      SELECT
        operation_id,
        operation_kind,
        status,
        scope_type,
        scope_id,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60)::int AS age_minutes,
        updated_at
      FROM public.control_plane_operations
      WHERE status IN ('requested','queued','running','blocked','retrying','manual_review')
        AND updated_at <= NOW() - (${thresholdMinutes} || ' minutes')::interval
      ORDER BY updated_at ASC
      LIMIT ${limit};
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/control_plane_operations/i.test(message) && /does not exist|relation/i.test(message)) {
      console.error(
        'control_plane_schema_missing: apply control-plane migrations to DATABASE_URL target before running stuck scan',
      )
      process.exitCode = 2
      return
    }
    throw error
  }

  const rows = result.rows ?? []
  console.log(`control_plane_stuck_scan thresholdMinutes=${thresholdMinutes} count=${rows.length}`)
  for (const row of rows) {
    console.log(
      [
        'control_plane_stuck',
        `operationId=${row.operation_id}`,
        `kind=${row.operation_kind}`,
        `status=${row.status}`,
        `scope=${row.scope_type}:${row.scope_id}`,
        `ageMinutes=${row.age_minutes}`,
        `updatedAt=${row.updated_at}`,
      ].join(' '),
    )
  }

  if (failOnStuck && rows.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

