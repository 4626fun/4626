import { describe, expect, it } from 'vitest'

import { detectSignerType } from './detectSignerType'
import { TARGET_ALLOWED_OWNER_EOA_ADDRESSES } from '../canonicalWalletPolicy'

describe('detectSignerType', () => {
  it('classifies eoa when onchain bytecode confirms EOA, even with AA capability hints', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: true, atomicStatus: 'unknown', supports5792: true },
      hasContractCode: false,
    })
    expect(result).toBe('EOA')
  })

  it('classifies smart wallet when onchain code exists', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: false, atomicStatus: 'unsupported', supports5792: false },
      hasContractCode: true,
    })
    expect(result).toBe('SMART_WALLET')
  })

  it('classifies smart wallet when code is unknown and capabilities indicate paymaster', () => {
    const result = detectSignerType({
      signerAddress: '0x1111111111111111111111111111111111111111',
      capabilities: { paymasterService: true, atomicStatus: 'unknown', supports5792: true },
      hasContractCode: null,
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

  it('keeps canonical owner EOAs classified as EOA when bytecode is empty', () => {
    const result = detectSignerType({
      signerAddress: TARGET_ALLOWED_OWNER_EOA_ADDRESSES[0],
      capabilities: { paymasterService: true, atomicStatus: 'ready', supports5792: true },
      hasContractCode: false,
    })
    expect(result).toBe('EOA')
  })
})

