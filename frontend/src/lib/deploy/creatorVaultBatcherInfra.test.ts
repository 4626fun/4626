import { describe, expect, it } from 'vitest'

import { parseCreatorVaultBatcherCapabilities } from './creatorVaultBatcherInfra'

describe('creatorVaultBatcherInfra', () => {
  it('detects salt-enabled selectors on greenfield batcher bytecode', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${[
        '4154f24e',
        '3bc09a8b',
      ].join('')}`,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(true)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(false)
  })

  it('marks salt overrides disabled when bytecode exposes the guard error selector', () => {
    const capabilities = parseCreatorVaultBatcherCapabilities({
      batcherAddress: '0xa99058f424FB3ACC639F59355C65C40149030651',
      batcherBytecode: `0x${['4154f24e', '3bc09a8b', 'e7fdf838'].join('')}`,
    })
    expect(capabilities.supportsPhase1WithSalt).toBe(false)
    expect(capabilities.saltOverridesDisabledByBatcher).toBe(true)
  })
})