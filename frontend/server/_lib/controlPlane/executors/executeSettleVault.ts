import { getDb, isDbConfigured } from '@4626/server-core'
import { ensureKeeprSchema } from '../../keepr/keeprSchema.js'
import { ensureKeeperRegistryForVault } from '../../keepr/keeperRegistryBootstrap.js'

export class SettleVaultExecutionError extends Error {
  statusCode: number
  code: string
  retryable: boolean

  constructor(params: { statusCode: number; code: string; message: string; retryable?: boolean }) {
    super(params.message)
    this.statusCode = params.statusCode
    this.code = params.code
    this.retryable = params.retryable ?? false
  }
}

export type ParsedSettleVaultInput = {
  vaultAddress: `0x${string}`
  graduatedAt: string
  settledAt: string
  normalizedStage: string
}

export function parseSettleVaultInput(input: {
  vaultAddress: string
  graduatedAt?: string
  settledAt?: string
  settlementStage?: string
}): ParsedSettleVaultInput {
  const vaultAddress = String(input.vaultAddress || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(vaultAddress)) {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'invalid_vault_address',
      message: 'Invalid vaultAddress',
    })
  }

  const graduatedAt = typeof input.graduatedAt === 'string' ? input.graduatedAt.trim() : ''
  const settledAt = typeof input.settledAt === 'string' ? input.settledAt.trim() : ''
  const normalizedStage = normalizeSettlementStage(input.settlementStage)

  if (!graduatedAt && !settledAt && !normalizedStage) {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'missing_settlement_update_fields',
      message: 'Must provide graduatedAt, settledAt, or settlementStage',
    })
  }
  if (settledAt) {
    validateSettledAt({ settledAt, normalizedStage })
  }

  return {
    vaultAddress: vaultAddress as `0x${string}`,
    graduatedAt,
    settledAt,
    normalizedStage,
  }
}

function normalizeSettlementStage(value: string | undefined): string {
  const stage = String(value || '').trim()
  if (!stage) return ''
  if (!/^[a-z0-9_:-]{2,64}$/i.test(stage)) {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'invalid_settlement_stage',
      message: 'Invalid settlementStage',
    })
  }
  return stage
}

function validateSettledAt(params: { settledAt: string; normalizedStage: string }): void {
  if (params.normalizedStage.toLowerCase() !== 'completed') {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'invalid_settled_at_stage',
      message: 'settledAt may only be written when settlementStage="completed"',
    })
  }
  const parsedSettledAt = Date.parse(params.settledAt)
  if (!Number.isFinite(parsedSettledAt)) {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'invalid_settled_at_format',
      message: 'Invalid settledAt — expected ISO-8601 timestamp',
    })
  }
  const maxAllowedMs = Date.now() + 5 * 60 * 1000
  if (parsedSettledAt > maxAllowedMs) {
    throw new SettleVaultExecutionError({
      statusCode: 400,
      code: 'invalid_settled_at_future',
      message: 'settledAt cannot be in the future',
    })
  }
}

export type ExecuteSettleVaultResult = {
  vaultAddress: `0x${string}`
  updated: boolean
  stageUpdated: boolean
  registryBootstrap?: {
    keeprProvisioned: boolean
    ajnaSeeded: boolean
    warnings: string[]
  }
}

export async function executeSettleVault(input: {
  vaultAddress: string
  graduatedAt?: string
  settledAt?: string
  settlementStage?: string
}): Promise<ExecuteSettleVaultResult> {
  const parsed = parseSettleVaultInput(input)

  if (!isDbConfigured()) {
    throw new SettleVaultExecutionError({
      statusCode: 500,
      code: 'database_not_configured',
      message: 'Database not configured',
      retryable: true,
    })
  }

  await ensureKeeprSchema()
  const db = await getDb()
  if (!db) {
    throw new SettleVaultExecutionError({
      statusCode: 500,
      code: 'database_unavailable',
      message: 'Database unavailable',
      retryable: true,
    })
  }

  const updateResult = await db.sql`
    UPDATE keepr_vaults
    SET graduated_at = COALESCE(graduated_at, ${parsed.graduatedAt || null}::timestamptz),
        settled_at = COALESCE(settled_at, ${parsed.settledAt || null}::timestamptz),
        settlement_stage = COALESCE(${parsed.normalizedStage || null}::text, settlement_stage),
        settlement_stage_updated_at =
          CASE
            WHEN ${parsed.normalizedStage || null}::text IS NULL THEN settlement_stage_updated_at
            ELSE NOW()
          END,
        updated_at = NOW()
    WHERE LOWER(vault_address) = ${parsed.vaultAddress}
    RETURNING 1;
  `
  if (!Array.isArray(updateResult.rows) || updateResult.rows.length === 0) {
    throw new SettleVaultExecutionError({
      statusCode: 404,
      code: 'vault_not_found_in_keepr_registry',
      message: 'Vault not found in keepr registry',
    })
  }

  let registryBootstrap: ExecuteSettleVaultResult['registryBootstrap']
  if (parsed.normalizedStage.toLowerCase() === 'completed' && parsed.settledAt) {
    try {
      const bootstrap = await ensureKeeperRegistryForVault({
        vaultAddress: parsed.vaultAddress,
        source: 'vault.settle.completed',
        skipProvisionIfExists: true,
        seedAjna: true,
      })
      registryBootstrap = {
        keeprProvisioned: bootstrap.keeprProvisioned,
        ajnaSeeded: bootstrap.ajnaSeeded,
        warnings: bootstrap.warnings,
      }
      if (bootstrap.warnings.length > 0) {
        console.warn('keeper_registry.bootstrap_after_settle', {
          vaultAddress: parsed.vaultAddress,
          warnings: bootstrap.warnings,
        })
      }
    } catch (error) {
      console.warn('keeper_registry.bootstrap_after_settle_failed', {
        vaultAddress: parsed.vaultAddress,
        message: error instanceof Error ? error.message : String(error),
      })
      registryBootstrap = {
        keeprProvisioned: false,
        ajnaSeeded: false,
        warnings: [`bootstrap_failed:${error instanceof Error ? error.message : String(error)}`],
      }
    }
  }

  return {
    vaultAddress: parsed.vaultAddress,
    updated: true,
    stageUpdated: Boolean(parsed.normalizedStage),
    ...(registryBootstrap ? { registryBootstrap } : null),
  }
}
