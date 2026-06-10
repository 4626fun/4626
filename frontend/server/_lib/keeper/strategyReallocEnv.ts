/** Shared env parsing for cross-strategy rebalanceStrategies() automation. */

export const DEFAULT_MIN_DEVIATION_BPS = 500
export const MAX_MIN_DEVIATION_BPS = 10_000

export function parseMinDeviationBps(raw?: string | number | null): number {
  const fallback = DEFAULT_MIN_DEVIATION_BPS
  if (raw === null || raw === undefined) return fallback
  if (typeof raw === 'string' && raw.trim() === '') return fallback
  const n = typeof raw === 'string' ? Number(raw.trim()) : raw
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(MAX_MIN_DEVIATION_BPS, Math.floor(n))
}
