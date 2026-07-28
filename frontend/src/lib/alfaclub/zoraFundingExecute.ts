import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'

/** Base WETH — must match ethFundingRouter.BASE_WETH_TOKEN. */
const BASE_WETH_TOKEN = getAddress('0x4200000000000000000000000000000000000006')

/** Zora Base Universal Router — must match ethFundingRouter.ZORA_BASE_UNIVERSAL_ROUTER. */
const ZORA_BASE_UNIVERSAL_ROUTER = getAddress(
  '0x6ff5693b99212da76ad316178a184ab56d299b43',
)

/** Universal Router sentinel: pull the router's full token balance. */
export const UR_CONTRACT_BALANCE = 1n << 255n

const MSG_SENDER = getAddress('0x0000000000000000000000000000000000000001')
const ADDRESS_THIS = getAddress('0x0000000000000000000000000000000000000002')

const ZORA_EXECUTE_ABI = parseAbi([
  'function execute(bytes commands, bytes[] inputs) payable',
])

const CMD_V3_SWAP_EXACT_IN = 0x00
const CMD_PERMIT2_TRANSFER_FROM = 0x02
const CMD_SWEEP = 0x04
const CMD_PERMIT2_PERMIT = 0x0a
const CMD_WRAP_ETH = 0x0b
const CMD_V4_SWAP = 0x10

const ALLOWED_FUNDING_COMMANDS = new Set<number>([
  CMD_V3_SWAP_EXACT_IN,
  CMD_PERMIT2_TRANSFER_FROM,
  CMD_SWEEP,
  CMD_PERMIT2_PERMIT,
  CMD_WRAP_ETH,
  CMD_V4_SWAP,
])

// Must match Uniswap v4-periphery Actions.sol (TAKE=0x0e, not the pre-SETTLE_PAIR layout).
const V4_ACTION_SWAP_EXACT_IN_SINGLE = 0x06
const V4_ACTION_SWAP_EXACT_IN = 0x07
const V4_ACTION_SETTLE = 0x0b
const V4_ACTION_TAKE = 0x0e
const V4_ACTION_TAKE_ALL = 0x0f

const ALLOWED_V4_ACTIONS = new Set<number>([
  V4_ACTION_SWAP_EXACT_IN_SINGLE,
  V4_ACTION_SWAP_EXACT_IN,
  V4_ACTION_SETTLE,
  V4_ACTION_TAKE,
  V4_ACTION_TAKE_ALL,
])

/** v4 ActionConstants.OPEN_DELTA — spend the open credit rather than a literal zero. */
const V4_OPEN_DELTA = 0n

const V4_SETTLE_PARAMS = parseAbiParameters(
  'address currency, uint256 amount, bool payerIsUser',
)
const V4_TAKE_PARAMS = parseAbiParameters(
  'address currency, address recipient, uint256 amount',
)
const V4_TAKE_ALL_PARAMS = parseAbiParameters('address currency, uint256 minAmount')

const V3_SWAP_PARAMS = parseAbiParameters(
  'address recipient, uint256 amountIn, uint256 amountOutMin, bytes path, bool payerIsUser',
)
const PERMIT2_TRANSFER_PARAMS = parseAbiParameters(
  'address token, address recipient, uint160 amount',
)
const SWEEP_PARAMS = parseAbiParameters(
  'address token, address recipient, uint256 amountMin',
)
const WRAP_ETH_PARAMS = parseAbiParameters('address recipient, uint256 amount')
// PermitSingle is static-sized; decode only the head so placeholder signatures
// (non-hex ASCII from Zora before finalization) cannot break funding validation.
const PERMIT2_PERMIT_HEAD_PARAMS = parseAbiParameters(
  'address token, uint160 amount, uint48 expiration, uint48 nonce, address spender, uint256 sigDeadline',
)
const V4_SWAP_PARAMS = parseAbiParameters('bytes actions, bytes[] params')
const V4_EXACT_INPUT_PARAMS = [
  {
    type: 'tuple',
    components: [
      { name: 'currencyIn', type: 'address' },
      {
        name: 'path',
        type: 'tuple[]',
        components: [
          { name: 'intermediateCurrency', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
      { name: 'amountIn', type: 'uint128' },
      { name: 'amountOutMinimum', type: 'uint128' },
    ],
  },
] as const
const V4_EXACT_INPUT_SINGLE_PARAMS = [
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
] as const

export type ZoraFundingExecuteMode = 'wethPermit2' | 'nativeEth'

export type AssertZoraFundingExecuteParams = {
  data: Hex
  sender: Address
  creatorCoin: Address
  /** Deposited WETH / native ETH amount that must fund the swap. */
  inputAmount: bigint
  mode: ZoraFundingExecuteMode
  /** When set, calldata amountOutMinimum must cover this Sudoswap buy limit. */
  minOutputAmount?: bigint
}

export type ZoraFundingExecuteInspection = {
  amountOutMinimum: bigint
  inputAmount: bigint
}

function isSenderRecipient(recipient: Address, sender: Address): boolean {
  return recipient === sender || recipient === MSG_SENDER
}

function readPackedPathToken(path: Hex, byteOffset: number): Address {
  const totalBytes = Math.max(0, Math.floor((path.length - 2) / 2))
  if (byteOffset < 0 || byteOffset + 20 > totalBytes) {
    throw new Error('ETH funding V3 path is invalid')
  }
  const start = 2 + byteOffset * 2
  return getAddress(`0x${path.slice(start, start + 40)}`)
}

function normalizeAmountIn(amountIn: bigint, expected: bigint): void {
  if (amountIn === UR_CONTRACT_BALANCE || amountIn === expected) return
  throw new Error('ETH funding swap input amount does not match the deposited WETH')
}

function normalizeV4AmountIn(amountIn: bigint, expected: bigint): void {
  if (
    amountIn === V4_OPEN_DELTA ||
    amountIn === UR_CONTRACT_BALANCE ||
    amountIn === expected
  ) {
    return
  }
  throw new Error('ETH funding V4 swap input amount does not match the deposited WETH')
}

function assertFundingWethCurrency(currency: Address, label: string): void {
  if (currency !== BASE_WETH_TOKEN) {
    throw new Error(`ETH funding ${label} must use WETH`)
  }
}

/**
 * Decode Zora Universal Router `execute(bytes,bytes[])` funding calldata and bind
 * WETH input, creator-coin output, recipient, and guaranteed minimum output.
 */
export function assertZoraFundingExecute(
  params: AssertZoraFundingExecuteParams,
): ZoraFundingExecuteInspection {
  const sender = getAddress(params.sender)
  const creatorCoin = getAddress(params.creatorCoin)
  if (params.inputAmount <= 0n) {
    throw new Error('ETH funding input amount must be positive')
  }

  let decoded: ReturnType<typeof decodeFunctionData>
  try {
    decoded = decodeFunctionData({ abi: ZORA_EXECUTE_ABI, data: params.data })
  } catch {
    throw new Error('ETH funding quote calldata is not a Zora router execute call')
  }
  if (decoded.functionName !== 'execute') {
    throw new Error('ETH funding quote calldata is not a Zora router execute call')
  }

  const [commands, inputs] = decoded.args as [Hex, Hex[]]
  const commandCount = Math.max(0, Math.floor((commands.length - 2) / 2))
  if (commandCount === 0 || inputs.length !== commandCount) {
    throw new Error('ETH funding router command plan is invalid')
  }

  let sawWrapEth = false
  let sawPermit2TransferWeth = false
  let creatorDeliveredToSender = false
  let amountOutMinimum = 0n
  let v3PathStartsWithWeth = false
  let v4OutputsCreatorCoin = false

  for (let i = 0; i < commandCount; i++) {
    const opcode = Number.parseInt(commands.slice(2 + i * 2, 4 + i * 2), 16)
    if ((opcode & 0x40) !== 0 || (opcode & 0x80) !== 0) {
      throw new Error('ETH funding router command flags are not allowed')
    }
    const command = opcode & 0x3f
    if (!ALLOWED_FUNDING_COMMANDS.has(command)) {
      throw new Error('ETH funding router command is not allowed')
    }
    const input = inputs[i]
    if (!input) throw new Error('ETH funding router command input is missing')

    if (command === CMD_WRAP_ETH) {
      if (sawWrapEth) {
        throw new Error('ETH funding quote must wrap ETH only once')
      }
      if (sawPermit2TransferWeth) {
        throw new Error('ETH funding quote must not combine WRAP_ETH with Permit2 WETH pulls')
      }
      const [recipient, amount] = decodeAbiParameters(WRAP_ETH_PARAMS, input)
      if (
        getAddress(recipient) !== ADDRESS_THIS &&
        getAddress(recipient) !== ZORA_BASE_UNIVERSAL_ROUTER
      ) {
        throw new Error('ETH funding WRAP_ETH recipient must be the Zora router')
      }
      if (amount !== params.inputAmount && amount !== UR_CONTRACT_BALANCE) {
        throw new Error('ETH funding WRAP_ETH amount does not match the funded ETH')
      }
      sawWrapEth = true
      continue
    }

    if (command === CMD_PERMIT2_PERMIT) {
      const [tokenRaw, amount, _expiration, _nonce, spenderRaw] = decodeAbiParameters(
        PERMIT2_PERMIT_HEAD_PARAMS,
        input,
      )
      const token = getAddress(tokenRaw)
      const spender = getAddress(spenderRaw)
      if (token !== BASE_WETH_TOKEN) {
        throw new Error('ETH funding Permit2 permit must authorize WETH')
      }
      if (spender !== ZORA_BASE_UNIVERSAL_ROUTER) {
        throw new Error('ETH funding Permit2 permit spender must be the Zora router')
      }
      if (BigInt(amount) < params.inputAmount) {
        throw new Error('ETH funding Permit2 permit amount is below the funded WETH')
      }
      continue
    }

    if (command === CMD_PERMIT2_TRANSFER_FROM) {
      // One reviewed WETH deposit only. A second pull (or Permit2 after WRAP_ETH) plus
      // amountIn=CONTRACT_BALANCE would spend multiples of the user-reviewed amount.
      if (params.mode === 'nativeEth') {
        throw new Error('Native ETH funding must not pull WETH through Permit2')
      }
      if (sawWrapEth) {
        throw new Error('ETH funding quote must not combine WRAP_ETH with Permit2 WETH pulls')
      }
      if (sawPermit2TransferWeth) {
        throw new Error('ETH funding quote must pull deposited WETH through Permit2 only once')
      }
      const [token, recipient, amount] = decodeAbiParameters(PERMIT2_TRANSFER_PARAMS, input)
      if (getAddress(token) !== BASE_WETH_TOKEN) {
        throw new Error('ETH funding Permit2 transfer must pull WETH only')
      }
      const to = getAddress(recipient)
      if (to !== ZORA_BASE_UNIVERSAL_ROUTER && to !== ADDRESS_THIS) {
        throw new Error('ETH funding Permit2 transfer recipient must be the Zora router')
      }
      if (BigInt(amount) !== params.inputAmount) {
        throw new Error('ETH funding Permit2 transfer amount does not match the deposited WETH')
      }
      sawPermit2TransferWeth = true
      continue
    }

    if (command === CMD_V3_SWAP_EXACT_IN) {
      const [recipient, amountIn, amountOutMin, path, payerIsUser] = decodeAbiParameters(
        V3_SWAP_PARAMS,
        input,
      )
      const pathBytes = Math.max(0, Math.floor((path.length - 2) / 2))
      if (pathBytes < 43 || (pathBytes - 20) % 23 !== 0) {
        throw new Error('ETH funding V3 path is invalid')
      }
      const pathStart = readPackedPathToken(path, 0)
      const pathEnd = readPackedPathToken(path, pathBytes - 20)
      if (pathStart !== BASE_WETH_TOKEN) {
        throw new Error('ETH funding V3 path must start with WETH')
      }
      v3PathStartsWithWeth = true
      normalizeAmountIn(amountIn, params.inputAmount)
      // WRAP_ETH / Permit2 already fund the router. payerIsUser would pull a second
      // inputAmount from the wallet (extra WETH beyond the reviewed deposit).
      if (payerIsUser) {
        throw new Error('ETH funding must not pull V3 input from the user')
      }
      if (pathEnd === creatorCoin) {
        amountOutMinimum = amountOutMinimum > amountOutMin ? amountOutMinimum : amountOutMin
        if (isSenderRecipient(getAddress(recipient), sender)) {
          creatorDeliveredToSender = true
        }
      }
      continue
    }

    if (command === CMD_V4_SWAP) {
      const [actions, actionParams] = decodeAbiParameters(V4_SWAP_PARAMS, input)
      const actionCount = Math.max(0, Math.floor((actions.length - 2) / 2))
      if (actionCount === 0 || actionParams.length !== actionCount) {
        throw new Error('ETH funding V4 action plan is invalid')
      }
      for (let j = 0; j < actionCount; j++) {
        const action = Number.parseInt(actions.slice(2 + j * 2, 4 + j * 2), 16)
        if (!ALLOWED_V4_ACTIONS.has(action)) {
          throw new Error('ETH funding V4 action is not allowed')
        }
        const actionInput = actionParams[j]
        if (!actionInput) throw new Error('ETH funding V4 action input is missing')

        if (action === V4_ACTION_SWAP_EXACT_IN) {
          const [exactIn] = decodeAbiParameters(V4_EXACT_INPUT_PARAMS, actionInput)
          if (!exactIn.path.length) {
            throw new Error('ETH funding V4 exact-in path is empty')
          }
          assertFundingWethCurrency(getAddress(exactIn.currencyIn), 'V4 exact-in')
          normalizeV4AmountIn(BigInt(exactIn.amountIn), params.inputAmount)
          const outToken = getAddress(
            exactIn.path[exactIn.path.length - 1]!.intermediateCurrency,
          )
          if (outToken !== creatorCoin) {
            throw new Error('ETH funding V4 exact-in path must end at the creator coin')
          }
          v4OutputsCreatorCoin = true
          amountOutMinimum =
            amountOutMinimum > exactIn.amountOutMinimum
              ? amountOutMinimum
              : exactIn.amountOutMinimum
          continue
        }

        if (action === V4_ACTION_SWAP_EXACT_IN_SINGLE) {
          const [exactIn] = decodeAbiParameters(V4_EXACT_INPUT_SINGLE_PARAMS, actionInput)
          const tokenIn = getAddress(
            exactIn.zeroForOne ? exactIn.poolKey.currency0 : exactIn.poolKey.currency1,
          )
          const tokenOut = getAddress(
            exactIn.zeroForOne ? exactIn.poolKey.currency1 : exactIn.poolKey.currency0,
          )
          assertFundingWethCurrency(tokenIn, 'V4 single-hop')
          normalizeV4AmountIn(BigInt(exactIn.amountIn), params.inputAmount)
          if (tokenOut !== creatorCoin) {
            throw new Error('ETH funding V4 single-hop output must be the creator coin')
          }
          v4OutputsCreatorCoin = true
          amountOutMinimum =
            amountOutMinimum > exactIn.amountOutMinimum
              ? amountOutMinimum
              : exactIn.amountOutMinimum
          continue
        }

        if (action === V4_ACTION_SETTLE) {
          const [currencyRaw, amount, payerIsUser] = decodeAbiParameters(
            V4_SETTLE_PARAMS,
            actionInput,
          )
          assertFundingWethCurrency(getAddress(currencyRaw), 'V4 SETTLE')
          if (payerIsUser) {
            throw new Error('ETH funding V4 SETTLE must not pull WETH from the user')
          }
          if (
            amount !== params.inputAmount &&
            amount !== UR_CONTRACT_BALANCE &&
            amount !== V4_OPEN_DELTA
          ) {
            throw new Error('ETH funding V4 SETTLE amount does not match the funded WETH')
          }
          continue
        }

        if (action === V4_ACTION_TAKE) {
          const [currencyRaw, recipientRaw] = decodeAbiParameters(V4_TAKE_PARAMS, actionInput)
          const currency = getAddress(currencyRaw)
          const recipient = getAddress(recipientRaw)
          if (currency !== creatorCoin && currency !== BASE_WETH_TOKEN) {
            throw new Error('ETH funding V4 TAKE token is not allowed')
          }
          if (!isSenderRecipient(recipient, sender)) {
            throw new Error('ETH funding V4 TAKE recipient must be the execution wallet')
          }
          if (currency === creatorCoin) {
            creatorDeliveredToSender = true
          }
          continue
        }

        if (action === V4_ACTION_TAKE_ALL) {
          const [currencyRaw, minAmount] = decodeAbiParameters(V4_TAKE_ALL_PARAMS, actionInput)
          const currency = getAddress(currencyRaw)
          if (currency !== creatorCoin && currency !== BASE_WETH_TOKEN) {
            throw new Error('ETH funding V4 TAKE_ALL token is not allowed')
          }
          // TAKE_ALL always credits msgSender in V4Router.
          if (currency === creatorCoin) {
            creatorDeliveredToSender = true
            if (minAmount > amountOutMinimum) amountOutMinimum = minAmount
          }
          continue
        }

        throw new Error('ETH funding V4 action is not allowed')
      }
      continue
    }

    if (command === CMD_SWEEP) {
      const [token, recipient, amountMin] = decodeAbiParameters(SWEEP_PARAMS, input)
      const swept = getAddress(token)
      const to = getAddress(recipient)
      if (!isSenderRecipient(to, sender)) {
        throw new Error('ETH funding SWEEP recipient must be the execution wallet')
      }
      if (swept === creatorCoin) {
        creatorDeliveredToSender = true
        if (amountMin > amountOutMinimum) amountOutMinimum = amountMin
      } else if (swept !== BASE_WETH_TOKEN) {
        throw new Error('ETH funding SWEEP token is not allowed')
      }
    }
  }

  if (params.mode === 'wethPermit2') {
    if (sawWrapEth) {
      throw new Error('WETH funding quote must not wrap native ETH')
    }
    if (!sawPermit2TransferWeth) {
      throw new Error('WETH funding quote must pull the deposited WETH through Permit2')
    }
  } else if (!sawWrapEth) {
    throw new Error('Native ETH funding quote must wrap ETH in the Zora router')
  }

  if (!v3PathStartsWithWeth && !v4OutputsCreatorCoin) {
    throw new Error('ETH funding quote must swap deposited WETH toward the creator coin')
  }
  if (!creatorDeliveredToSender) {
    throw new Error('ETH funding quote must deliver the creator coin to the execution wallet')
  }
  if (amountOutMinimum <= 0n) {
    throw new Error('ETH funding quote is missing a guaranteed creator-coin minimum')
  }
  if (params.minOutputAmount !== undefined && amountOutMinimum < params.minOutputAmount) {
    throw new Error('ETH funding guaranteed output does not cover the Sudoswap buy limit')
  }

  return { amountOutMinimum, inputAmount: params.inputAmount }
}
