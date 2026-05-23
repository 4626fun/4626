import { encodeFunctionData, type Address, type Hex } from 'viem'

import {
  GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
  ENTRY_POINT_V06_BASE,
} from '../../../src/lib/wallet/cswOwnerAbi.js'

const USER_OP_GAS_BUFFER_UNITS = 400_000n
const ENTRY_POINT_V06 = ENTRY_POINT_V06_BASE

const CSW_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const ENTRY_POINT_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export type RelayDepositSimulation = {
  ok: boolean
  error: string | null
  funderBalanceWei: string
  depositWei: string
  gasBufferWei: string
  /** Present for CSW self-auth: golden Part 1 EntryPoint prefund reference. */
  entryPointPrefundWei?: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'unknown simulation error'
}

function isDepositoryDepositNativeCall(userCall: {
  to: Address
  data: Hex
}): boolean {
  return (
    userCall.to.toLowerCase() === RELAY_DEPOSITORY_BASE.toLowerCase() &&
    userCall.data.slice(0, 10).toLowerCase() === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR
  )
}

function encodeCswExecuteBatchDeposit(userCall: {
  to: Address
  data: Hex
  value: bigint
}): Hex {
  return encodeFunctionData({
    abi: CSW_EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [
      [
        {
          target: userCall.to,
          value: userCall.value,
          data: userCall.data,
        },
      ],
    ],
  })
}

async function funderIsDeployedContract(params: {
  publicClient: {
    getBytecode?: (args: { address: Address }) => Promise<Hex | undefined>
  }
  address: Address
}): Promise<boolean> {
  if (typeof params.publicClient.getBytecode !== 'function') return false
  const bytecode = await params.publicClient.getBytecode({ address: params.address }).catch(() => undefined)
  return Boolean(bytecode && bytecode !== '0x')
}

export async function simulateRelayDepositUserCall(params: {
  publicClient: {
    call: (args: {
      account: Address
      to: Address
      data: Hex
      value?: bigint
    }) => Promise<unknown>
    getBalance: (args: { address: Address }) => Promise<bigint>
    getGasPrice: () => Promise<bigint>
    getBytecode?: (args: { address: Address }) => Promise<Hex | undefined>
    readContract?: (args: {
      address: Address
      abi: readonly unknown[]
      functionName: string
      args: readonly unknown[]
    }) => Promise<unknown>
  }
  funderAddress: Address
  userCall: {
    to: Address
    data: Hex
    value: `0x${string}`
  }
}): Promise<RelayDepositSimulation> {
  let depositWei: bigint
  try {
    depositWei = BigInt(params.userCall.value)
  } catch {
    return {
      ok: false,
      error: 'Relay deposit value is not valid wei.',
      funderBalanceWei: '0',
      depositWei: '0',
      gasBufferWei: '0',
    }
  }

  const funderIsSmartWallet = await funderIsDeployedContract({
    publicClient: params.publicClient,
    address: params.funderAddress,
  })

  const [funderBalanceWei, gasPrice, entryPointDepositWei] = await Promise.all([
    params.publicClient.getBalance({ address: params.funderAddress }),
    params.publicClient.getGasPrice(),
    funderIsSmartWallet && typeof params.publicClient.readContract === 'function'
      ? params.publicClient
          .readContract({
            address: ENTRY_POINT_V06,
            abi: ENTRY_POINT_BALANCE_OF_ABI,
            functionName: 'balanceOf',
            args: [params.funderAddress],
          })
          .then((value) => (typeof value === 'bigint' ? value : 0n))
          .catch(() => 0n)
      : Promise.resolve(0n),
  ])

  const gasBufferWei = gasPrice * USER_OP_GAS_BUFFER_UNITS
  const entryPointPrefundWei = funderIsSmartWallet
    ? GOLDEN_RELAY_PART1_ENTRYPOINT_PREFUND_WEI
    : 0n
  const gasReserveWei = funderIsSmartWallet
    ? (entryPointPrefundWei > gasBufferWei ? entryPointPrefundWei : gasBufferWei)
    : gasBufferWei

  // Depository value must come from CSW native balance. Gas can draw from native
  // and/or the CSW's EntryPoint deposit bucket (golden Part 1 internal tx #1).
  const combinedGasBudget = funderBalanceWei + entryPointDepositWei
  const requiredWei = depositWei + gasReserveWei

  if (funderBalanceWei < depositWei) {
    return {
      ok: false,
      error: `Funder native balance (${funderBalanceWei.toString()} wei) is below Relay deposit (${depositWei.toString()} wei). Fund ${params.funderAddress} and rebuild preview.`,
      funderBalanceWei: funderBalanceWei.toString(10),
      depositWei: depositWei.toString(10),
      gasBufferWei: gasReserveWei.toString(10),
      entryPointPrefundWei: entryPointPrefundWei > 0n ? entryPointPrefundWei.toString(10) : undefined,
    }
  }

  if (combinedGasBudget < requiredWei) {
    return {
      ok: false,
      error: `Funder balance (${funderBalanceWei.toString()} wei native + ${entryPointDepositWei.toString()} wei EntryPoint deposit) is below Relay deposit + UserOp gas reserve (${requiredWei.toString()} wei). Top up native ETH or EntryPoint.depositTo(${params.funderAddress}) and rebuild preview.`,
      funderBalanceWei: funderBalanceWei.toString(10),
      depositWei: depositWei.toString(10),
      gasBufferWei: gasReserveWei.toString(10),
      entryPointPrefundWei: entryPointPrefundWei > 0n ? entryPointPrefundWei.toString(10) : undefined,
    }
  }

  try {
    if (funderIsSmartWallet && isDepositoryDepositNativeCall(params.userCall)) {
      // Golden Part 1: CSW UserOp → executeBatch([Depository.depositNative]).
      await params.publicClient.call({
        account: params.funderAddress,
        to: params.funderAddress,
        data: encodeCswExecuteBatchDeposit({
          to: params.userCall.to,
          data: params.userCall.data,
          value: depositWei,
        }),
        value: depositWei,
      })
    } else {
      await params.publicClient.call({
        account: params.funderAddress,
        to: params.userCall.to,
        data: params.userCall.data,
        value: depositWei,
      })
    }
    return {
      ok: true,
      error: null,
      funderBalanceWei: funderBalanceWei.toString(10),
      depositWei: depositWei.toString(10),
      gasBufferWei: gasReserveWei.toString(10),
      entryPointPrefundWei: entryPointPrefundWei > 0n ? entryPointPrefundWei.toString(10) : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: `Relay deposit simulation reverted: ${errorMessage(error)}`,
      funderBalanceWei: funderBalanceWei.toString(10),
      depositWei: depositWei.toString(10),
      gasBufferWei: gasReserveWei.toString(10),
      entryPointPrefundWei: entryPointPrefundWei > 0n ? entryPointPrefundWei.toString(10) : undefined,
    }
  }
}
