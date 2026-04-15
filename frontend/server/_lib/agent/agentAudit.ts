import { getDb, isDbConfigured } from '../postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false

async function ensureSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  schemaEnsured = true
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS agent_api_logs (
        id BIGSERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        ip_hash TEXT NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
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

  try {
    await (db as any).sql`
      INSERT INTO agent_api_logs (endpoint, method, ip_hash, user_agent)
      VALUES (${params.endpoint}, ${params.method}, ${ipHash}, ${ua || null});
    `
  } catch {
    // Never block request handling on audit logs.
  }
}

