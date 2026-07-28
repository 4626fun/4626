import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'

/** Universal Router sentinel: pull the router's full token balance. */
const UR_CONTRACT_BALANCE = 1n << 255n

const SENDER = getAddress('0x1000000000000000000000000000000000000001')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const WETH = getAddress('0x4200000000000000000000000000000000000006')
const ROUTER = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43')
const ADDRESS_THIS = getAddress('0x0000000000000000000000000000000000000002')

const EXECUTE_ABI = parseAbi(['function execute(bytes commands, bytes[] inputs) payable'])

function encodePermit2Transfer(token: Address, amount: bigint): Hex {
  return encodeAbiParameters(parseAbiParameters('address,address,uint160'), [
    token,
    ROUTER,
    amount,
  ])
}

function encodeV3SwapExactIn(params: {
  recipient: Address
  amountIn: bigint
  amountOutMinimum: bigint
  path: Hex
  payerIsUser?: boolean
}): Hex {
  return encodeAbiParameters(parseAbiParameters('address,uint256,uint256,bytes,bool'), [
    params.recipient,
    params.amountIn,
    params.amountOutMinimum,
    params.path,
    params.payerIsUser ?? false,
  ])
}

function encodeSweep(token: Address, recipient: Address, amountMin: bigint): Hex {
  return encodeAbiParameters(parseAbiParameters('address,address,uint256'), [
    token,
    recipient,
    amountMin,
  ])
}

export function encodeMinimalWethFundingExecute(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
  recipient?: Address
  transferToken?: Address
  /** Test-only: real funding plans must keep this false after Permit2 transfer. */
  payerIsUser?: boolean
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const transferToken = params.transferToken ?? WETH
  const recipient = params.recipient ?? sender
  const path = encodePacked(['address', 'uint24', 'address'], [WETH, 3000, creatorCoin])
  const commands = '0x020004' as Hex
  const inputs: Hex[] = [
    encodePermit2Transfer(transferToken, params.inputAmount),
    encodeV3SwapExactIn({
      recipient,
      amountIn: params.inputAmount,
      amountOutMinimum: params.amountOutMinimum,
      path,
      // Consume WETH already pulled onto the router via Permit2 — never re-pull from user.
      payerIsUser: params.payerIsUser,
    }),
    encodeSweep(creatorCoin, recipient, 0n),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

/**
 * Malicious plan: two Permit2 WETH pulls of the reviewed amount, then swap the
 * router's full balance (CONTRACT_BALANCE) so spend exceeds the reviewed deposit.
 */
export function encodeDoublePermit2WethFundingExecute(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const path = encodePacked(['address', 'uint24', 'address'], [WETH, 3000, creatorCoin])
  const commands = '0x02020004' as Hex
  const inputs: Hex[] = [
    encodePermit2Transfer(WETH, params.inputAmount),
    encodePermit2Transfer(WETH, params.inputAmount),
    encodeV3SwapExactIn({
      recipient: sender,
      amountIn: UR_CONTRACT_BALANCE,
      amountOutMinimum: params.amountOutMinimum,
      path,
    }),
    encodeSweep(creatorCoin, sender, 0n),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

/** Malicious native-ETH plan: WRAP_ETH plus an extra Permit2 WETH pull. */
export function encodeNativeEthFundingWithPermit2Pull(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const path = encodePacked(['address', 'uint24', 'address'], [WETH, 3000, creatorCoin])
  const commands = '0x0b020004' as Hex
  const inputs: Hex[] = [
    encodeAbiParameters(parseAbiParameters('address,uint256'), [ADDRESS_THIS, params.inputAmount]),
    encodePermit2Transfer(WETH, params.inputAmount),
    encodeV3SwapExactIn({
      recipient: sender,
      amountIn: UR_CONTRACT_BALANCE,
      amountOutMinimum: params.amountOutMinimum,
      path,
    }),
    encodeSweep(creatorCoin, sender, 0n),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

/** Malicious V4 plan: valid WETH→creator delivery plus SETTLE(token, amount, payerIsUser). */
export function encodeWethFundingWithV4SettlePull(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
  settleToken: Address
  settleAmount: bigint
  settlePayerIsUser: boolean
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const v4Actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [0x06, 0x0b, 0x0e], // SWAP_EXACT_IN_SINGLE, SETTLE, TAKE
  )
  const zeroForOne = WETH.toLowerCase() < creatorCoin.toLowerCase()
  const v4Params: Hex[] = [
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            {
              name: 'poolKey',
              type: 'tuple',
              components: [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
              ],
            },
            { name: 'zeroForOne', type: 'bool' },
            { name: 'amountIn', type: 'uint128' },
            { name: 'amountOutMinimum', type: 'uint128' },
            { name: 'hookData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          poolKey: {
            currency0: zeroForOne ? WETH : creatorCoin,
            currency1: zeroForOne ? creatorCoin : WETH,
            fee: 3000,
            tickSpacing: 60,
            hooks: '0x0000000000000000000000000000000000000000',
          },
          zeroForOne,
          amountIn: params.inputAmount,
          amountOutMinimum: params.amountOutMinimum,
          hookData: '0x',
        },
      ],
    ),
    encodeAbiParameters(parseAbiParameters('address,uint256,bool'), [
      params.settleToken,
      params.settleAmount,
      params.settlePayerIsUser,
    ]),
    encodeAbiParameters(parseAbiParameters('address,address,uint256'), [
      creatorCoin,
      sender,
      params.amountOutMinimum,
    ]),
  ]
  const commands = '0x0210' as Hex // PERMIT2_TRANSFER_FROM + V4_SWAP
  const inputs: Hex[] = [
    encodePermit2Transfer(WETH, params.inputAmount),
    encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), [v4Actions, v4Params]),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

export function encodeMinimalNativeEthFundingExecute(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const path = encodePacked(['address', 'uint24', 'address'], [WETH, 3000, creatorCoin])
  const commands = '0x0b0004' as Hex
  const inputs: Hex[] = [
    encodeAbiParameters(parseAbiParameters('address,uint256'), [ADDRESS_THIS, params.inputAmount]),
    encodeV3SwapExactIn({
      recipient: sender,
      amountIn: params.inputAmount,
      amountOutMinimum: params.amountOutMinimum,
      path,
    }),
    encodeSweep(creatorCoin, sender, 0n),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

