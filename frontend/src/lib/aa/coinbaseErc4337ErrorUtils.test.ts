import { describe, expect, it } from 'vitest'

import {
  buildPreflightSimulationRejectionError,
  isSwapPreflightSimulationRetryable,
  buildUserOpGasEstimateFailureError,
  extractUserOpReceiptTxHash,
  isBundlerStubSignatureSimulationArtifact,
  isDeterministicUserOpExecutionError,
  isEchoedBundlerUserOpCallData,
  isExecutionRevertedLikeError,
  isPaymasterInternalProxyError,
  isPaymasterPolicyError,
  isPreflightSimulationRejection,
  mapUserOpExecutionFailureMessage,
  PreflightSimulationRejectionError,
  resolveUserOpCallGasLimit,
  shouldAdvisorySkipBundlerGasEstimate,
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

describe('isEchoedBundlerUserOpCallData', () => {
  it('detects execute and executeBatch echoed payloads', () => {
    const longExecute = `0xb61d27f6${'ab'.repeat(120)}` as `0x${string}`
    const longBatch = `0x34fcd5be${'cd'.repeat(120)}` as `0x${string}`
    expect(isEchoedBundlerUserOpCallData(longExecute)).toBe(true)
    expect(isEchoedBundlerUserOpCallData(longBatch)).toBe(true)
    expect(isEchoedBundlerUserOpCallData('0x2c4029e9')).toBe(false)
  })
})

describe('isPaymasterInternalProxyError', () => {
  it('is not treated as a sponsorship policy denial', () => {
    const err = new Error('request denied - paymaster proxy internal error')
    expect(isPaymasterInternalProxyError(err)).toBe(true)
    expect(isPaymasterPolicyError(err)).toBe(false)
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

describe('isSwapPreflightSimulationRetryable', () => {
  it('treats paymaster approve-only policy rejections as retryable', () => {
    expect(
      isSwapPreflightSimulationRetryable(
        new Error('request denied - approve_only_not_allowed'),
      ),
    ).toBe(true)
  })
})

describe('shouldAdvisorySkipBundlerGasEstimate', () => {
  const ZORA_ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43'
  const ZORA_FLOOR = 2_500_000n
  const ECHOED_EXECUTE =
    '0xb61d27f60000000000000000000000006ff5693b99212da76ad316178a184ab56d299b430000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000009e824856bc30000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000060a02001004040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000003400000000000000000000000000000000000000000000000000000000000000460000000000000000000000000000000000000000000000000000000000000084000000000000000000000000000000000000000000000000000000000000008c000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000144e4a45000000000000000000000000000000000000000000000000000000006a17d02400000000000000000000000000000000000000000000000000000000000000020000000000000000000000006ff5693b99212da76ad316178a184ab56d299b43000000000000000000000000000000000000000000000000000000006a17d02400000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000413dc678842ee812c74c7c54b2622ddb06d3118cd9332f97f05657a792551c25c86b17f5eab472400a48b0043b9689c62fd074ebcfbdb7d69b61d4c98b33940ce71b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4300000000000000000000000000000000000000000000000000000000144e4a4500000000000000000000000000000000000000000000000000000000000001000000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006b36e4e8b220b4f1d3a00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b833589fcd6edb6e08f4c7c32d4f71b54bda02913000bb81111111111166b7fe7bd91427724b487980afc6900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000030b070e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000000600000000000000000000000001111111111166b7fe7bd91427724b487980afc698000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000001111111111166b7fe7bd91427724b487980afc6900000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000213e56d1e418d6f39c232b000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000000000000000000000000000000000000000753000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000d61a675f8a0c67a73dc3b54fb7318b4d9140904000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000' as const

  it('skips when Zora floor is set and estimate returns echoed UserOp callData with invalid params', () => {
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: {
          message: 'Invalid parameters were provided to the RPC method.',
          data: ECHOED_EXECUTE,
        },
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
      }),
    ).toBe(true)
  })

  it('skips executeBatch echoed callData with Missing or invalid parameters', () => {
    const echoedBatch =
      `${ECHOED_EXECUTE.slice(0, 10)}4fcd5be${ECHOED_EXECUTE.slice(10)}` as typeof ECHOED_EXECUTE
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: {
          message:
            'An error occurred while executing user operation: Missing or invalid parameters. Double check you have provided the correct parameters.',
        },
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
        preflightDirectCallSucceeded: true,
      }),
    ).toBe(true)
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: {
          message:
            'An error occurred while executing user operation: Missing or invalid parameters. Double check you have provided the correct parameters.',
          data: echoedBatch,
        },
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
        preflightDirectCallSucceeded: true,
      }),
    ).toBe(true)
  })

  it('does not skip when bundler returns ExecutionFailed revert data', () => {
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: {
          message: 'Execution reverted for an unknown reason.',
          data: '0x2c4029e9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
        },
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
        preflightDirectCallSucceeded: true,
      }),
    ).toBe(false)
  })

  it('skips InvalidContractSignature when preflight direct call succeeded', () => {
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: {
          message: 'Execution reverted for an unknown reason.',
          data: '0xb0669cbc0000000000000000000000000000000000000000000000000000000000000000',
        },
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
        preflightDirectCallSucceeded: true,
      }),
    ).toBe(true)
  })

  it('skips Uniswap Universal Router execute when floor is set', () => {
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: new Error('Execution reverted for an unknown reason.'),
        firstCallTo: ZORA_ROUTER,
        floorCallGasLimit: ZORA_FLOOR,
      }),
    ).toBe(true)
  })

  it('does not skip without a swap-router callGas floor', () => {
    expect(
      shouldAdvisorySkipBundlerGasEstimate({
        error: new Error('Execution reverted for an unknown reason.'),
        firstCallTo: ZORA_ROUTER,
      }),
    ).toBe(false)
  })
})

describe('isBundlerStubSignatureSimulationArtifact', () => {
  it('detects InvalidContractSignature stub artifacts after successful preflight', () => {
    expect(
      isBundlerStubSignatureSimulationArtifact('0xb0669cbc0000000000000000000000000000000000000000000000000000000000000000', true),
    ).toBe(true)
    expect(
      isBundlerStubSignatureSimulationArtifact(
        '0x2c4029e9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
        true,
      ),
    ).toBe(false)
  })
})

describe('buildUserOpGasEstimateFailureError', () => {
  it('maps Zora router estimate failures to preflight-style copy', () => {
    const err = buildUserOpGasEstimateFailureError(
      new Error('Execution reverted for an unknown reason.'),
      '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    )
    expect(err.message).toContain('stale')
    expect(err.message).toContain('slippage')
  })
})

describe('resolveUserOpCallGasLimit', () => {
  it('buffers bundler estimate and keeps Zora floor when higher', () => {
    expect(
      resolveUserOpCallGasLimit({
        estimatedCallGasLimit: 2_000_000n,
        floorCallGasLimit: 1_800_000n,
      }),
    ).toBe(2_600_000n)
    expect(
      resolveUserOpCallGasLimit({
        estimatedCallGasLimit: 1_000_000n,
        floorCallGasLimit: 1_800_000n,
      }),
    ).toBe(1_800_000n)
  })
})

describe('mapUserOpExecutionFailureMessage', () => {
  it('maps unknown execution revert strings to swap copy', () => {
    const err = mapUserOpExecutionFailureMessage(
      {
        name: 'RpcRequestError',
        message: 'Execution reverted for an unknown reason.',
        details: 'execution reverted',
      },
      { firstCallTo: '0x6fF5693b99212Da76ad316178A184AB56D299b43' },
    )
    expect(err).toBeInstanceOf(PreflightSimulationRejectionError)
    expect(err?.message).toContain('would fail on-chain')
  })
})

describe('buildPreflightSimulationRejectionError', () => {
  it('returns generic swap copy for Universal Router ExecutionFailed without slippage hint', () => {
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
    expect(err.message).toContain('would fail on-chain')
    expect(isPreflightSimulationRejection(err)).toBe(true)
    expect(isSwapPreflightSimulationRetryable(err)).toBe(true)
  })

  it('returns slippage-specific copy when inner revert indicates minOut failure', () => {
    const err = buildPreflightSimulationRejectionError({
      simResult: {
        directCallResult: {
          errorName: 'ExecutionFailed(uint256,bytes)',
          revertData:
            '0x2c4029e900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000486aa621000000000000000000000000000000000000000000000000000000000',
        },
      },
      firstCallTo: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    })
    expect(err.message).toContain('Slippage tolerance is too tight')
    expect(isSwapPreflightSimulationRetryable(err)).toBe(true)
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

  it('returns Permit2 InvalidNonce copy when inner revert is 0x756688fe', () => {
    const err = buildPreflightSimulationRejectionError({
      simResult: {
        directCallResult: {
          errorName: 'ExecutionFailed(uint256,bytes)',
          revertData:
            '0x2c4029e900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000756688fe00000000000000000000000000000000000000000000000000000000',
        },
      },
      firstCallTo: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    })
    expect(err.message).toContain('Permit2 authorization is stale')
    expect(err.message).not.toContain('slippage')
    expect(isSwapPreflightSimulationRetryable(err)).toBe(true)
  })
})
