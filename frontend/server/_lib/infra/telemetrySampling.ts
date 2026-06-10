import { createHash } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

function parseNumber(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function normalizeTableForEnv(table: string): string {
  return String(table || 'global')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Deterministic sampling for high-volume telemetry tables.
 *
 * Uses a stable hash of the provided key (e.g. userId + eventType) so that
 * sampling decisions are consistent across restarts and retries.
 *
 * Env var: TELEMETRY_SAMPLE_RATE (0.0 - 1.0). Default 1.0 (no sampling).
 * Per-table override: TELEMETRY_SAMPLE_RATE_<normalized_table> (e.g. TELEMETRY_SAMPLE_RATE_chat_presence_sessions)
 */
export function shouldSampleTelemetry(key: string | number | null | undefined): boolean {
  const rate = Math.max(0, Math.min(1, parseNumber(process.env.TELEMETRY_SAMPLE_RATE, 1)))
  if (rate >= 1) return true
  if (rate <= 0) return false

  const str = String(key ?? 'anonymous')
  const hash = createHash('sha256').update(str).digest('hex')
  const bucket = parseInt(hash.slice(0, 8), 16) / 0xffffffff // 0..1

  return bucket < rate
}

/**
 * Returns the effective sample rate (0.0–1.0) for a given table.
 *
 * Resolution order:
 *   1. TELEMETRY_SAMPLE_RATE_<normalized_table>
 *   2. TELEMETRY_SAMPLE_RATE (global)
 *   3. 1.0 (no sampling)
 *
 * Useful for logging, dashboards, or admin surfaces that want to show
 * "this table is currently sampled at 12%".
 */
export function getTelemetrySampleRate(tableName?: string): number {
  const tableKey = tableName ? normalizeTableForEnv(tableName) : null
  const specificEnv = tableKey ? `TELEMETRY_SAMPLE_RATE_${tableKey}` : null
  const specific = specificEnv ? process.env[specificEnv] : undefined
  const rateSource = specific !== undefined ? specific : process.env.TELEMETRY_SAMPLE_RATE
  return Math.max(0, Math.min(1, parseNumber(rateSource, 1)))
}

/**
 * Table-aware deterministic sampling.
 *
 * Checks for a table-specific rate env (TELEMETRY_SAMPLE_RATE_<table>) first,
 * then falls back to the global TELEMETRY_SAMPLE_RATE.
 *
 * tableName is normalized for env var safety (lowercase, non-alphanum -> _).
 */
export function shouldSampleEvent(
  tableName: string,
  key: string | number | null | undefined,
  rateEnv: string = 'TELEMETRY_SAMPLE_RATE',
): boolean {
  const rate = getTelemetrySampleRate(tableName)

  if (rate >= 1) return true
  if (rate <= 0) return false

  const tableKey = normalizeTableForEnv(tableName)
  const str = `${tableKey}:${String(key ?? 'anonymous')}`
  const hash = createHash('sha256').update(str).digest('hex')
  const bucket = parseInt(hash.slice(0, 8), 16) / 0xffffffff

  return bucket < rate
}

/**
 * Convenience wrapper for common telemetry keys.
 * Tries to use a stable identifier (user/wallet/chat) before falling back to event name.
 */
export function shouldSample(
  primaryKey?: string | number | null,
  secondaryKey?: string | number | null,
): boolean {
  const key = primaryKey ?? secondaryKey ?? 'global'
  return shouldSampleTelemetry(key)
}