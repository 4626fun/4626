import { afterEach, describe, expect, it } from 'vitest'

import {
  BASE_DEFAULTS,
  LEGACY_DEPLOYMENT_BATCHER,
  MODULE_MISMATCH_DEPLOYMENT_BATCHER,
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_SALT_DISABLED_BATCHER,
  isShareOftSaltOverrideDisabledBatcher,
  normalizeCreatorVaultBatcherAddress,
} from '../../src/config/contracts.defaults.ts'
import { getApiContracts } from '../../server/_lib/onchain/contracts.ts'

const ENV_KEYS = [
  'CREATOR_VAULT_BATCHER',
  'CREATOR_VAULT_BATCHER_AUTO_HANDOFF',
  'ALLOW_API_CONTRACT_OVERRIDES',
  'VERCEL',
] as const

function clearBatcherEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
}

afterEach(() => {
  clearBatcherEnv()
})

describe('creatorVaultBatcher config normalization', () => {
  it('normalizeCreatorVaultBatcherAddress rejects deprecated aliases', () => {
    expect(normalizeCreatorVaultBatcherAddress(LEGACY_DEPLOYMENT_BATCHER)).toBeUndefined()
    expect(normalizeCreatorVaultBatcherAddress(MODULE_MISMATCH_DEPLOYMENT_BATCHER)).toBeUndefined()
    expect(normalizeCreatorVaultBatcherAddress(PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER)).toBeUndefined()
  })

  it('normalizeCreatorVaultBatcherAddress keeps canonical batcher', () => {
    expect(normalizeCreatorVaultBatcherAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  })

  it('isShareOftSaltOverrideDisabledBatcher includes known salt-disabled split batchers', () => {
    expect(isShareOftSaltOverrideDisabledBatcher(SPLIT_PHASE1_SALT_DISABLED_BATCHER)).toBe(true)
    expect(isShareOftSaltOverrideDisabledBatcher(PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER)).toBe(true)
    expect(isShareOftSaltOverrideDisabledBatcher(LEGACY_DEPLOYMENT_BATCHER)).toBe(false)
  })

  it('getApiContracts falls back to canonical default for deprecated env override in local/dev mode', () => {
    process.env.CREATOR_VAULT_BATCHER = LEGACY_DEPLOYMENT_BATCHER
    const contracts = getApiContracts()
    expect(contracts.creatorVaultBatcher).toBe(BASE_DEFAULTS.creatorVaultBatcher)
  })

  it('getApiContracts accepts canonical batcher env override', () => {
    process.env.CREATOR_VAULT_BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER
    const contracts = getApiContracts()
    expect(contracts.creatorVaultBatcher).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  })

  it('getApiContracts ignores env overrides on Vercel unless explicitly allowed', () => {
    process.env.VERCEL = '1'
    process.env.CREATOR_VAULT_BATCHER = LEGACY_DEPLOYMENT_BATCHER
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES

    const contracts = getApiContracts()
    expect(contracts.creatorVaultBatcher).toBe(BASE_DEFAULTS.creatorVaultBatcher)
  })
})
