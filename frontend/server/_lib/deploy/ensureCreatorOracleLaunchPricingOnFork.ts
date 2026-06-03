import {
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from 'viem'

import type { ReadonlyPublicClient } from '../../../src/lib/cca/marketFloor.js'
import type { ForkImpersonationMode } from './ensureBatcherRegistryAuthorization.js'
import { resolveCreatorOracleUsdPriceForDryRun } from './resolveCreatorOracleUsdPrice.js'

/** Fallback only when market-floor resolution fails on the fork. */
export const DEFAULT_DRY_RUN_CREATOR_ORACLE_USD_PRICE = 10_000_000_000_000_000n

const CREATOR_ORACLE_LAUNCH_ABI = [
  {
    type: 'function',
    name: 'getCreatorPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'price', type: 'int256' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getEthPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'price', type: 'int256' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'initializeCreatorPrice',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_price', type: 'int256' }],
    outputs: [],
  },
] as const

const FORK_BALANCE_HEX = '0x3635C9ADC5DEA00000' as Hex

type OracleReadClient = {
  readContract: (args: {
    address: Address
    abi: typeof CREATOR_ORACLE_LAUNCH_ABI
    functionName: 'getCreatorPrice' | 'getEthPrice' | 'owner'
    args?: readonly unknown[]
  }) => Promise<unknown>
}

type SendTransactionClient = {
  sendTransaction: (args: {
    account: Address
    to: Address
    data: Hex
    value?: bigint
    chain?: unknown
  }) => Promise<Hex>
}

type WaitReceiptClient = {
  waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status?: string }>
}

async function impersonateOnFork(params: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
  account: Address
}): Promise<void> {
  await params.request({
    method: params.forkMode.setBalanceMethod,
    params: [params.account, FORK_BALANCE_HEX],
  })
  await params.request({
    method: params.forkMode.impersonateMethod,
    params: [params.account],
  })
}

function readSignedPrice(result: unknown): bigint {
  if (Array.isArray(result)) {
    const raw = result[0]
    if (typeof raw === 'bigint') return raw
    if (typeof raw === 'number') return BigInt(raw)
    if (typeof raw === 'string') return BigInt(raw)
  }
  return 0n
}

async function resolveInitialCreatorUsdPrice(params: {
  creatorToken?: Address
  ethUsdPrice1e18: bigint
  explicitPrice?: bigint
  publicClient: OracleReadClient & ReadonlyPublicClient
}): Promise<{ price1e18: bigint; source: 'explicit' | 'market_floor' | 'fallback_default'; detail?: string }> {
  if (params.explicitPrice && params.explicitPrice > 0n) {
    return { price1e18: params.explicitPrice, source: 'explicit' }
  }
  if (params.creatorToken && params.ethUsdPrice1e18 > 0n) {
    const resolved = await resolveCreatorOracleUsdPriceForDryRun({
      publicClient: params.publicClient,
      creatorToken: params.creatorToken,
      ethUsdPrice1e18: params.ethUsdPrice1e18,
    })
    if (resolved.ok) {
      return { price1e18: resolved.price1e18, source: 'market_floor' }
    }
    return {
      price1e18: DEFAULT_DRY_RUN_CREATOR_ORACLE_USD_PRICE,
      source: 'fallback_default',
      detail: resolved.reason,
    }
  }
  return { price1e18: DEFAULT_DRY_RUN_CREATOR_ORACLE_USD_PRICE, source: 'fallback_default' }
}

export async function ensureCreatorOracleLaunchPricingOnFork(params: {
  oracle: Address
  creatorToken?: Address
  initialCreatorUsdPrice?: bigint
  publicClient: OracleReadClient & ReadonlyPublicClient
  walletClient: SendTransactionClient
  waitForTransactionReceipt: WaitReceiptClient['waitForTransactionReceipt']
  forkRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  forkMode: ForkImpersonationMode
}): Promise<{
  seeded: boolean
  oracle: Address
  creatorPrice?: bigint
  ethPrice?: bigint
  priceSource?: 'explicit' | 'market_floor' | 'fallback_default' | 'existing'
  priceSourceDetail?: string
}> {
  const oracle = getAddress(params.oracle)

  const [creatorRead, ethRead] = await Promise.all([
    params.publicClient.readContract({
      address: oracle,
      abi: CREATOR_ORACLE_LAUNCH_ABI,
      functionName: 'getCreatorPrice',
    }),
    params.publicClient.readContract({
      address: oracle,
      abi: CREATOR_ORACLE_LAUNCH_ABI,
      functionName: 'getEthPrice',
    }),
  ])

  const creatorPrice = readSignedPrice(creatorRead)
  const ethPrice = readSignedPrice(ethRead)

  if (creatorPrice > 0n) {
    return {
      seeded: false,
      oracle,
      creatorPrice,
      ethPrice,
      priceSource: 'existing',
    }
  }

  const { price1e18, source, detail } = await resolveInitialCreatorUsdPrice({
    creatorToken: params.creatorToken,
    ethUsdPrice1e18: ethPrice,
    explicitPrice: params.initialCreatorUsdPrice,
    publicClient: params.publicClient,
  })

  const ownerRaw = await params.publicClient.readContract({
    address: oracle,
    abi: CREATOR_ORACLE_LAUNCH_ABI,
    functionName: 'owner',
  })
  const owner = getAddress(String(ownerRaw) as Address)

  await impersonateOnFork({
    request: params.forkRequest,
    forkMode: params.forkMode,
    account: owner,
  })

  const data = encodeFunctionData({
    abi: CREATOR_ORACLE_LAUNCH_ABI,
    functionName: 'initializeCreatorPrice',
    args: [price1e18],
  })

  const hash = await params.walletClient.sendTransaction({
    account: owner,
    to: oracle,
    data,
    value: 0n,
  })
  const receipt = await params.waitForTransactionReceipt({ hash })
  if (String(receipt?.status ?? '').toLowerCase() === 'reverted') {
    throw new Error(`initializeCreatorPrice reverted for oracle ${oracle}`)
  }

  const refreshedCreator = readSignedPrice(
    await params.publicClient.readContract({
      address: oracle,
      abi: CREATOR_ORACLE_LAUNCH_ABI,
      functionName: 'getCreatorPrice',
    }),
  )
  if (refreshedCreator <= 0n) {
    throw new Error(`creator oracle price still unset after initializeCreatorPrice (${oracle})`)
  }

  return {
    seeded: true,
    oracle,
    creatorPrice: refreshedCreator,
    ethPrice,
    priceSource: source,
    priceSourceDetail: detail,
  }
}
