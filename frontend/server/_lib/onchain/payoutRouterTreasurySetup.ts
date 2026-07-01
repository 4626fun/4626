import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'
import {
  resolvePayoutRouterExternalSwapApprovals,
  resolvePayoutRouterKeeperAddress,
} from './payoutRouterRuntime.js'
import { resolvePayoutRouterSwapPaths } from './payoutRouterSwapPaths.js'
import {
  executeBatchViaProtocolTreasurySafe,
  resolveProtocolTreasuryAddress,
} from '../wallet/protocolTreasurySafe.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

const OWNABLE_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const WRAPPER_ADMIN_ABI = [
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const SHARE_OFT_ADMIN_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'addressType',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'setAddressType',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'opType', type: 'uint8' },
    ],
    outputs: [],
  },
] as const

const SHARE_OFT_OPERATION_NO_FEES = 2

const PAYOUT_ROUTER_ADMIN_ABI = [
  {
    type: 'function',
    name: 'keeper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'shareOFT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'wrapper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'swapPathToShareOFT',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setKeeper',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'keeper', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSwapPath',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'path', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapTargetApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapSpenderApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const

export type PayoutRouterTreasurySetupCall = {
  to: Address
  data: Hex
  label: string
}

export type PayoutRouterTreasurySetupPlan = {
  payoutRouter: Address
  creatorToken: Address
  owner: Address | null
  ownerMatchesTreasury: boolean
  desiredKeeper: Address | null
  currentKeeper: Address
  swapPaths: Array<{ tokenIn: Address; path: Hex; label: 'WETH' | 'ZORA' | 'USDC'; currentPath: Hex }>
  externalTargets: Address[]
  externalSpenders: Address[]
  calls: PayoutRouterTreasurySetupCall[]
  skipReason?: string
}

type ReaderClient = {
  readContract: (args: any) => Promise<any>
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value)
}

async function readOwner(publicClient: ReaderClient, router: Address): Promise<Address | null> {
  try {
    const raw = await publicClient.readContract({
      address: router,
      abi: OWNABLE_ABI,
      functionName: 'owner',
    })
    return normalizeAddress(raw)
  } catch {
    return null
  }
}

async function readKeeper(publicClient: ReaderClient, router: Address): Promise<Address> {
  try {
    const raw = await publicClient.readContract({
      address: router,
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: 'keeper',
    })
    return normalizeAddress(raw) ?? ZERO_ADDRESS
  } catch {
    return ZERO_ADDRESS
  }
}

async function readSwapPath(publicClient: ReaderClient, router: Address, tokenIn: Address): Promise<Hex> {
  try {
    const raw = await publicClient.readContract({
      address: router,
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: 'swapPathToShareOFT',
      args: [tokenIn],
    })
    return typeof raw === 'string' && raw.startsWith('0x') ? (raw as Hex) : ('0x' as Hex)
  } catch {
    return '0x' as Hex
  }
}

async function readExternalApproval(
  publicClient: ReaderClient,
  router: Address,
  kind: 'target' | 'spender',
  address: Address,
): Promise<boolean> {
  try {
    const raw = await publicClient.readContract({
      address: router,
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: kind === 'target' ? 'approvedExternalSwapTargets' : 'approvedExternalSwapSpenders',
      args: [address],
    })
    return raw === true
  } catch {
    return false
  }
}

export async function buildPayoutRouterTreasurySetupPlan(params: {
  publicClient: ReaderClient
  payoutRouter: Address
  creatorToken: Address
}): Promise<PayoutRouterTreasurySetupPlan> {
  const payoutRouter = getAddress(params.payoutRouter)
  const creatorToken = getAddress(params.creatorToken)
  const shareOft = getAddress(
    (await params.publicClient.readContract({
      address: payoutRouter,
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: 'shareOFT',
    })) as string,
  )
  const wrapper = getAddress(
    (await params.publicClient.readContract({
      address: payoutRouter,
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: 'wrapper',
    })) as string,
  )
  const protocolTreasury = resolveProtocolTreasuryAddress()
  const owner = await readOwner(params.publicClient, payoutRouter)
  const ownerMatchesTreasury =
    !!owner && owner.toLowerCase() === protocolTreasury.toLowerCase()

  const desiredKeeper = resolvePayoutRouterKeeperAddress()
  const currentKeeper = await readKeeper(params.publicClient, payoutRouter)
  const external = resolvePayoutRouterExternalSwapApprovals()
  const desiredPaths = ownerMatchesTreasury
    ? await resolvePayoutRouterSwapPaths({ publicClient: params.publicClient, shareOft })
    : []

  const swapPaths: PayoutRouterTreasurySetupPlan['swapPaths'] = []
  for (const entry of desiredPaths) {
    const currentPath = await readSwapPath(params.publicClient, payoutRouter, entry.tokenIn)
    swapPaths.push({ ...entry, currentPath })
  }

  const calls: PayoutRouterTreasurySetupCall[] = []

  if (!ownerMatchesTreasury) {
    return {
      payoutRouter,
      creatorToken,
      owner,
      ownerMatchesTreasury,
      desiredKeeper,
      currentKeeper,
      swapPaths,
      externalTargets: external.targets,
      externalSpenders: external.spenders,
      calls,
      skipReason: 'owner_not_protocol_treasury',
    }
  }

  if (desiredKeeper && currentKeeper.toLowerCase() !== desiredKeeper.toLowerCase()) {
    calls.push({
      to: payoutRouter,
      label: 'setKeeper',
      data: encodeFunctionData({
        abi: PAYOUT_ROUTER_ADMIN_ABI,
        functionName: 'setKeeper',
        args: [desiredKeeper],
      }),
    })
  }

  for (const { tokenIn, path, label, currentPath } of swapPaths) {
    if (String(currentPath).toLowerCase() === String(path).toLowerCase()) continue
    calls.push({
      to: payoutRouter,
      label: `setSwapPath:${label}`,
      data: encodeFunctionData({
        abi: PAYOUT_ROUTER_ADMIN_ABI,
        functionName: 'setSwapPath',
        args: [tokenIn, path],
      }),
    })
  }

  for (const target of external.targets) {
    const approved = await readExternalApproval(params.publicClient, payoutRouter, 'target', target)
    if (approved) continue
    calls.push({
      to: payoutRouter,
      label: `setExternalSwapTargetApproval:${target}`,
      data: encodeFunctionData({
        abi: PAYOUT_ROUTER_ADMIN_ABI,
        functionName: 'setExternalSwapTargetApproval',
        args: [target, true],
      }),
    })
  }

  for (const spender of external.spenders) {
    const approved = await readExternalApproval(params.publicClient, payoutRouter, 'spender', spender)
    if (approved) continue
    calls.push({
      to: payoutRouter,
      label: `setExternalSwapSpenderApproval:${spender}`,
      data: encodeFunctionData({
        abi: PAYOUT_ROUTER_ADMIN_ABI,
        functionName: 'setExternalSwapSpenderApproval',
        args: [spender, true],
      }),
    })
  }

  try {
    const whitelisted = await params.publicClient.readContract({
      address: wrapper,
      abi: WRAPPER_ADMIN_ABI,
      functionName: 'isWhitelisted',
      args: [payoutRouter],
    })
    if (whitelisted !== true) {
      calls.push({
        to: wrapper,
        label: 'setWhitelist:payoutRouter',
        data: encodeFunctionData({
          abi: WRAPPER_ADMIN_ABI,
          functionName: 'setWhitelist',
          args: [payoutRouter, true],
        }),
      })
    }
  } catch {
    // Wrapper may not be configured yet during early deploy windows.
  }

  try {
    const shareOftOwner = await readOwner(params.publicClient, shareOft)
    if (shareOftOwner && shareOftOwner.toLowerCase() === protocolTreasury.toLowerCase()) {
      const opType = await params.publicClient.readContract({
        address: shareOft,
        abi: SHARE_OFT_ADMIN_ABI,
        functionName: 'addressType',
        args: [payoutRouter],
      })
      if (Number(opType) !== SHARE_OFT_OPERATION_NO_FEES) {
        calls.push({
          to: shareOft,
          label: 'setAddressType:payoutRouterNoFees',
          data: encodeFunctionData({
            abi: SHARE_OFT_ADMIN_ABI,
            functionName: 'setAddressType',
            args: [payoutRouter, SHARE_OFT_OPERATION_NO_FEES],
          }),
        })
      }
    }
  } catch {
    // ShareOFT may not be configured yet during early deploy windows.
  }

  return {
    payoutRouter,
    creatorToken,
    owner,
    ownerMatchesTreasury,
    desiredKeeper,
    currentKeeper,
    swapPaths,
    externalTargets: external.targets,
    externalSpenders: external.spenders,
    calls,
  }
}

export async function executePayoutRouterTreasurySetup(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: Hex; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  payoutRouter: Address
  creatorToken: Address
  env?: Record<string, string | undefined>
}): Promise<{
  plan: PayoutRouterTreasurySetupPlan
  executed: boolean
  txHash?: Hex
  safeAddress?: Address
  signerAddress?: Address
}> {
  const plan = await buildPayoutRouterTreasurySetupPlan({
    publicClient: params.publicClient,
    payoutRouter: params.payoutRouter,
    creatorToken: params.creatorToken,
  })

  if (plan.skipReason) {
    return { plan, executed: false }
  }
  if (plan.calls.length === 0) {
    return { plan, executed: false }
  }

  const result = await executeBatchViaProtocolTreasurySafe({
    publicClient: params.publicClient,
    rpcUrl: params.rpcUrl,
    calls: plan.calls.map((call) => ({ to: call.to, data: call.data, value: 0n })),
    env: params.env,
  })

  return {
    plan,
    executed: true,
    txHash: result.txHash,
    safeAddress: result.safeAddress,
    signerAddress: result.signerAddress,
  }
}

export function payoutRouterTreasuryAutoSetupEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = String(env.PAYOUT_ROUTER_TREASURY_AUTO_SETUP ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

declare const process: { env: Record<string, string | undefined> }

export async function maybeAutoSetupPayoutRouterTreasury(params: {
  publicClient: {
    readContract: (args: unknown) => Promise<unknown>
    waitForTransactionReceipt: (args: { hash: Hex; timeout?: number }) => Promise<{ status: string }>
  }
  rpcUrl: string
  payoutRouter: Address
  creatorToken: Address
  env?: Record<string, string | undefined>
}): Promise<void> {
  const env = params.env ?? process.env
  if (!payoutRouterTreasuryAutoSetupEnabled(env)) return
  try {
    const result = await executePayoutRouterTreasurySetup({
      publicClient: params.publicClient,
      rpcUrl: params.rpcUrl,
      payoutRouter: params.payoutRouter,
      creatorToken: params.creatorToken,
      env,
    })
    console.info('payout_router.treasury_auto_setup', {
      payoutRouter: params.payoutRouter,
      creatorToken: params.creatorToken,
      executed: result.executed,
      txHash: result.txHash ?? null,
      callCount: result.plan.calls.length,
      skipReason: result.plan.skipReason ?? null,
    })
  } catch (error) {
    console.warn('payout_router.treasury_auto_setup_failed', {
      payoutRouter: params.payoutRouter,
      creatorToken: params.creatorToken,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
