import { type Hex } from 'viem'

import type { DeploymentVanityVersionSearchOutcome } from './deployVaultHelpers'

export const DEPLOY_VANITY_PLAN_STORAGE_KEY = 'cv:deploy:vanity-plans:v1'
const DEPLOY_VANITY_PLAN_STORAGE_SCHEMA = 1
const MAX_PERSISTED_VANITY_ENTRIES = 64

type VanityPlanStorage = {
  schema: number
  versions: Record<string, { version: string; outcome?: DeploymentVanityVersionSearchOutcome }>
  salts: Record<string, { salt: Hex }>
}

export type VanityVersionCacheKeyParams = {
  create2Deployer: string
  creatorToken: string
  owner: string
  chainId: number
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  baseVersion: string
  vaultPrefix: string | null
  shareSuffix: string | null
  vaultVanityMaxTries: number
  shareOftVanityMaxTries: number
  supportsPhase1WithSalt: boolean
}

export type ShareOftVanityCacheKeyParams = {
  create2Deployer: string
  initCodeHash: string
  shareOftVanitySuffix: string
  shareOftVanityMaxTries: number
  deploymentVersion: string
  creatorToken: string
  owner: string
}

export function buildVanityVersionCacheKey(params: VanityVersionCacheKeyParams): string {
  return [
    params.create2Deployer.toLowerCase(),
    params.creatorToken.toLowerCase(),
    params.owner.toLowerCase(),
    String(params.chainId),
    params.vaultName,
    params.vaultSymbol,
    params.shareName,
    params.shareSymbol,
    params.baseVersion,
    params.vaultPrefix ?? '',
    params.shareSuffix ?? '',
    String(params.vaultVanityMaxTries),
    String(params.shareOftVanityMaxTries),
    params.supportsPhase1WithSalt ? 'salt' : 'version',
  ].join(':')
}

export function buildShareOftVanityCacheKey(params: ShareOftVanityCacheKeyParams): string {
  return [
    params.create2Deployer.toLowerCase(),
    params.initCodeHash.toLowerCase(),
    params.shareOftVanitySuffix,
    String(params.shareOftVanityMaxTries),
    params.deploymentVersion,
    params.creatorToken.toLowerCase(),
    params.owner.toLowerCase(),
  ].join(':')
}

function emptyVanityPlanStorage(): VanityPlanStorage {
  return { schema: DEPLOY_VANITY_PLAN_STORAGE_SCHEMA, versions: {}, salts: {} }
}

function readVanityPlanStorage(): VanityPlanStorage {
  if (typeof window === 'undefined') return emptyVanityPlanStorage()
  try {
    const raw = window.localStorage.getItem(DEPLOY_VANITY_PLAN_STORAGE_KEY)
    if (!raw) return emptyVanityPlanStorage()
    const parsed = JSON.parse(raw) as Partial<VanityPlanStorage>
    if (parsed.schema !== DEPLOY_VANITY_PLAN_STORAGE_SCHEMA) return emptyVanityPlanStorage()
    return {
      schema: DEPLOY_VANITY_PLAN_STORAGE_SCHEMA,
      versions: typeof parsed.versions === 'object' && parsed.versions ? parsed.versions : {},
      salts: typeof parsed.salts === 'object' && parsed.salts ? parsed.salts : {},
    }
  } catch {
    return emptyVanityPlanStorage()
  }
}

function trimPersistedEntries<T>(record: Record<string, T>): Record<string, T> {
  const keys = Object.keys(record)
  if (keys.length <= MAX_PERSISTED_VANITY_ENTRIES) return record
  const trimmed = keys.slice(keys.length - MAX_PERSISTED_VANITY_ENTRIES)
  const out: Record<string, T> = {}
  for (const key of trimmed) {
    const value = record[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

function writeVanityPlanStorage(store: VanityPlanStorage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      DEPLOY_VANITY_PLAN_STORAGE_KEY,
      JSON.stringify({
        schema: DEPLOY_VANITY_PLAN_STORAGE_SCHEMA,
        versions: trimPersistedEntries(store.versions),
        salts: trimPersistedEntries(store.salts),
      } satisfies VanityPlanStorage),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function readPersistedVanityVersionPlan(cacheKey: string): {
  version: string
  outcome?: DeploymentVanityVersionSearchOutcome
} | null {
  const entry = readVanityPlanStorage().versions[cacheKey]
  if (!entry || typeof entry.version !== 'string' || !entry.version.trim()) return null
  return { version: entry.version, outcome: entry.outcome }
}

export function writePersistedVanityVersionPlan(
  cacheKey: string,
  plan: { version: string; outcome?: DeploymentVanityVersionSearchOutcome },
): void {
  const store = readVanityPlanStorage()
  store.versions[cacheKey] = plan
  writeVanityPlanStorage(store)
}

export function readPersistedShareOftVanitySalt(cacheKey: string): Hex | null {
  const entry = readVanityPlanStorage().salts[cacheKey]
  if (!entry || typeof entry.salt !== 'string' || !entry.salt.startsWith('0x')) return null
  return entry.salt as Hex
}

export function writePersistedShareOftVanitySalt(cacheKey: string, salt: Hex): void {
  const store = readVanityPlanStorage()
  store.salts[cacheKey] = { salt }
  writeVanityPlanStorage(store)
}