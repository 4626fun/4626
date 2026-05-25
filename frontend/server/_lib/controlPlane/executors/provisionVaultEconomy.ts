import { getDb, isDbConfigured } from '../../../../packages/server-core/src/index.js'
import { ensureDeploySessionsSchema, type DeploySessionRecord } from '../../deploy/deploySessions.js'
import {
  buildKeeprConfig,
  KeeprConfigBuildError,
  normalizeKeeprAddress,
  readKeeprString,
} from '../../keepr/keeprConfigBuilder.js'
import {
  computeConfigHash,
  getKeeprVaultByVaultAddress,
  upsertKeeprVault,
} from '../../keepr/keeprRegistry.js'
import { upsertKeeprVaultAutomation } from '../../keepr/keeprAutomation.js'
import { ensureKeeprSchema } from '../../keepr/keeprSchema.js'
import {
  enableCswAgent,
  getOrCreateCreatorXmtpAgent,
} from '../../messaging/creatorXmtpAgents.js'
import { enrichVaultArtifactsFromOnChain } from '../../onchain/vaultStrategyOnchain.js'
import { resolveStrategyProfile } from './strategyRegistry.js'

export class ProvisionVaultEconomyError extends Error {
  code: string
  retryable: boolean

  constructor(message: string, params?: { code?: string; retryable?: boolean }) {
    super(message)
    this.code = params?.code ?? 'provision_failed'
    this.retryable = params?.retryable ?? false
  }
}

export type ProvisionVaultEconomyInput = {
  vaultAddress: `0x${string}`
  chainId?: number | null
  creatorAddress?: string | null
  strategyVariant?: string | null
  requestedBy?: string | null
  operationId?: string | null
}

export type ProvisionVaultEconomyResult = {
  provisioned: boolean
  vaultAddress: `0x${string}`
  configHash: string
  automationEnabled: boolean
  warnings: string[]
  deploySessionId?: string | null
}

function isEnabled(): boolean {
  const flag = String(process.env.CONTROL_PLANE_PROVISION_ENABLED ?? '1').trim().toLowerCase()
  return !['0', 'false', 'no'].includes(flag)
}

export async function findDeploySessionByVaultAddress(
  vaultAddress: `0x${string}`,
): Promise<DeploySessionRecord | null> {
  if (!isDbConfigured()) return null
  await ensureDeploySessionsSchema()
  const db = await getDb()
  if (!db) return null
  const normalized = vaultAddress.toLowerCase()
  const result = await db.sql`
    SELECT *
    FROM deploys
    WHERE step = 'completed'
      AND (
        LOWER(COALESCE(artifacts->>'vaultAddress', '')) = ${normalized}
        OR LOWER(COALESCE(artifacts->'contracts'->>'vault', '')) = ${normalized}
        OR LOWER(COALESCE(payload->'contracts'->>'vault', '')) = ${normalized}
        OR LOWER(COALESCE(payload->>'vaultAddress', '')) = ${normalized}
      )
    ORDER BY updated_at DESC
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return null
  return {
    id: String(row.id),
    tokenHash: String(row.token_hash),
    sessionAddress: String(row.session_address).toLowerCase() as `0x${string}`,
    smartWallet: String(row.smart_wallet).toLowerCase() as `0x${string}`,
    sessionSigner: String(row.session_signer ?? row.session_owner).toLowerCase() as `0x${string}`,
    deployToken: String(row.deploy_token),
    payload: row.payload,
    step: String(row.step) as DeploySessionRecord['step'],
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastError: row.last_error ? String(row.last_error) : null,
    lastUserOpHash: row.last_userop_hash ? String(row.last_userop_hash) : null,
    lastTxHash: row.last_tx_hash ? String(row.last_tx_hash) : null,
    state: 'completed',
    currentStage: 'completed',
    attemptCount: Number(row.attempt_count ?? 0),
    nextRunAfter: null,
    lockOwner: null,
    lockExpiresAt: null,
    lastFailureCode: null,
    lastFailureStage: null,
    artifacts: row.artifacts && typeof row.artifacts === 'object' ? (row.artifacts as Record<string, unknown>) : {},
  }
}

function readArtifacts(session: DeploySessionRecord | null): Record<string, unknown> {
  if (!session) return {}
  const merged: Record<string, unknown> = {}
  const payload =
    session.payload && typeof session.payload === 'object' && !Array.isArray(session.payload)
      ? (session.payload as Record<string, unknown>)
      : {}
  Object.assign(merged, payload)
  Object.assign(merged, session.artifacts)
  const contracts = merged.contracts
  if (contracts && typeof contracts === 'object' && !Array.isArray(contracts)) {
    Object.assign(merged, contracts as Record<string, unknown>)
  }
  return merged
}

export async function provisionVaultEconomy(
  input: ProvisionVaultEconomyInput,
): Promise<ProvisionVaultEconomyResult> {
  if (!isEnabled()) {
    throw new ProvisionVaultEconomyError('provision_disabled_by_feature_flag', {
      code: 'provision_disabled',
      retryable: false,
    })
  }
  if (!isDbConfigured()) {
    throw new ProvisionVaultEconomyError('database_not_configured', {
      code: 'database_not_configured',
      retryable: true,
    })
  }

  await ensureKeeprSchema()
  const warnings: string[] = []
  const vaultAddress = input.vaultAddress
  const chainId = Number(input.chainId ?? 8453)
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new ProvisionVaultEconomyError('invalid_chain_id', { code: 'invalid_chain_id', retryable: false })
  }

  const session = await findDeploySessionByVaultAddress(vaultAddress)
  let artifacts = readArtifacts(session)
  const enriched = await enrichVaultArtifactsFromOnChain({
    vaultAddress,
    chainId,
    artifacts,
  })
  artifacts = enriched.artifacts
  warnings.push(...enriched.warnings)

  const creatorAddress =
    normalizeKeeprAddress(input.creatorAddress) ??
    normalizeKeeprAddress(artifacts.creatorAddress) ??
    normalizeKeeprAddress(session?.smartWallet) ??
    normalizeKeeprAddress(artifacts.owner)
  if (!creatorAddress) {
    throw new ProvisionVaultEconomyError('creator_address_missing', {
      code: 'creator_address_missing',
      retryable: false,
    })
  }
  if (!session) {
    warnings.push('deploy_session_not_found_using_onchain_fields')
  }

  let groupId =
    readKeeprString(artifacts.groupId) ||
    readKeeprString((artifacts.xmtp as Record<string, unknown> | undefined)?.groupId)
  let agentInboxId = readKeeprString((artifacts.xmtp as Record<string, unknown> | undefined)?.agentInboxId) || null

  if (!groupId) {
    groupId = `control-plane:${vaultAddress}:${Date.now()}`
    warnings.push('generated_placeholder_group_id')
  }

  if (!agentInboxId) {
    try {
      const agentRow = await getOrCreateCreatorXmtpAgent({
        creatorAddress,
        listedPublicly: true,
      })
      agentInboxId = agentRow.xmtpAgentAddress
    } catch (error) {
      warnings.push(`agent_bootstrap_failed:${error instanceof Error ? error.message : String(error)}`)
      try {
        const cswRow = await enableCswAgent({
          creatorAddress,
          cswAddress: creatorAddress,
          privyWalletId: readKeeprString(artifacts.privyWalletId) || 'control-plane-bootstrap',
          listedPublicly: true,
        })
        agentInboxId = cswRow.xmtpAgentAddress
      } catch (inner) {
        warnings.push(`csw_agent_bootstrap_failed:${inner instanceof Error ? inner.message : String(inner)}`)
      }
    }
  }

  let config
  try {
    config = buildKeeprConfig({
      vaultAddress,
      chainId,
      creatorAddress,
      strategyVariant: input.strategyVariant,
      artifacts,
      groupId,
      agentInboxId,
    })
  } catch (error) {
    if (error instanceof KeeprConfigBuildError) {
      throw new ProvisionVaultEconomyError(error.message, {
        code: error.code,
        retryable: false,
      })
    }
    throw error
  }

  const row = await upsertKeeprVault({
    config,
    actorWallet: input.requestedBy ?? creatorAddress,
  })

  const profile = resolveStrategyProfile(input.strategyVariant)
  let automationEnabled = false
  try {
    await upsertKeeprVaultAutomation({
      vaultAddress,
      profileId: profile.profileId,
      canonicalCswAddress: creatorAddress,
      authorizationSource: 'control-plane.provision',
      automationEnabled: true,
      automationScope: profile.automationScope,
      metadata: {
        operationId: input.operationId ?? null,
        strategyVariant: profile.variant,
      },
    })
    automationEnabled = true
  } catch (error) {
    warnings.push(`automation_enable_failed:${error instanceof Error ? error.message : String(error)}`)
  }

  const existing = await getKeeprVaultByVaultAddress(vaultAddress)
  const configHash = existing?.configHash ?? computeConfigHash(config)

  return {
    provisioned: true,
    vaultAddress,
    configHash,
    automationEnabled,
    warnings,
    deploySessionId: session?.id ?? null,
  }
}
