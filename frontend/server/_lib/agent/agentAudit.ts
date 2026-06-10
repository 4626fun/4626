import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureAgentRuntimeAuditLedgerSchema } from '../db/schemaBootstrap.js'
import { shouldSampleEvent } from '../infra/telemetrySampling.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false

async function ensureSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  schemaEnsured = true
  try {
    await ensureAgentRuntimeAuditLedgerSchema(db as any)
  } catch {
    schemaEnsured = false
  }
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null
  let hash = 0x811c9dc5
  for (let i = 0; i < ip.length; i++) {
    hash ^= ip.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export async function logAgentApiRequest(params: {
  endpoint: string
  method: string
  ip?: string
  userAgent?: string
}): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  await ensureSchema(db as any)

  const ipHash = hashIp(params.ip)
  const ua = (params.userAgent ?? '').slice(0, 400)

  // Agent API audit log is high-volume. Sample by (endpoint, ip) for debuggable per-client traces.
  const sampleKey = `${params.endpoint}:${ipHash ?? 'no-ip'}`
  if (!shouldSampleEvent('agent_api_logs', sampleKey)) {
    return
  }

  try {
    await (db as any).sql`
      INSERT INTO agent_api_logs (endpoint, method, ip_hash, user_agent)
      VALUES (${params.endpoint}, ${params.method}, ${ipHash}, ${ua || null});
    `
  } catch {
    // Never block request handling on audit logs.
  }
}

