import { afterEach, describe, expect, it } from 'vitest'

import {
  BASE_DEFAULTS,
  LEGACY_DEPLOYMENT_BATCHER,
  MODULE_MISMATCH_DEPLOYMENT_BATCHER,
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  SPLIT_PHASE1_SALT_DISABLED_BATCHER,
  isShareOftSaltOverrideDisabledBatcher,
  normalizeDeploymentBatcherAddress,
} from '../../src/config/contracts.defaults.ts'
import { getApiContracts } from '../../server/_lib/onchain/contracts.ts'

const ENV_KEYS = [
  'DEPLOYMENT_BATCHER',
  'DEPLOYMENT_BATCHER_AUTO_HANDOFF',
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

describe('deploymentBatcher config normalization', () => {
  it('normalizeDeploymentBatcherAddress rejects deprecated aliases', () => {
    expect(normalizeDeploymentBatcherAddress(LEGACY_DEPLOYMENT_BATCHER)).toBeUndefined()
    expect(normalizeDeploymentBatcherAddress(MODULE_MISMATCH_DEPLOYMENT_BATCHER)).toBeUndefined()
    expect(normalizeDeploymentBatcherAddress(PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER)).toBeUndefined()
  })

  it('normalizeDeploymentBatcherAddress keeps canonical batcher', () => {
    expect(normalizeDeploymentBatcherAddress(SPLIT_PHASE1_DEPLOYMENT_BATCHER)).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  })

  it('isShareOftSaltOverrideDisabledBatcher includes known salt-disabled split batchers', () => {
    expect(isShareOftSaltOverrideDisabledBatcher(SPLIT_PHASE1_SALT_DISABLED_BATCHER)).toBe(true)
    expect(isShareOftSaltOverrideDisabledBatcher(PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER)).toBe(true)
    expect(isShareOftSaltOverrideDisabledBatcher(LEGACY_DEPLOYMENT_BATCHER)).toBe(false)
  })

  it('getApiContracts falls back to canonical default for deprecated env override in local/dev mode', () => {
    process.env.DEPLOYMENT_BATCHER = LEGACY_DEPLOYMENT_BATCHER
    const contracts = getApiContracts()
    expect(contracts.deploymentBatcher).toBe(BASE_DEFAULTS.deploymentBatcher)
  })

  it('getApiContracts accepts canonical batcher env override', () => {
    process.env.DEPLOYMENT_BATCHER = SPLIT_PHASE1_DEPLOYMENT_BATCHER
    const contracts = getApiContracts()
    expect(contracts.deploymentBatcher).toBe(SPLIT_PHASE1_DEPLOYMENT_BATCHER)
  })

  it('getApiContracts ignores env overrides on Vercel unless explicitly allowed', () => {
    process.env.VERCEL = '1'
    process.env.DEPLOYMENT_BATCHER = LEGACY_DEPLOYMENT_BATCHER
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES

    const contracts = getApiContracts()
    expect(contracts.deploymentBatcher).toBe(BASE_DEFAULTS.deploymentBatcher)
  })
})
