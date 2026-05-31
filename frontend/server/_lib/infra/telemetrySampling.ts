import { createHash } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

function parseNumber(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

/**
 * Deterministic sampling for high-volume telemetry tables.
 *
 * Uses a stable hash of the provided key (e.g. userId + eventType) so that
 * sampling decisions are consistent across restarts and retries.
 *
 * Env var: TELEMETRY_SAMPLE_RATE (0.0 - 1.0). Default 1.0 (no sampling).
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