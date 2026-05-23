import { describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import { hasDeployedBytecode, readIsOwnerAddressIfDeployed } from './cswOwnerRead'

const SUB = getAddress('0x9d01012E95D07d44f9173ADe047F0A63c8939020')
const EMBED = getAddress('0xB2aaD65A5402714bf428a66731ae62BA5c45CAC0')

describe('cswOwnerRead', () => {
  it('hasDeployedBytecode rejects empty code', () => {
    expect(hasDeployedBytecode(null)).toBe(false)
    expect(hasDeployedBytecode('0x')).toBe(false)
    expect(hasDeployedBytecode('0x60016000')).toBe(true)
  })

  it('readIsOwnerAddressIfDeployed returns null for counterfactual addresses', async () => {
    const publicClient = {
      getBytecode: vi.fn(async () => '0x' as const),
      readContract: vi.fn(),
    }

    const result = await readIsOwnerAddressIfDeployed({
      publicClient,
      cswAddress: SUB,
      ownerAddress: EMBED,
    })

    expect(result).toBeNull()
    expect(publicClient.readContract).not.toHaveBeenCalled()
  })

  it('readIsOwnerAddressIfDeployed reads owner state when bytecode exists', async () => {
    const publicClient = {
      getBytecode: vi.fn(async () => '0x60016000' as const),
      readContract: vi.fn(async () => true),
    }

    const result = await readIsOwnerAddressIfDeployed({
      publicClient,
      cswAddress: SUB,
      ownerAddress: EMBED,
    })

    expect(result).toBe(true)
    expect(publicClient.readContract).toHaveBeenCalled()
  })
})
