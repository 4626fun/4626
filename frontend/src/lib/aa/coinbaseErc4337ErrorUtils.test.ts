import { describe, expect, it } from 'vitest'

import {
  buildPreflightSimulationRejectionError,
  buildUserOpGasEstimateFailureError,
  extractUserOpReceiptTxHash,
  isDeterministicUserOpExecutionError,
  isExecutionRevertedLikeError,
  isPreflightSimulationRejection,
  PreflightSimulationRejectionError,
} from './coinbaseErc4337ErrorUtils'

describe('extractUserOpReceiptTxHash', () => {
  const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111'

  it('reads nested receipt.transactionHash', () => {
    expect(
      extractUserOpReceiptTxHash({
        receipt: { transactionHash: TX_HASH, status: '0x1' },
        success: true,
      }),
    ).toBe(TX_HASH)
  })

  it('reads top-level transactionHash', () => {
    expect(extractUserOpReceiptTxHash({ success: true, transactionHash: TX_HASH })).toBe(TX_HASH)
  })
})

describe('isDeterministicUserOpExecutionError', () => {
  it('treats ExecutionFailed and execution reverted as non-retryable', () => {
    expect(
      isDeterministicUserOpExecutionError(
        new Error('Execution reverted for an unknown reason.\n\nDetails: execution reverted'),
      ),
    ).toBe(true)
    expect(
      isDeterministicUserOpExecutionError({
        message: 'revert',
        data: '0x2c4029e90000000000000000000000000000000000000000000000000000000000000000',
      }),
    ).toBe(true)
  })

  it('does not treat rate limits as deterministic execution errors', () => {
    expect(
      isDeterministicUserOpExecutionError({ message: '429 Too Many Requests', code: 429 }),
    ).toBe(false)
  })
})

describe('isExecutionRevertedLikeError', () => {
  it('matches viem RpcRequestError-shaped failures', () => {
    expect(
      isExecutionRevertedLikeError({
        name: 'RpcRequestError',
        message: 'Execution reverted for an unknown reason.',
        details: 'execution reverted',
      }),
    ).toBe(true)
  })
})

describe('buildUserOpGasEstimateFailureError', () => {
  it('maps Zora router estimate failures to preflight-style copy', () => {
    const err = buildUserOpGasEstimateFailureError(
      new Error('Execution reverted for an unknown reason.'),
      '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    )
    expect(err.message).toContain('Zora swap would revert')
  })
})

describe('buildPreflightSimulationRejectionError', () => {
  it('returns Zora-specific copy for Universal Router calls', () => {
    const err = buildPreflightSimulationRejectionError({
      simResult: {
        directCallResult: {
          errorName: 'ExecutionFailed(uint256,bytes)',
          revertData: '0x2c4029e90000000000000000000000000000000000000000000000000000000000000000',
        },
      },
      firstCallTo: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    })
    expect(err).toBeInstanceOf(PreflightSimulationRejectionError)
    expect(err.message).toContain('Zora swap would revert')
    expect(err.message).toContain('Permit2')
    expect(isPreflightSimulationRejection(err)).toBe(true)
  })

  it('returns Permit2 signature copy when inner revert is InvalidContractSignature', () => {
    const err = buildPreflightSimulationRejectionError({
      simResult: {
        directCallResult: {
          errorName: 'ExecutionFailed(uint256,bytes)',
          revertData:
            '0x2c4029e9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004b0669cbc00000000000000000000000000000000000000000000000000000000',
        },
      },
      firstCallTo: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    })
    expect(err.message).toContain('Permit2 rejected the smart-wallet signature')
  })
})
