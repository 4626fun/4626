import { createHash } from 'node:crypto'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export type CreAttestationKind = 'solana_nav' | 'strategy_health' | 'creator_oracle'
export type CreAttestationStatus =
  | 'ingested'
  | 'shadow_only'
  | 'queued'
  | 'rejected'
  | 'executed'
  | 'execution_failed'

export type CreStrategyHealthStatus = 'healthy' | 'degraded' | 'stale' | 'unknown'

export type KeeperCreAttestationRecord = {
  dedupeKey: string
  attestationKind: CreAttestationKind
  status: CreAttestationStatus
  source: string
  payload: Record<string, unknown>
  decision?: Record<string, unknown> | null
  strategyAddress?: string | null
  vaultAddress?: string | null
  creatorTokenAddress?: string | null
  oracleAddress?: string | null
  reportId?: string | null
  navValue?: string | null
  proposedPrice?: string | null
  reportTimestamp?: string | null
  attestationDigest?: string | null
  executionJobId?: number | null
  executionTxHash?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export type KeeperCreStrategyHealthRecord = {
  vaultAddress: string
  strategyAddress: string
  status: CreStrategyHealthStatus
  confidenceBps: number
  reportTimestamp: string
  source: string
  attestationDigest?: string | null
  metadata?: Record<string, unknown>
}

export type KeeperCreStrategyHealth = {
  vaultAddress: string
  strategyAddress: string
  status: CreStrategyHealthStatus
  confidenceBps: number
  reportTimestamp: string
  source: string
  attestationDigest: string | null
  metadata: Record<string, unknown>
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
}

export function normalizeReportIdHex(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{64}$/.test(raw) ? (raw as `0x${string}`) : null
}

export function parseBooleanFlag(value: unknown, fallback = false): boolean {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function readAddressAllowlist(envName: string): Set<string> {
  const raw = String(process.env[envName] ?? '')
  const out = new Set<string>()
  for (const token of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(token)
    if (normalized) out.add(normalized)
  }
  return out
}

export function deriveCreReportId(parts: Array<string | number | bigint>): `0x${string}` {
  const digest = createHash('sha256')
  for (const part of parts) {
    digest.update(String(part))
    digest.update('|')
  }
  return (`0x${digest.digest('hex')}`) as `0x${string}`
}

export function buildAttestationDedupeKey(input: {
  attestationKind: CreAttestationKind
  primaryAddress: string
  reportId: string
}): string {
  return `${input.attestationKind}:${input.primaryAddress.toLowerCase()}:${input.reportId.toLowerCase()}`
}

export async function upsertKeeperCreAttestation(db: Db, record: KeeperCreAttestationRecord): Promise<number> {
  const dedupeKey = String(record.dedupeKey ?? '').trim()
  if (!dedupeKey) throw new Error('invalid_keeper_cre_dedupe_key')
  const source = String(record.source ?? '').trim().slice(0, 200)
  if (!source) throw new Error('invalid_keeper_cre_source')
  const reportTimestamp = record.reportTimestamp ? new Date(record.reportTimestamp) : null
  const reportTimestampIso =
    reportTimestamp && Number.isFinite(reportTimestamp.getTime()) ? reportTimestamp.toISOString() : null

  const result = await db.sql`
    INSERT INTO keeper_cre_attestations (
      dedupe_key,
      attestation_kind,
      status,
      strategy_address,
      vault_address,
      creator_token_address,
      oracle_address,
      report_id,
      nav_value,
      proposed_price,
      report_timestamp,
      source,
      attestation_digest,
      payload,
      decision,
      execution_job_id,
      execution_tx_hash,
      error_code,
      error_message,
      updated_at
    )
    VALUES (
      ${dedupeKey},
      ${record.attestationKind},
      ${record.status},
      ${record.strategyAddress ?? null},
      ${record.vaultAddress ?? null},
      ${record.creatorTokenAddress ?? null},
      ${record.oracleAddress ?? null},
      ${record.reportId ?? null},
      ${record.navValue ?? null},
      ${record.proposedPrice ?? null},
      ${reportTimestampIso},
      ${source},
      ${record.attestationDigest ?? null},
      ${record.payload ?? {}},
      ${record.decision ?? null},
      ${record.executionJobId ?? null},
      ${record.executionTxHash ?? null},
      ${record.errorCode ?? null},
      ${record.errorMessage ?? null},
      NOW()
    )
    ON CONFLICT (dedupe_key)
    DO UPDATE SET
      status = EXCLUDED.status,
      strategy_address = COALESCE(EXCLUDED.strategy_address, keeper_cre_attestations.strategy_address),
      vault_address = COALESCE(EXCLUDED.vault_address, keeper_cre_attestations.vault_address),
      creator_token_address = COALESCE(EXCLUDED.creator_token_address, keeper_cre_attestations.creator_token_address),
      oracle_address = COALESCE(EXCLUDED.oracle_address, keeper_cre_attestations.oracle_address),
      report_id = COALESCE(EXCLUDED.report_id, keeper_cre_attestations.report_id),
      nav_value = COALESCE(EXCLUDED.nav_value, keeper_cre_attestations.nav_value),
      proposed_price = COALESCE(EXCLUDED.proposed_price, keeper_cre_attestations.proposed_price),
      report_timestamp = COALESCE(EXCLUDED.report_timestamp, keeper_cre_attestations.report_timestamp),
      source = EXCLUDED.source,
      attestation_digest = COALESCE(EXCLUDED.attestation_digest, keeper_cre_attestations.attestation_digest),
      payload = EXCLUDED.payload,
      decision = COALESCE(EXCLUDED.decision, keeper_cre_attestations.decision),
      execution_job_id = COALESCE(EXCLUDED.execution_job_id, keeper_cre_attestations.execution_job_id),
      execution_tx_hash = COALESCE(EXCLUDED.execution_tx_hash, keeper_cre_attestations.execution_tx_hash),
      error_code = COALESCE(EXCLUDED.error_code, keeper_cre_attestations.error_code),
      error_message = COALESCE(EXCLUDED.error_message, keeper_cre_attestations.error_message),
      updated_at = NOW()
    RETURNING id;
  `
  const id = Number(result.rows?.[0]?.id)
  if (!Number.isInteger(id) || id <= 0) throw new Error('keeper_cre_attestation_upsert_failed')
  return id
}

export async function upsertKeeperCreStrategyHealth(
  db: Db,
  record: KeeperCreStrategyHealthRecord,
): Promise<KeeperCreStrategyHealth> {
  const status = record.status
  if (!['healthy', 'degraded', 'stale', 'unknown'].includes(status)) {
    throw new Error('invalid_keeper_cre_strategy_health_status')
  }
  const confidenceBps = Math.max(0, Math.min(10_000, Math.floor(Number(record.confidenceBps ?? 0))))
  const reportTimestamp = new Date(record.reportTimestamp)
  if (!Number.isFinite(reportTimestamp.getTime())) throw new Error('invalid_keeper_cre_strategy_health_report_timestamp')

  const result = await db.sql`
    INSERT INTO keeper_cre_strategy_health (
      vault_address,
      strategy_address,
      status,
      confidence_bps,
      report_timestamp,
      source,
      attestation_digest,
      metadata,
      updated_at
    )
    VALUES (
      ${record.vaultAddress},
      ${record.strategyAddress},
      ${status},
      ${confidenceBps},
      ${reportTimestamp.toISOString()},
      ${record.source},
      ${record.attestationDigest ?? null},
      ${record.metadata ?? {}},
      NOW()
    )
    ON CONFLICT (vault_address, strategy_address)
    DO UPDATE SET
      status = EXCLUDED.status,
      confidence_bps = EXCLUDED.confidence_bps,
      report_timestamp = EXCLUDED.report_timestamp,
      source = EXCLUDED.source,
      attestation_digest = EXCLUDED.attestation_digest,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING
      vault_address,
      strategy_address,
      status,
      confidence_bps,
      report_timestamp,
      source,
      attestation_digest,
      metadata;
  `
  const row = result.rows?.[0]
  if (!row) throw new Error('keeper_cre_strategy_health_upsert_failed')
  return {
    vaultAddress: String(row.vault_address).toLowerCase(),
    strategyAddress: String(row.strategy_address).toLowerCase(),
    status: String(row.status) as CreStrategyHealthStatus,
    confidenceBps: Number(row.confidence_bps ?? 0),
    reportTimestamp: new Date(row.report_timestamp).toISOString(),
    source: String(row.source ?? ''),
    attestationDigest: row.attestation_digest ? String(row.attestation_digest) : null,
    metadata: asObject(row.metadata),
  }
}

export async function readKeeperCreStrategyHealthForVault(
  db: Db,
  vaultAddress: string,
): Promise<KeeperCreStrategyHealth[]> {
  const normalizedVault = normalizeAddress(vaultAddress)
  if (!normalizedVault) return []
  const result = await db.sql`
    SELECT
      vault_address,
      strategy_address,
      status,
      confidence_bps,
      report_timestamp,
      source,
      attestation_digest,
      metadata
    FROM keeper_cre_strategy_health
    WHERE vault_address = ${normalizedVault}
    ORDER BY report_timestamp DESC;
  `
  return (result.rows ?? []).map((row) => ({
    vaultAddress: String(row.vault_address).toLowerCase(),
    strategyAddress: String(row.strategy_address).toLowerCase(),
    status: String(row.status) as CreStrategyHealthStatus,
    confidenceBps: Number(row.confidence_bps ?? 0),
    reportTimestamp: new Date(row.report_timestamp).toISOString(),
    source: String(row.source ?? ''),
    attestationDigest: row.attestation_digest ? String(row.attestation_digest) : null,
    metadata: asObject(row.metadata),
  }))
}

export function evaluateVaultStrategyHealthGate(input: {
  statuses: KeeperCreStrategyHealth[]
  nowMs?: number
  maxAgeMs: number
  minConfidenceBps: number
}): { blocked: boolean; reason: string | null; statuses: KeeperCreStrategyHealth[] } {
  const nowMs = Number.isFinite(input.nowMs ?? NaN) ? Number(input.nowMs) : Date.now()
  const maxAgeMs = Math.max(1_000, Math.floor(input.maxAgeMs))
  const minConfidenceBps = Math.max(0, Math.min(10_000, Math.floor(input.minConfidenceBps)))

  for (const status of input.statuses) {
    const ageMs = nowMs - new Date(status.reportTimestamp).getTime()
    if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) {
      return { blocked: true, reason: 'strategy_health_stale', statuses: input.statuses }
    }
    if (status.confidenceBps < minConfidenceBps) {
      return { blocked: true, reason: 'strategy_health_low_confidence', statuses: input.statuses }
    }
    if (status.status === 'degraded' || status.status === 'stale' || status.status === 'unknown') {
      return { blocked: true, reason: `strategy_health_${status.status}`, statuses: input.statuses }
    }
  }
  return { blocked: false, reason: null, statuses: input.statuses }
}
