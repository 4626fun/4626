import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureMigrationApplied } from '../db/schemaBootstrap.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../db/supabaseAdmin.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export type AgentRegistrationStateRow = {
  agentKey: string
  payloadHash: string
  lensUri: string
  gatewayUrl: string | null
  storageKey: string | null
  updatedAt: string
}

let schemaEnsured = false

export async function ensureAgentRegistrationStateSchema(): Promise<void> {
  if (schemaEnsured) return
  if (!isDbConfigured()) return
  const db = (await getDb()) as unknown as Db | null
  if (!db) return
  try {
    // Authoritative migrations: 20260218152546_create_agent_registration_state.sql
    // + 20260218155022_add_storage_key_to_agent_registration_state.sql
    await ensureMigrationApplied(db as any, '20260218152546_create_agent_registration_state.sql').catch(() => {})
    await ensureMigrationApplied(db as any, '20260218155022_add_storage_key_to_agent_registration_state.sql').catch(() => {})
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
  const storageKeyRaw = String(row?.storage_key ?? '').trim()
  const storageKey = storageKeyRaw || null
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  return { agentKey, payloadHash, lensUri, gatewayUrl, storageKey, updatedAt }
}

export async function getAgentRegistrationState(agentKey: string): Promise<AgentRegistrationStateRow | null> {
  const key = String(agentKey ?? '').trim()
  if (!key) return null

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('agent_registration_state')
      .select('agent_key,payload_hash,lens_uri,gateway_url,storage_key,updated_at')
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
    SELECT agent_key, payload_hash, lens_uri, gateway_url, storage_key, updated_at
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
  storageKey?: string | null
}): Promise<void> {
  const key = String(params.agentKey ?? '').trim()
  const payloadHash = String(params.payloadHash ?? '').trim().toLowerCase()
  const lensUri = String(params.lensUri ?? '').trim()
  const gatewayUrl = params.gatewayUrl ? String(params.gatewayUrl).trim() : null
  const storageKey = params.storageKey ? String(params.storageKey).trim() : null
  if (!key || !payloadHash || !lensUri) return

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('agent_registration_state').upsert(
      {
        agent_key: key,
        payload_hash: payloadHash,
        lens_uri: lensUri,
        gateway_url: gatewayUrl,
        storage_key: storageKey,
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
      storage_key,
      updated_at
    ) VALUES (
      ${key},
      ${payloadHash},
      ${lensUri},
      ${gatewayUrl},
      ${storageKey},
      NOW()
    )
    ON CONFLICT (agent_key)
    DO UPDATE SET
      payload_hash = EXCLUDED.payload_hash,
      lens_uri = EXCLUDED.lens_uri,
      gateway_url = EXCLUDED.gateway_url,
      storage_key = EXCLUDED.storage_key,
      updated_at = NOW();
  `
}
