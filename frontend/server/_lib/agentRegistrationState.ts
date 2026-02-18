import { getDb, isDbConfigured } from './postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabaseAdmin.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export type AgentRegistrationStateRow = {
  agentKey: string
  payloadHash: string
  lensUri: string
  gatewayUrl: string | null
  updatedAt: string
}

let schemaEnsured = false

export async function ensureAgentRegistrationStateSchema(): Promise<void> {
  if (schemaEnsured) return
  if (!isDbConfigured()) return
  const db = (await getDb()) as unknown as Db | null
  if (!db) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS agent_registration_state (
        agent_key TEXT PRIMARY KEY,
        payload_hash TEXT NOT NULL,
        lens_uri TEXT NOT NULL,
        gateway_url TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS agent_registration_state_updated_idx ON agent_registration_state (updated_at DESC);`
    schemaEnsured = true
  } catch {
    schemaEnsured = false
    throw new Error('agent_registration_state_schema_failed')
  }
}

function normalizeRow(row: any): AgentRegistrationStateRow | null {
  const agentKey = String(row?.agent_key ?? '').trim()
  const payloadHash = String(row?.payload_hash ?? '').trim().toLowerCase()
  const lensUri = String(row?.lens_uri ?? '').trim()
  if (!agentKey || !payloadHash || !lensUri) return null
  const gatewayUrlRaw = String(row?.gateway_url ?? '').trim()
  const gatewayUrl = gatewayUrlRaw || null
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  return { agentKey, payloadHash, lensUri, gatewayUrl, updatedAt }
}

export async function getAgentRegistrationState(agentKey: string): Promise<AgentRegistrationStateRow | null> {
  const key = String(agentKey ?? '').trim()
  if (!key) return null

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('agent_registration_state')
      .select('agent_key,payload_hash,lens_uri,gateway_url,updated_at')
      .eq('agent_key', key)
      .maybeSingle()
    if (error) throw new Error(`agent_registration_state_read_failed:${error.message}`)
    return normalizeRow(data)
  }

  if (!isDbConfigured()) return null
  const db = (await getDb()) as unknown as Db | null
  if (!db) return null
  await ensureAgentRegistrationStateSchema()
  const res = await db.sql`
    SELECT agent_key, payload_hash, lens_uri, gateway_url, updated_at
    FROM agent_registration_state
    WHERE agent_key = ${key}
    LIMIT 1;
  `
  return normalizeRow(res.rows?.[0] ?? null)
}

export async function upsertAgentRegistrationState(params: {
  agentKey: string
  payloadHash: string
  lensUri: string
  gatewayUrl?: string | null
}): Promise<void> {
  const key = String(params.agentKey ?? '').trim()
  const payloadHash = String(params.payloadHash ?? '').trim().toLowerCase()
  const lensUri = String(params.lensUri ?? '').trim()
  const gatewayUrl = params.gatewayUrl ? String(params.gatewayUrl).trim() : null
  if (!key || !payloadHash || !lensUri) return

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('agent_registration_state').upsert(
      {
        agent_key: key,
        payload_hash: payloadHash,
        lens_uri: lensUri,
        gateway_url: gatewayUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_key' },
    )
    if (error) throw new Error(`agent_registration_state_upsert_failed:${error.message}`)
    return
  }

  if (!isDbConfigured()) return
  const db = (await getDb()) as unknown as Db | null
  if (!db) return
  await ensureAgentRegistrationStateSchema()
  await db.sql`
    INSERT INTO agent_registration_state (
      agent_key,
      payload_hash,
      lens_uri,
      gateway_url,
      updated_at
    ) VALUES (
      ${key},
      ${payloadHash},
      ${lensUri},
      ${gatewayUrl},
      NOW()
    )
    ON CONFLICT (agent_key)
    DO UPDATE SET
      payload_hash = EXCLUDED.payload_hash,
      lens_uri = EXCLUDED.lens_uri,
      gateway_url = EXCLUDED.gateway_url,
      updated_at = NOW();
  `
}
