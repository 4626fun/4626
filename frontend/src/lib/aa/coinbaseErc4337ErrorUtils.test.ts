import { describe, expect, it } from 'vitest'

import {
  buildPreflightSimulationRejectionError,
  isDeterministicUserOpExecutionError,
  isPreflightSimulationRejection,
  PreflightSimulationRejectionError,
} from './coinbaseErc4337ErrorUtils'

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
})
