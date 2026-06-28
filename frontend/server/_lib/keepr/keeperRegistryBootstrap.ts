import { getAddress, type Address } from 'viem'

import { upsertAjnaVaultRegistryEntry } from '../ajnaVaultManager/registry.js'
import {
  createVaultStrategyPublicClient,
  enrichVaultArtifactsFromOnChain,
  pickAjnaRegistryCandidate,
  scanVaultStrategyDetails,
  type VaultStrategyScan,
} from '../onchain/vaultStrategyOnchain.js'
import {
  findDeploySessionByVaultAddress,
  provisionVaultEconomy,
  type ProvisionVaultEconomyResult,
} from '../controlPlane/executors/provisionVaultEconomy.js'
import { getKeeprVaultByVaultAddress } from './keeprRegistry.js'

export type KeeperRegistryBootstrapResult = {
  vaultAddress: `0x${string}`
  keeprProvisioned: boolean
  ajnaSeeded: boolean
  provision?: ProvisionVaultEconomyResult
  warnings: string[]
}

function isAutoBootstrapEnabled(): boolean {
  const flag = String(process.env.KEEPER_REGISTRY_AUTO_BOOTSTRAP_ENABLED ?? '1').trim().toLowerCase()
  return !['0', 'false', 'no'].includes(flag)
}

function readArtifactsFromSession(session: Awaited<ReturnType<typeof findDeploySessionByVaultAddress>>): Record<string, unknown> {
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

async function seedAjnaRegistry(params: {
  chainId: number
  vaultAddress: `0x${string}`
  creatorToken: Address
  ownerAddress: Address
  strategyDetails: VaultStrategyScan[]
  source: string
}): Promise<{ seeded: boolean; warnings: string[] }> {
  const warnings: string[] = []
  const ajna = pickAjnaRegistryCandidate(params.strategyDetails)

  if (!ajna?.ajna.innerVault || !ajna.ajna.ajnaPool) {
    warnings.push('ajna_registry_seed_skipped_missing_onchain_wiring')
    return { seeded: false, warnings }
  }
  if (!ajna.ajna.auth) {
    warnings.push('ajna_registry_seed_skipped_missing_auth')
    return { seeded: false, warnings }
  }

  const row = await upsertAjnaVaultRegistryEntry({
    chainId: params.chainId,
    creatorToken: params.creatorToken,
    creatorVault: params.vaultAddress,
    strategyAdapter: ajna.strategy,
    innerAjnaVault: ajna.ajna.innerVault,
    ajnaAuth: ajna.ajna.auth,
    ajnaPool: ajna.ajna.ajnaPool,
    ownerAddress: params.ownerAddress,
    bufferRatioBps: ajna.ajna.bufferRatioBps,
    minBucketIndex: ajna.ajna.minBucketIndex,
    metadata: {
      source: params.source,
      automationStatus: 'dry_run',
    },
  })

  if (!row) {
    warnings.push('ajna_registry_write_unavailable')
    return { seeded: false, warnings }
  }

  return { seeded: true, warnings }
}

export async function ensureKeeperRegistryForVault(input: {
  vaultAddress: `0x${string}`
  chainId?: number
  creatorAddress?: string | null
  strategyVariant?: string | null
  requestedBy?: string | null
  source?: string
  skipProvisionIfExists?: boolean
  seedAjna?: boolean
}): Promise<KeeperRegistryBootstrapResult> {
  const warnings: string[] = []
  const vaultAddress = getAddress(input.vaultAddress).toLowerCase() as `0x${string}`
  const chainId = Number(input.chainId ?? 8453)
  const source = input.source ?? 'keeper_registry_bootstrap'

  if (!isAutoBootstrapEnabled()) {
    return {
      vaultAddress,
      keeprProvisioned: false,
      ajnaSeeded: false,
      warnings: ['auto_bootstrap_disabled_by_feature_flag'],
    }
  }

  const existing = await getKeeprVaultByVaultAddress(vaultAddress)
  let provision: ProvisionVaultEconomyResult | undefined
  let keeprProvisioned = Boolean(existing)

  if (!existing || !input.skipProvisionIfExists) {
    if (!existing) {
      try {
        provision = await provisionVaultEconomy({
          vaultAddress,
          chainId,
          creatorAddress: input.creatorAddress,
          strategyVariant: input.strategyVariant,
          requestedBy: input.requestedBy ?? source,
        })
        keeprProvisioned = true
        warnings.push(...(provision.warnings ?? []))
      } catch (error) {
        warnings.push(`keepr_provision_failed:${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  let ajnaSeeded = false
  if (input.seedAjna !== false) {
    const session = await findDeploySessionByVaultAddress(vaultAddress)
    const sessionArtifacts = readArtifactsFromSession(session)
    const enriched = await enrichVaultArtifactsFromOnChain({
      vaultAddress,
      chainId,
      artifacts: sessionArtifacts,
    })
    warnings.push(...enriched.warnings)

    const creatorTokenRaw =
      enriched.artifacts.creatorToken ??
      enriched.artifacts.creatorCoin ??
      enriched.artifacts.creatorCoinAddress
    const ownerRaw =
      input.creatorAddress ??
      enriched.artifacts.owner ??
      enriched.artifacts.creatorAddress ??
      session?.smartWallet

    const creatorToken =
      typeof creatorTokenRaw === 'string' && /^0x[a-fA-F0-9]{40}$/.test(creatorTokenRaw)
        ? getAddress(creatorTokenRaw)
        : null
    const ownerAddress =
      typeof ownerRaw === 'string' && /^0x[a-fA-F0-9]{40}$/.test(ownerRaw) ? getAddress(ownerRaw) : null

    if (!creatorToken || !ownerAddress) {
      warnings.push('ajna_registry_seed_skipped_missing_creator_or_owner')
    } else {
      const client = createVaultStrategyPublicClient()
      const strategyDetails = await scanVaultStrategyDetails({ client, vault: vaultAddress })
      const seedResult = await seedAjnaRegistry({
        chainId,
        vaultAddress,
        creatorToken,
        ownerAddress,
        strategyDetails,
        source,
      })
      ajnaSeeded = seedResult.seeded
      warnings.push(...seedResult.warnings)
    }
  }

  return {
    vaultAddress,
    keeprProvisioned,
    ajnaSeeded,
    provision,
    warnings,
  }
}
