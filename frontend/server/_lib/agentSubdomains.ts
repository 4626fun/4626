import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type AgentSubdomainRecord = {
  id: number
  parentId: string
  parentDomain: string
  fullName: string
  label: string
  fqdn: string
  subdomainId: string | null
  chainId: number
  ownerAddress: string
  controllerAddress: string | null
  metadata: Record<string, unknown> | null
  metadataLensUri: string | null
  metadataGatewayUrl: string | null
  metadataStorageKey: string | null
  lensHandle: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  source: string
  txHash: string | null
  blockNumber: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type UpsertAgentSubdomainInput = {
  parentId: string
  parentDomain: string
  label: string
  subdomainId?: string | null
  chainId?: number
  ownerAddress: string
  controllerAddress?: string | null
  metadata?: Record<string, unknown> | null
  metadataLensUri?: string | null
  metadataGatewayUrl?: string | null
  metadataStorageKey?: string | null
  lensHandle?: string | null
  lensAccountAddress?: string | null
  lensOwnerAddress?: string | null
  source?: string
  txHash?: string | null
  blockNumber?: string | null
  active?: boolean
}

let schemaEnsured = false

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '')
}

function normalizeParentDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.+$/, '')
}

function toIsoString(value: unknown): string {
  if (!value) return new Date(0).toISOString()
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString()
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNullableLower(value: unknown): string | null {
  const v = normalizeNullableString(value)
  return v ? v.toLowerCase() : null
}

function mapRow(row: any): AgentSubdomainRecord {
  return {
    id: Number(row.id),
    parentId: String(row.parent_id ?? ''),
    parentDomain: String(row.parent_domain ?? ''),
    fullName: String(row.full_name ?? ''),
    label: String(row.label ?? ''),
    fqdn: String(row.fqdn ?? ''),
    subdomainId: normalizeNullableString(row.subdomain_id),
    chainId: Number(row.chain_id ?? 1) || 1,
    ownerAddress: String(row.owner_address ?? '').toLowerCase(),
    controllerAddress: normalizeNullableLower(row.controller_address),
    metadata:
      row.metadata_json && typeof row.metadata_json === 'object' && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : null,
    metadataLensUri: normalizeNullableString(row.metadata_lens_uri),
    metadataGatewayUrl: normalizeNullableString(row.metadata_gateway_url),
    metadataStorageKey: normalizeNullableString(row.metadata_storage_key),
    lensHandle: normalizeNullableString(row.lens_handle),
    lensAccountAddress: normalizeNullableLower(row.lens_account_address),
    lensOwnerAddress: normalizeNullableLower(row.lens_owner_address),
    source: String(row.source ?? 'manual'),
    txHash: normalizeNullableString(row.tx_hash),
    blockNumber: normalizeNullableString(row.block_number),
    active: Boolean(row.active),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

export function getDefaultParentId(): string {
  const raw = String(process.env.SUBDOMAIN_PARENT_ID ?? process.env.AGENT_SUBDOMAIN_PARENT_ID ?? '0').trim()
  return raw || '0'
}

export function getDefaultParentDomain(): string {
  const raw = String(process.env.SUBDOMAIN_PARENT_DOMAIN ?? process.env.AGENT_SUBDOMAIN_PARENT_DOMAIN ?? '4626.wei').trim()
  return normalizeParentDomain(raw || '4626.wei')
}

export function getSubdomainWebApexes(): string[] {
  const raw = String(process.env.AGENT_SUBDOMAIN_WEB_APEXES ?? '4626.fun,app.4626.fun').trim()
  const out = raw
    .split(/[\s,]+/g)
    .map(normalizeParentDomain)
    .filter(Boolean)
  return Array.from(new Set(out)).sort((a, b) => b.length - a.length)
}

export function getReservedSubdomainLabels(): Set<string> {
  const raw = String(process.env.AGENT_SUBDOMAIN_RESERVED_LABELS ?? 'www,app,api').trim().toLowerCase()
  const out = raw
    .split(/[\s,]+/g)
    .map((v) => v.trim())
    .filter(Boolean)
  return new Set(out)
}

export function isReservedSubdomainLabel(label: string): boolean {
  return getReservedSubdomainLabels().has(label.trim().toLowerCase())
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function normalizeSubdomainLabel(raw: string): string {
  const value = raw.trim().toLowerCase()
  // RFC-compatible hostname label subset.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) return ''
  return value
}

export function deriveLabelFromHost(hostRaw: string, apexes: string[] = getSubdomainWebApexes()): string | null {
  const host = normalizeHost(hostRaw)
  if (!host) return null
  for (const apex of apexes) {
    const normalizedApex = normalizeParentDomain(apex)
    if (!normalizedApex) continue
    if (host === normalizedApex) continue
    if (!host.endsWith(`.${normalizedApex}`)) continue
    const candidate = host.slice(0, -1 * (`.${normalizedApex}`.length))
    if (!candidate || candidate.includes('.')) continue
    const label = normalizeSubdomainLabel(candidate)
    if (!label || isReservedSubdomainLabel(label)) continue
    return label || null
  }
  return null
}

export function readHostFromRequest(req: VercelRequest): string {
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').trim()
  const host = String(req.headers.host ?? '').trim()
  return normalizeHost(forwardedHost || host)
}

export function buildFqdn(label: string, parentDomain: string): string {
  return `${normalizeSubdomainLabel(label)}.${normalizeParentDomain(parentDomain)}`
}

export async function ensureAgentSubdomainsSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS agent_subdomains (
        id BIGSERIAL PRIMARY KEY,
        parent_id TEXT NOT NULL,
        parent_domain TEXT NOT NULL,
        full_name TEXT NOT NULL,
        label TEXT NOT NULL,
        fqdn TEXT NOT NULL,
        subdomain_id TEXT NULL,
        chain_id INTEGER NOT NULL DEFAULT 1,
        owner_address TEXT NOT NULL,
        controller_address TEXT NULL,
        metadata_json JSONB NULL,
        metadata_lens_uri TEXT NULL,
        metadata_gateway_url TEXT NULL,
        metadata_storage_key TEXT NULL,
        lens_handle TEXT NULL,
        lens_account_address TEXT NULL,
        lens_owner_address TEXT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        tx_hash TEXT NULL,
        block_number TEXT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS agent_subdomains_parent_label_unique ON agent_subdomains (parent_id, label);`
    await db.sql`CREATE UNIQUE INDEX IF NOT EXISTS agent_subdomains_fqdn_unique ON agent_subdomains (fqdn);`
    await db.sql`CREATE INDEX IF NOT EXISTS agent_subdomains_owner_idx ON agent_subdomains (owner_address);`
    await db.sql`CREATE INDEX IF NOT EXISTS agent_subdomains_lens_owner_idx ON agent_subdomains (lens_owner_address);`
    await db.sql`CREATE INDEX IF NOT EXISTS agent_subdomains_updated_idx ON agent_subdomains (updated_at DESC);`
    await db.sql`ALTER TABLE agent_subdomains ALTER COLUMN chain_id SET DEFAULT 1;`
    schemaEnsured = true
  } catch {
    schemaEnsured = false
    throw new Error('agent_subdomains_schema_ensure_failed')
  }
}

export async function upsertAgentSubdomain(db: Db, input: UpsertAgentSubdomainInput): Promise<AgentSubdomainRecord> {
  const label = normalizeSubdomainLabel(input.label)
  if (!label) throw new Error('invalid_label')

  const parentId = String(input.parentId ?? '').trim() || getDefaultParentId()
  const parentDomain = normalizeParentDomain(input.parentDomain || getDefaultParentDomain())
  const fqdn = `${label}.${parentDomain}`
  const fullName = fqdn

  const ownerAddress = String(input.ownerAddress ?? '').trim().toLowerCase()
  if (!isAddressLike(ownerAddress)) throw new Error('invalid_owner_address')

  const chainId = Number(input.chainId ?? 1)
  if (!Number.isFinite(chainId) || chainId <= 0) throw new Error('invalid_chain_id')

  const source = (String(input.source ?? 'manual').trim() || 'manual').slice(0, 64)

  const result = await db.sql`
    INSERT INTO agent_subdomains (
      parent_id,
      parent_domain,
      full_name,
      label,
      fqdn,
      subdomain_id,
      chain_id,
      owner_address,
      controller_address,
      metadata_json,
      metadata_lens_uri,
      metadata_gateway_url,
      metadata_storage_key,
      lens_handle,
      lens_account_address,
      lens_owner_address,
      source,
      tx_hash,
      block_number,
      active,
      updated_at
    )
    VALUES (
      ${parentId},
      ${parentDomain},
      ${fullName},
      ${label},
      ${fqdn},
      ${input.subdomainId ?? null},
      ${Math.floor(chainId)},
      ${ownerAddress},
      ${normalizeNullableLower(input.controllerAddress)},
      ${input.metadata ?? null},
      ${normalizeNullableString(input.metadataLensUri)},
      ${normalizeNullableString(input.metadataGatewayUrl)},
      ${normalizeNullableString(input.metadataStorageKey)},
      ${normalizeNullableString(input.lensHandle)},
      ${normalizeNullableLower(input.lensAccountAddress)},
      ${normalizeNullableLower(input.lensOwnerAddress)},
      ${source},
      ${normalizeNullableString(input.txHash)},
      ${normalizeNullableString(input.blockNumber)},
      ${input.active !== false},
      NOW()
    )
    ON CONFLICT (parent_id, label) DO UPDATE
    SET
      parent_domain = EXCLUDED.parent_domain,
      full_name = EXCLUDED.full_name,
      fqdn = EXCLUDED.fqdn,
      subdomain_id = EXCLUDED.subdomain_id,
      chain_id = EXCLUDED.chain_id,
      owner_address = EXCLUDED.owner_address,
      controller_address = EXCLUDED.controller_address,
      metadata_json = EXCLUDED.metadata_json,
      metadata_lens_uri = EXCLUDED.metadata_lens_uri,
      metadata_gateway_url = EXCLUDED.metadata_gateway_url,
      metadata_storage_key = EXCLUDED.metadata_storage_key,
      lens_handle = EXCLUDED.lens_handle,
      lens_account_address = EXCLUDED.lens_account_address,
      lens_owner_address = EXCLUDED.lens_owner_address,
      source = EXCLUDED.source,
      tx_hash = EXCLUDED.tx_hash,
      block_number = EXCLUDED.block_number,
      active = EXCLUDED.active,
      updated_at = NOW()
    RETURNING *;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('upsert_failed')
  return mapRow(row)
}

export async function getAgentSubdomainByLabel(
  db: Db,
  params: { label: string; parentId?: string; includeInactive?: boolean },
): Promise<AgentSubdomainRecord | null> {
  const label = normalizeSubdomainLabel(params.label)
  if (!label) return null
  const parentId = String(params.parentId ?? getDefaultParentId()).trim() || getDefaultParentId()
  const includeInactive = params.includeInactive === true
  const result = await db.sql`
    SELECT *
    FROM agent_subdomains
    WHERE parent_id = ${parentId}
      AND label = ${label}
      AND (${includeInactive} OR active = true)
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapRow(row) : null
}

export async function getAgentSubdomainByHost(
  db: Db,
  params: { host: string; parentId?: string; includeInactive?: boolean; apexes?: string[] },
): Promise<{ label: string; record: AgentSubdomainRecord | null }> {
  const label = deriveLabelFromHost(params.host, params.apexes)
  if (!label) return { label: '', record: null }
  const record = await getAgentSubdomainByLabel(db, {
    label,
    parentId: params.parentId,
    includeInactive: params.includeInactive,
  })
  return { label, record }
}
