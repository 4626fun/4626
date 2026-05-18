import { getDb, isDbConfigured } from '../../../../packages/server-core/src/index.js'
import { ensureKeeprSchema } from '../../keepr/keeprSchema.js'
import {
  executeVaultReport,
  executeVaultSweep,
  executeVaultTend,
  KeeperVaultActionError,
} from './keeperVaultActions.js'

export type MaintenanceStepResult = {
  action: string
  status: 'succeeded' | 'failed' | 'skipped'
  result?: Record<string, unknown>
  error?: string
}

export type RunMaintenanceCycleResult = {
  vaultAddress: `0x${string}`
  mode: string
  steps: MaintenanceStepResult[]
  overall: 'succeeded' | 'partial' | 'failed'
}

type VaultRow = {
  vault_address: string
  settled_at: string | null
  config_json: unknown
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
}

function configObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function contractsFromConfig(raw: unknown): Record<string, unknown> {
  const cfg = configObject(raw)
  const contracts = cfg.contracts
  return contracts && typeof contracts === 'object' && !Array.isArray(contracts) ? (contracts as Record<string, unknown>) : {}
}

function hasCcaStrategy(configJson: unknown): boolean {
  const contracts = contractsFromConfig(configJson)
  return Boolean(normalizeAddress(contracts.ccaStrategy))
}

async function loadVaultRow(vaultAddress: `0x${string}`): Promise<VaultRow | null> {
  if (!isDbConfigured()) return null
  await ensureKeeprSchema()
  const db = await getDb()
  if (!db) return null
  const result = (await db.sql`
    SELECT vault_address, settled_at, config_json
    FROM keepr_vaults
    WHERE LOWER(vault_address) = ${vaultAddress}
    LIMIT 1;
  `) as { rows?: VaultRow[] }
  return result.rows?.[0] ?? null
}

function computeOverall(steps: MaintenanceStepResult[]): RunMaintenanceCycleResult['overall'] {
  const failures = steps.filter((step) => step.status === 'failed')
  const successes = steps.filter((step) => step.status === 'succeeded')
  if (failures.length === 0 && successes.length > 0) return 'succeeded'
  if (successes.length > 0 && failures.length > 0) return 'partial'
  if (failures.length > 0) return 'failed'
  return 'succeeded'
}

export async function runMaintenanceCycle(input: {
  vaultAddress: `0x${string}`
  mode?: string | null
}): Promise<RunMaintenanceCycleResult> {
  const mode = String(input.mode ?? 'standard').trim() || 'standard'
  const row = await loadVaultRow(input.vaultAddress)
  if (!row) {
    throw new KeeperVaultActionError('vault_not_found_in_keepr_registry', {
      code: 'vault_not_found',
      retryable: false,
    })
  }

  const steps: MaintenanceStepResult[] = []

  for (const action of ['tend', 'report'] as const) {
    try {
      const result = action === 'tend'
        ? await executeVaultTend(input.vaultAddress)
        : await executeVaultReport(input.vaultAddress)
      steps.push({
        action,
        status: 'succeeded',
        result,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = error instanceof KeeperVaultActionError ? error.retryable : true
      steps.push({
        action,
        status: 'failed',
        error: message,
        result: { retryable },
      })
    }
  }

  const includeSweep = mode === 'standard' && !row.settled_at && hasCcaStrategy(row.config_json)
  if (includeSweep) {
    const ccaStrategyAddress = normalizeAddress(contractsFromConfig(row.config_json).ccaStrategy)
    if (ccaStrategyAddress) {
      try {
        const result = await executeVaultSweep({ ccaStrategyAddress })
        steps.push({ action: 'sweep', status: 'succeeded', result })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const retryable = error instanceof KeeperVaultActionError ? error.retryable : true
        steps.push({
          action: 'sweep',
          status: 'failed',
          error: message,
          result: { retryable },
        })
      }
    }
  }

  return {
    vaultAddress: input.vaultAddress,
    mode,
    steps,
    overall: computeOverall(steps),
  }
}
