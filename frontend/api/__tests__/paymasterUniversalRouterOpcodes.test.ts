import { describe, expect, it } from 'vitest'
import { encodeFunctionData, getAddress, type Hex } from 'viem'

import { assertSwapRouterPayloadReferencesToken } from '../_handlers/paymaster/_paymaster.ts'

const UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const TOKEN = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const TOKEN_INPUT = `0x${'0'.repeat(24)}${TOKEN.slice(2)}${'0'.repeat(64)}` as Hex

function encodeExecute(command: number): Hex {
  return encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [`0x${command.toString(16).padStart(2, '0')}`, [TOKEN_INPUT], 1n],
  })
}

describe('Universal Router paymaster command validation', () => {
  it('accepts an allowed command with the 0x80 allow-revert flag', () => {
    expect(() => assertSwapRouterPayloadReferencesToken(encodeExecute(0x8a), TOKEN)).not.toThrow()
  })

  it.each(
    [0x40, 0x41, 0x42, 0x43, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x50].map((command) => ({
      command,
      label: `0x${command.toString(16)}`,
    })),
  )(
    'rejects reserved-bit opcode $label instead of aliasing it through the 0x3f mask',
    ({ command }) => {
      expect(() => assertSwapRouterPayloadReferencesToken(encodeExecute(command), TOKEN)).toThrow(
        'swap_router_command_not_allowed',
      )
    },
  )

  it('also rejects reserved bit 0x40 when allow-revert bit 0x80 is set', () => {
    expect(() => assertSwapRouterPayloadReferencesToken(encodeExecute(0xca), TOKEN)).toThrow(
      'swap_router_command_not_allowed',
    )
  })
})
