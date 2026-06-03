import { getDbForCron, isDbConfigured } from '@4626/server-core'
import { ensureKeeperCreSchema } from '../db/schemaBootstrap.js'
import {
  evaluateVaultStrategyHealthGate,
  readKeeperCreStrategyHealthForVault,
  type KeeperCreStrategyHealth,
  normalizeAddress,
  parseBooleanFlag,
} from './creAttestations.js'

export type StrategyHealthGateResult = {
  enabled: boolean
  blocked: boolean
  reason: string | null
  statuses: KeeperCreStrategyHealth[]
}

function readInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

export async function evaluateKeeperStrategyHealthGate(vaultAddress: string): Promise<StrategyHealthGateResult> {
  const enabled = parseBooleanFlag(process.env.CRE_STRATEGY_HEALTH_GATE_ENABLED, false)
  if (!enabled) {
    return { enabled: false, blocked: false, reason: null, statuses: [] }
  }
  const normalizedVault = normalizeAddress(vaultAddress)
  if (!normalizedVault) {
    return { enabled: true, blocked: true, reason: 'invalid_vault_address', statuses: [] }
  }
  if (!isDbConfigured()) {
    return { enabled: true, blocked: true, reason: 'db_not_configured', statuses: [] }
  }
  const db = await getDbForCron()
  if (!db) {
    return { enabled: true, blocked: true, reason: 'db_unavailable', statuses: [] }
  }
  await ensureKeeperCreSchema(db)
  const statuses = await readKeeperCreStrategyHealthForVault(db, normalizedVault)
  if (statuses.length === 0) {
    if (parseBooleanFlag(process.env.CRE_STRATEGY_HEALTH_REQUIRE_SIGNAL, true)) {
      return { enabled: true, blocked: true, reason: 'strategy_health_missing', statuses: [] }
    }
    return { enabled: true, blocked: false, reason: null, statuses: [] }
  }

  const maxAgeMs = readInt(process.env.CRE_STRATEGY_HEALTH_MAX_AGE_MS, 10 * 60_000, 60_000, 24 * 60 * 60_000)
  const minConfidenceBps = readInt(process.env.CRE_STRATEGY_HEALTH_MIN_CONFIDENCE_BPS, 7000, 0, 10_000)
  const gate = evaluateVaultStrategyHealthGate({
    statuses,
    maxAgeMs,
    minConfidenceBps,
  })
  return {
    enabled: true,
    blocked: gate.blocked,
    reason: gate.reason,
    statuses,
  }
}
