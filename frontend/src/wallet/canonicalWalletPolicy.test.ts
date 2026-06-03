import { describe, expect, it } from 'vitest'

import {
  CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES,
  CANONICAL_CSW_ALLOWED_OWNER_EOAS,
  CANONICAL_CSW_ADDRESS,
  isAllowedCanonicalCswExecutionSigner,
  isAllowedCanonicalSigner,
  isAllowedOwnerEoa,
  isEoaAddressByCode,
  isCanonicalCsw,
  resolvePolicyCanonicalAddress,
  shouldApplyCanonicalEnforcement,
} from './canonicalWalletPolicy'

describe('canonicalWalletPolicy', () => {
  it('detects target canonical smart wallet address', () => {
    expect(isCanonicalCsw(CANONICAL_CSW_ADDRESS)).toBe(true)
    expect(isCanonicalCsw('0x1111111111111111111111111111111111111111')).toBe(false)
  })

  it('detects allowed owner EOAs', () => {
    expect(isAllowedOwnerEoa(CANONICAL_CSW_ALLOWED_OWNER_EOAS[0])).toBe(true)
    expect(isAllowedCanonicalSigner(CANONICAL_CSW_ALLOWED_OWNER_EOAS[1])).toBe(true)
    expect(isAllowedCanonicalSigner(CANONICAL_CSW_ADDRESS)).toBe(true)
    expect(isAllowedOwnerEoa('0x1111111111111111111111111111111111111111')).toBe(false)
  })

  it('allows the Privy embedded EOA to execute on the canonical CSW', () => {
    expect(isAllowedCanonicalCswExecutionSigner(CANONICAL_CSW_ALLOWED_OWNER_EOAS[3])).toBe(true)
    expect(CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES).toContain(
      '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
    )
  })

  it('applies canonical enforcement only for the platform canonical CSW identity', () => {
    expect(
      shouldApplyCanonicalEnforcement({
        canonicalAddress: CANONICAL_CSW_ADDRESS,
      }),
    ).toBe(true)
    expect(
      shouldApplyCanonicalEnforcement({
        executionAddress: CANONICAL_CSW_ADDRESS,
      }),
    ).toBe(true)
    expect(
      shouldApplyCanonicalEnforcement({
        canonicalAddress: '0x1111111111111111111111111111111111111111',
        signerAddress: CANONICAL_CSW_ALLOWED_OWNER_EOAS[0],
      }),
    ).toBe(false)
    expect(
      shouldApplyCanonicalEnforcement({
        canonicalAddress: '0x1111111111111111111111111111111111111111',
        signerAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false)
  })

  it('keeps execution allowlist aligned with allowed owner EOAs', () => {
    expect(CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES).toHaveLength(
      CANONICAL_CSW_ALLOWED_OWNER_EOAS.length,
    )
    for (const owner of CANONICAL_CSW_ALLOWED_OWNER_EOAS) {
      expect(isAllowedCanonicalCswExecutionSigner(owner)).toBe(true)
    }
  })

  it('resolves canonical address to target when signer is an allowed owner', () => {
    const resolved = resolvePolicyCanonicalAddress({
      canonicalAddress: null,
      signerAddress: CANONICAL_CSW_ALLOWED_OWNER_EOAS[0],
    })
    expect(resolved).toBe(CANONICAL_CSW_ADDRESS)
  })

  it('validates EOA addresses by bytecode', async () => {
    const eoaResult = await isEoaAddressByCode({
      address: CANONICAL_CSW_ALLOWED_OWNER_EOAS[0],
      getBytecode: async () => null,
    })
    const contractResult = await isEoaAddressByCode({
      address: CANONICAL_CSW_ALLOWED_OWNER_EOAS[0],
      getBytecode: async () => '0x1234',
    })
    expect(eoaResult).toBe(true)
    expect(contractResult).toBe(false)
  })
})
