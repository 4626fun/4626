import type { Address } from 'viem'

import {
  getDeployVanityFeatureKey,
  listDeployVanityFeatureKeysAtOrAbove,
  type CreatorStrategyFeatureKey,
} from '../../creatorStrategy/catalog.js'
import { hasLiveActivationForFeature, listActivationsForCreator } from '../../creatorStrategy/activations.js'

type DbLike = { sql?: unknown }

export type DeployFeaturePolicy = {
  key: CreatorStrategyFeatureKey | 'deploy_vanity'
  stages: Array<'create' | 'phase2b' | 'phase3' | 'phase4'>
  requiresAnyOf: CreatorStrategyFeatureKey[]
  failureCode: string
}

export const DEPLOY_FEATURE_POLICY_MATRIX: DeployFeaturePolicy[] = [
  {
    key: 'solana_ovault_mesh',
    stages: ['create', 'phase2b'],
    requiresAnyOf: ['solana_bridge_strategy', 'solana_ovault_mesh', 'solana_meteora_alpha_vault'],
    failureCode: 'feature_policy:ovault_mesh_entitlement_missing',
  },
  {
    key: 'deploy_vanity',
    stages: ['create'],
    requiresAnyOf: [],
    failureCode: 'feature_policy:deploy_vanity_entitlement_missing',
  },
  {
    key: 'charm_active_lp',
    stages: ['phase3'],
    requiresAnyOf: ['charm_active_lp'],
    failureCode: 'feature_policy:phase3_charm_missing',
  },
  {
    key: 'ajna_sleeve',
    stages: ['phase3'],
    requiresAnyOf: ['ajna_sleeve'],
    failureCode: 'feature_policy:phase3_ajna_missing',
  },
  {
    key: 'solana_bridge_strategy',
    stages: ['phase3'],
    requiresAnyOf: ['solana_bridge_strategy'],
    failureCode: 'feature_policy:phase3_solana_missing',
  },
]

export function readPolicyFlagEnabled(envName: string, defaultEnabled = true): boolean {
  const raw = String(process.env[envName] ?? '').trim().toLowerCase()
  if (!raw) return defaultEnabled
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false
  return true
}

export async function hasAnyFeatureActivation(params: {
  db: DbLike
  creatorToken: Address
  featureKeys: readonly CreatorStrategyFeatureKey[]
}): Promise<boolean> {
  for (const featureKey of params.featureKeys) {
    const ok = await hasLiveActivationForFeature(params.db as any, {
      creatorToken: params.creatorToken,
      featureKey,
    })
    if (ok) return true
  }
  return false
}

export async function missingDeployVanityFeatureHints(params: {
  db: DbLike
  creatorToken: Address
  vaultPrefixRequiredLength: number | null
  shareSuffixRequiredLength: number | null
}): Promise<string[]> {
  const missing: string[] = []
  if (params.vaultPrefixRequiredLength) {
    const keys = listDeployVanityFeatureKeysAtOrAbove({
      kind: 'vaultPrefix',
      minLength: params.vaultPrefixRequiredLength,
    })
    const entitled = await hasAnyFeatureActivation({
      db: params.db,
      creatorToken: params.creatorToken,
      featureKeys: keys as CreatorStrategyFeatureKey[],
    })
    if (!entitled) {
      const exact = getDeployVanityFeatureKey({
        kind: 'vaultPrefix',
        length: params.vaultPrefixRequiredLength,
      })
      if (exact) missing.push(`${exact} (or higher)`)
    }
  }
  if (params.shareSuffixRequiredLength) {
    const keys = listDeployVanityFeatureKeysAtOrAbove({
      kind: 'shareSuffix',
      minLength: params.shareSuffixRequiredLength,
    })
    const entitled = await hasAnyFeatureActivation({
      db: params.db,
      creatorToken: params.creatorToken,
      featureKeys: keys as CreatorStrategyFeatureKey[],
    })
    if (!entitled) {
      const exact = getDeployVanityFeatureKey({
        kind: 'shareSuffix',
        length: params.shareSuffixRequiredLength,
      })
      if (exact) missing.push(`${exact} (or higher)`)
    }
  }
  return missing
}

export async function listActiveCreatorFeatureKeys(params: {
  db: DbLike
  creatorToken: Address
}): Promise<CreatorStrategyFeatureKey[]> {
  const rows = await listActivationsForCreator(params.db as any, params.creatorToken)
  const out = new Set<CreatorStrategyFeatureKey>()
  for (const row of rows) {
    if (row.status !== 'active' && row.status !== 'pending') continue
    const raw = String(row.featureKey ?? '').trim()
    if (!raw) continue
    out.add(raw as CreatorStrategyFeatureKey)
  }
  return Array.from(out)
}

export function validateFeatureCompatibility(activeFeatureKeys: readonly CreatorStrategyFeatureKey[]): {
  ok: true
} | {
  ok: false
  code: string
  message: string
} {
  const set = new Set(activeFeatureKeys)
  if (set.has('solana_meteora_alpha_vault') && !set.has('solana_bridge_strategy')) {
    return {
      ok: false,
      code: 'feature_policy:meteora_requires_solana_bridge',
      message:
        'Meteora Alpha Vault requires Solana bridge strategy to be active first. Activate `solana_bridge_strategy` and retry.',
    }
  }
  return { ok: true }
}
