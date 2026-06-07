import { getAddress, type Address, type Hex } from 'viem'

import bundledManifest from '@/deploy/perVaultVanityPreseedManifest.json'
import {
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
} from '@/lib/deploy/perVaultVanityVersionSearch'
import type { DeploymentVanityVersionSearchOutcome } from '@/pages/deploy/deployVaultHelpers'

export const PER_VAULT_VANITY_PRESEED_SCHEMA = 1

export type PerVaultVanityPreseedBatcherMode = 'salt' | 'version'

export type PerVaultVanityPreseedPlan = {
  id: string
  label?: string
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  batcher: Address
  baseVersion: string
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  vaultPrefix: string
  shareSuffix: string
  batcherMode: PerVaultVanityPreseedBatcherMode
  deploymentVersion: string
  versionSearchOutcome: DeploymentVanityVersionSearchOutcome
  shareOftSalt?: Hex | null
  groundedAt?: string
  searchAttempts?: number
}

export type PerVaultVanityPreseedManifest = {
  schema: number
  chainId: number
  plans: PerVaultVanityPreseedPlan[]
}

export type LookupPreseededVanityVersionPlanParams = {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  batcherAddress: Address
  chainId: number
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  baseVersion: string
  vaultPrefix: string | null
  shareSuffix: string | null
  supportsPhase1WithSalt: boolean
}

export type LookupPreseededShareOftSaltParams = {
  create2Deployer: Address
  creatorToken: Address
  owner: Address
  batcherAddress: Address
  chainId: number
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  baseVersion: string
  shareOftVanitySuffix: string
  deploymentVersion: string
  supportsPhase1WithSalt: boolean
}

export type PreseededVanityVersionPlan = {
  deploymentVersion: string
  outcome: DeploymentVanityVersionSearchOutcome
  planId: string
}

function normalizeHexSuffix(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  return (raw.startsWith('0x') ? raw.slice(2) : raw).toLowerCase()
}

function normalizeAddress(value: string): string {
  return getAddress(value).toLowerCase()
}

function resolveBatcherMode(supportsPhase1WithSalt: boolean): PerVaultVanityPreseedBatcherMode {
  return supportsPhase1WithSalt ? 'salt' : 'version'
}

function matchesPreseedIdentity(
  params: {
    create2Deployer: Address
    creatorToken: Address
    owner: Address
    batcherAddress: Address
    chainId: number
    vaultName: string
    vaultSymbol: string
    shareName: string
    shareSymbol: string
    baseVersion: string
    supportsPhase1WithSalt: boolean
  },
  plan: PerVaultVanityPreseedPlan,
): boolean {
  if (plan.batcherMode !== resolveBatcherMode(params.supportsPhase1WithSalt)) return false
  return (
    normalizeAddress(plan.create2Deployer) === normalizeAddress(params.create2Deployer) &&
    normalizeAddress(plan.creatorToken) === normalizeAddress(params.creatorToken) &&
    normalizeAddress(plan.owner) === normalizeAddress(params.owner) &&
    normalizeAddress(plan.batcher) === normalizeAddress(params.batcherAddress) &&
    plan.baseVersion === params.baseVersion &&
    plan.vaultName === params.vaultName &&
    plan.vaultSymbol === params.vaultSymbol &&
    plan.shareName === params.shareName &&
    plan.shareSymbol === params.shareSymbol
  )
}

function parseManifest(value: unknown): PerVaultVanityPreseedManifest {
  const raw = value as Partial<PerVaultVanityPreseedManifest>
  if (raw.schema !== PER_VAULT_VANITY_PRESEED_SCHEMA) {
    return { schema: PER_VAULT_VANITY_PRESEED_SCHEMA, chainId: 8453, plans: [] }
  }
  const plans = Array.isArray(raw.plans) ? raw.plans : []
  return {
    schema: PER_VAULT_VANITY_PRESEED_SCHEMA,
    chainId: typeof raw.chainId === 'number' ? raw.chainId : 8453,
    plans: plans.filter((plan): plan is PerVaultVanityPreseedPlan => {
      if (!plan || typeof plan !== 'object') return false
      const entry = plan as Partial<PerVaultVanityPreseedPlan>
      return (
        typeof entry.id === 'string' &&
        typeof entry.create2Deployer === 'string' &&
        typeof entry.creatorToken === 'string' &&
        typeof entry.owner === 'string' &&
        typeof entry.batcher === 'string' &&
        typeof entry.baseVersion === 'string' &&
        typeof entry.deploymentVersion === 'string' &&
        typeof entry.versionSearchOutcome === 'string' &&
        (entry.batcherMode === 'salt' || entry.batcherMode === 'version')
      )
    }),
  }
}

const defaultManifest = parseManifest(bundledManifest)

export function isShareSuffixSatisfiedByDeploymentVersion(params: {
  create2Deployer: Address
  owner: Address
  shareSymbol: string
  deploymentVersion: string
  shareOftInitCode: Hex
  shareSuffix: string
}): boolean {
  const suffix = normalizeHexSuffix(params.shareSuffix)
  if (!suffix) return false
  const shareSalt = deriveShareOftSaltFromVersion({
    owner: params.owner,
    shareSymbol: params.shareSymbol,
    version: params.deploymentVersion,
  })
  const shareAddress = predictCreate2AddressFromInitCode({
    create2Deployer: params.create2Deployer,
    salt: shareSalt,
    initCode: params.shareOftInitCode,
  })
  return shareAddress.toLowerCase().endsWith(suffix)
}

export function lookupPreseededVanityVersionPlan(
  params: LookupPreseededVanityVersionPlanParams,
  manifest: PerVaultVanityPreseedManifest = defaultManifest,
): PreseededVanityVersionPlan | null {
  if (manifest.chainId !== params.chainId) return null
  const vaultPrefix = normalizeHexSuffix(params.vaultPrefix)
  const shareSuffix = normalizeHexSuffix(params.shareSuffix)
  if (!vaultPrefix && !shareSuffix) return null

  for (const plan of manifest.plans) {
    if (!matchesPreseedIdentity(params, plan)) continue
    if (normalizeHexSuffix(plan.vaultPrefix) !== vaultPrefix) continue
    if (normalizeHexSuffix(plan.shareSuffix) !== shareSuffix) continue
    if (!plan.deploymentVersion.trim()) continue
    return {
      deploymentVersion: plan.deploymentVersion,
      outcome: plan.versionSearchOutcome,
      planId: plan.id,
    }
  }
  return null
}

export function lookupPreseededShareOftSalt(
  params: LookupPreseededShareOftSaltParams,
  manifest: PerVaultVanityPreseedManifest = defaultManifest,
): Hex | null {
  if (!params.supportsPhase1WithSalt) return null
  if (manifest.chainId !== params.chainId) return null
  const shareSuffix = normalizeHexSuffix(params.shareOftVanitySuffix)
  if (!shareSuffix) return null

  for (const plan of manifest.plans) {
    if (!matchesPreseedIdentity(params, plan)) continue
    if (normalizeHexSuffix(plan.shareSuffix) !== shareSuffix) continue
    if (plan.deploymentVersion !== params.deploymentVersion) continue
    const salt = plan.shareOftSalt
    if (typeof salt !== 'string' || !salt.startsWith('0x') || salt.length !== 66) continue
    return salt as Hex
  }
  return null
}