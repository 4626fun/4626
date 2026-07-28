import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { BASE_DEFAULTS } from '../../../src/config/contracts.defaults.js'
import { BASE_MAINNET_REGISTRY_4626 } from './ensureBatcherRegistryAuthorization.js'

describe('ensureBatcherRegistryAuthorization registry pin', () => {
  it('defaults to the current BASE_DEFAULTS Registry4626 (v1.20.0 hard cutover)', () => {
    expect(getAddress(BASE_MAINNET_REGISTRY_4626)).toBe(getAddress(BASE_DEFAULTS.registry))
    expect(getAddress(BASE_MAINNET_REGISTRY_4626)).toBe(
      getAddress('0xF60a1490C4129f2b6ae540734D3C2C8C6111824e'),
    )
  })
})
