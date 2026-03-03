import { describe, expect, it } from 'vitest'

import {
  TARGET_ALLOWED_OWNER_EOA_ADDRESSES,
  TARGET_CANONICAL_CSW_ADDRESS,
  isAllowedCanonicalSigner,
  isAllowedOwnerEoa,
  isEoaAddressByCode,
  isTargetCanonicalCsw,
  resolvePolicyCanonicalAddress,
  shouldApplyCanonicalEnforcement,
} from './canonicalWalletPolicy'

describe('canonicalWalletPolicy', () => {
  it('detects target canonical smart wallet address', () => {
    expect(isTargetCanonicalCsw(TARGET_CANONICAL_CSW_ADDRESS)).toBe(true)
    expect(isTargetCanonicalCsw('0x1111111111111111111111111111111111111111')).toBe(false)
  })

  it('detects allowed owner EOAs', () => {
    expect(isAllowedOwnerEoa(TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0])).toBe(true)
    expect(isAllowedCanonicalSigner(TARGET_ALLOWED_OWNER_EOA_ADDRESSES[1])).toBe(true)
    expect(isAllowedCanonicalSigner(TARGET_CANONICAL_CSW_ADDRESS)).toBe(true)
    expect(isAllowedOwnerEoa('0x1111111111111111111111111111111111111111')).toBe(false)
  })

  it('applies canonical enforcement for target canonical or allowed owner signer', () => {
    expect(
      shouldApplyCanonicalEnforcement({
        canonicalAddress: TARGET_CANONICAL_CSW_ADDRESS,
      }),
    ).toBe(true)
    expect(
      shouldApplyCanonicalEnforcement({
        signerAddress: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[2],
      }),
    ).toBe(true)
    expect(
      shouldApplyCanonicalEnforcement({
        canonicalAddress: '0x1111111111111111111111111111111111111111',
        signerAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false)
  })

  it('resolves canonical address to target when signer is an allowed owner', () => {
    const resolved = resolvePolicyCanonicalAddress({
      canonicalAddress: null,
      signerAddress: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
    })
    expect(resolved).toBe(TARGET_CANONICAL_CSW_ADDRESS)
  })

  it('validates EOA addresses by bytecode', async () => {
    const eoaResult = await isEoaAddressByCode({
      address: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
      getBytecode: async () => null,
    })
    const contractResult = await isEoaAddressByCode({
      address: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
      getBytecode: async () => '0x1234',
    })
    expect(eoaResult).toBe(true)
    expect(contractResult).toBe(false)
  })
})
