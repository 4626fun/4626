/** Minimal CreatorShareOFT + gauge ABI for hub-initiated remote fee flush. */
export const shareOftFeeFlushAbi = [
  {
    type: 'function',
    name: 'pendingFees',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'flushThreshold',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isHub',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteFlushFees',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteRemoteFeeFlushRequest',
    inputs: [
      { name: 'dstEid', type: 'uint32' },
      { name: 'executorNativeDrop', type: 'uint128' },
    ],
    outputs: [
      {
        name: 'fee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'requestRemoteFeeFlush',
    inputs: [
      { name: 'dstEid', type: 'uint32' },
      { name: 'executorNativeDrop', type: 'uint128' },
    ],
    outputs: [
      {
        name: 'receipt',
        type: 'tuple',
        components: [
          { name: 'guid', type: 'bytes32' },
          { name: 'nonce', type: 'uint64' },
          {
            name: 'fee',
            type: 'tuple',
            components: [
              { name: 'nativeFee', type: 'uint256' },
              { name: 'lzTokenFee', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    stateMutability: 'payable',
  },
] as const

export const gaugeReceiveBridgedFeesAbi = [
  {
    type: 'function',
    name: 'receiveBridgedFees',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pendingFees',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accountedOFTBalance',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'shareOFT',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const
