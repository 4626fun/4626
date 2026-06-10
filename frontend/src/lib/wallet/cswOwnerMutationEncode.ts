import { encodeFunctionData } from 'viem'

/** Wrap raw CSW mutation calldata for Relay same-chain call-execution quotes. */
export function encodeExecuteWithoutChainIdValidation(
  innerCallData: `0x${string}`,
): `0x${string}` {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executeWithoutChainIdValidation',
        inputs: [{ name: 'calls', type: 'bytes[]' }],
        outputs: [],
        stateMutability: 'payable',
      },
    ] as const,
    functionName: 'executeWithoutChainIdValidation',
    args: [[innerCallData]],
  })
}
