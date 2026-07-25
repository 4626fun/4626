import { getAbiItem, toFunctionSelector } from 'viem'
import { describe, expect, it } from 'vitest'

import { DEPLOYMENT_BATCHER_ABI } from '../../pages/deploy/deployVaultAbis'
import { CURRENT_DEPLOYMENT_BATCHER_SELECTORS } from './deploymentBatcherSelectors'
import { parseCreatorVaultBatcherCapabilities } from './deploymentBatcherInfra'

describe('deploymentBatcherInfra', () => {
  it.each([
    ['deployPhase1', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1],
    ['deployPhase1WithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1WithSalt],
    ['deployPhase1Core', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1Core],
    ['deployPhase1CoreWithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt],
    ['finalizePhase1', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1],
    ['finalizePhase1WithSalt', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt],
    ['finalizePhase2WithPermit2', CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase2WithPermit2],
  ] as const)('%s selector matches the current deploy ABI', (functionName, expectedSelector) => {
    const abiItem = getAbiItem({ abi: DEPLOYMENT_BATCHER_ABI, name: functionName })
    expect(toFunctionSelector(abiItem)).toBe(expectedSelector)
  })

  it('detects salt-enabled selectors on greenfield batcher bytecode', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
      ].join('')}`,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(true)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(false)
  })

  it('marks salt overrides disabled when bytecode exposes the guard error selector', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
        'e7fdf838',
      ].join('')}`,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(false)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(true)
  })

  it('reads restrictive salt semantics from the delegatecall Phase-1 module', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.deployPhase1CoreWithSalt.slice(2),
        CURRENT_DEPLOYMENT_BATCHER_SELECTORS.finalizePhase1WithSalt.slice(2),
      ].join('')}`,
      phase1ModuleBytecode: toFunctionSelector('InvalidShareOftSaltOverride()'),
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(false)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(true)
  })
})
