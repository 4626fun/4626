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

const SENDER = getAddress('0x1000000000000000000000000000000000000001')
const CREATOR = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const WETH = getAddress('0x4200000000000000000000000000000000000006')
const ROUTER = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43')
const ADDRESS_THIS = getAddress('0x0000000000000000000000000000000000000002')

const EXECUTE_ABI = parseAbi(['function execute(bytes commands, bytes[] inputs) payable'])

export function encodeMinimalWethFundingExecute(params: {
  sender?: Address
  creatorCoin?: Address
  inputAmount: bigint
  amountOutMinimum: bigint
  recipient?: Address
  transferToken?: Address
}): Hex {
  const sender = params.sender ?? SENDER
  const creatorCoin = params.creatorCoin ?? CREATOR
  const transferToken = params.transferToken ?? WETH
  const recipient = params.recipient ?? sender
  const path = encodePacked(['address', 'uint24', 'address'], [WETH, 3000, creatorCoin])
  const commands = '0x020004' as Hex
  const inputs: Hex[] = [
    encodeAbiParameters(parseAbiParameters('address,address,uint160'), [
      transferToken,
      ROUTER,
      params.inputAmount,
    ]),
    encodeAbiParameters(parseAbiParameters('address,uint256,uint256,bytes,bool'), [
      recipient,
      params.inputAmount,
      params.amountOutMinimum,
      path,
      true,
    ]),
    encodeAbiParameters(parseAbiParameters('address,address,uint256'), [
      creatorCoin,
      recipient,
      0n,
    ]),
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
    encodeAbiParameters(parseAbiParameters('address,uint256,uint256,bytes,bool'), [
      sender,
      params.inputAmount,
      params.amountOutMinimum,
      path,
      false,
    ]),
    encodeAbiParameters(parseAbiParameters('address,address,uint256'), [creatorCoin, sender, 0n]),
  ]
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands, inputs],
  })
}

