import { describe, expect, it, vi } from 'vitest'

import { submitOwnerViaPreparedCallsWithEoaOwner } from './eoaOwnerPreparedCalls'
import { _submitOwnerViaPreparedCallsWithEoaOwner } from './onboardingWalletPrepared'

const SENDER = '0x3333333333333333333333333333333333333333' as const
const OWNER = '0x1111111111111111111111111111111111111111' as const
const VALID_ADD_OWNER_DATA = `0x0f0f3f24${'0'.repeat(24)}${OWNER.slice(2)}` as const
const PREPARE_HASH = `0x${'11'.repeat(32)}` as const

describe('prepared owner drift guards', () => {
  it('rejects mismatched prepared userOp calldata in eoaOwnerPreparedCalls before signing', async () => {
    const cswRequest = vi.fn().mockResolvedValueOnce({
      type: 'user-operation-v06',
      chainId: '0x2105',
      signatureRequest: { hash: PREPARE_HASH },
      userOp: { sender: SENDER, callData: '0xdeadbeef' },
    })
    const signerRequest = vi.fn()

    await expect(
      submitOwnerViaPreparedCallsWithEoaOwner({
        cswRequest,
        signerRequest,
        eoaOwnerAddress: OWNER,
        eoaOwnerIndex: 0,
        chainId: 8453,
        sender: SENDER,
        to: SENDER,
        data: VALID_ADD_OWNER_DATA,
        paymasterUrl: null,
      }),
    ).rejects.toThrow(/no longer matches the expected addOwnerAddress calldata/i)

    expect(signerRequest).not.toHaveBeenCalled()
  })

  it('rejects mismatched prepared userOp calldata in onboardingWalletPrepared before signing', async () => {
    const cswRequest = vi.fn().mockResolvedValueOnce({
      type: 'user-operation-v06',
      chainId: '0x2105',
      signatureRequest: { hash: PREPARE_HASH },
      userOp: { sender: SENDER, callData: '0xdeadbeef' },
    })
    const signerRequest = vi.fn()

    await expect(
      _submitOwnerViaPreparedCallsWithEoaOwner({
        cswRequest,
        signerRequest,
        eoaOwnerAddress: OWNER,
        eoaOwnerIndex: 0,
        chainId: 8453,
        sender: SENDER,
        to: SENDER,
        data: VALID_ADD_OWNER_DATA,
        paymasterUrl: null,
        approvalRunId: 'run-1',
        executionMode: 'canonicalSmartWallet',
        canonicalCswAddress: SENDER,
        onStageEvent: null,
      }),
    ).rejects.toThrow(/no longer matches the expected addOwnerAddress calldata/i)

    expect(signerRequest).not.toHaveBeenCalled()
  })
})
