import { describe, expect, it } from 'vitest'

import { detectSignerType } from './detectSignerType'

describe('detectSignerType', () => {
  it('classifies smart wallet when capabilities indicate paymaster', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: true, atomicStatus: 'unknown', supports5792: true },
      hasContractCode: false,
    })
    expect(result).toBe('SMART_WALLET')
  })

  it('classifies smart wallet when onchain code exists', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: false, atomicStatus: 'unsupported', supports5792: false },
      hasContractCode: true,
    })
    expect(result).toBe('SMART_WALLET')
  })

  it('classifies eoa when no AA capabilities and no code', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: false, atomicStatus: 'unknown', supports5792: false },
      hasContractCode: false,
    })
    expect(result).toBe('EOA')
  })
})

