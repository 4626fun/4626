import { getAddress, isAddress, type Address, type Hex } from 'viem'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address
const SHARE_OFT_OPERATION_NO_FEES = 2

const WRAPPER_ABI = [
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const SHARE_OFT_ABI = [
  {
    type: 'function',
    name: 'addressType',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
] as const

const PAYOUT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'wrapper',
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
    name: 'keeper',
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
] as const

const BURN_STREAM_ABI = [
  {
    type: 'function',
    name: 'authorizedQueuers',
    stateMutability: 'view',
    inputs: [{ name: 'queuer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

export type PayoutRouterHarvestReadinessViolation = {
  code: string
  message: string
  severity: 'critical' | 'warning'
}

type ReaderClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const normalized = getAddress(value as Address)
  return normalized.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : normalized
}

function isConfiguredSwapPath(path: unknown): boolean {
  return typeof path === 'string' && path !== '0x' && path.length > 2
}

export async function verifyPayoutRouterHarvestReadiness(params: {
  publicClient: ReaderClient
  payoutRouter: Address
  burnStream?: Address | null
  swapPathTokens?: Array<{ token: Address; label: string }>
  requireKeeper?: boolean
}): Promise<{ violations: PayoutRouterHarvestReadinessViolation[]; checksRun: number }> {
  const violations: PayoutRouterHarvestReadinessViolation[] = []
  let checksRun = 0
  const payoutRouter = getAddress(params.payoutRouter)

  const wrapper = normalizeAddress(
    await params.publicClient.readContract({
      address: payoutRouter,
      abi: PAYOUT_ROUTER_ABI,
      functionName: 'wrapper',
    }),
  )
  checksRun += 1
  if (!wrapper) {
    violations.push({
      code: 'payout_router_wrapper_unset',
      message: 'PayoutRouter.wrapper is unset',
      severity: 'critical',
    })
  } else {
    const whitelisted = await params.publicClient.readContract({
      address: wrapper,
      abi: WRAPPER_ABI,
      functionName: 'isWhitelisted',
      args: [payoutRouter],
    })
    checksRun += 1
    if (whitelisted !== true) {
      violations.push({
        code: 'payout_router_wrapper_not_whitelisted',
        message: 'PayoutRouter is not whitelisted on CreatorOVaultWrapper',
        severity: 'critical',
      })
    }
  }

  const shareOft = normalizeAddress(
    await params.publicClient.readContract({
      address: payoutRouter,
      abi: PAYOUT_ROUTER_ABI,
      functionName: 'shareOFT',
    }),
  )
  checksRun += 1
  if (shareOft) {
    const opType = Number(
      await params.publicClient.readContract({
        address: shareOft,
        abi: SHARE_OFT_ABI,
        functionName: 'addressType',
        args: [payoutRouter],
      }),
    )
    checksRun += 1
    if (opType !== SHARE_OFT_OPERATION_NO_FEES) {
      violations.push({
        code: 'payout_router_share_oft_not_no_fees',
        message: 'PayoutRouter is not ShareOFT NoFees; external earnings swaps lose buy-side fee to gauge',
        severity: 'warning',
      })
    }
  }

  if (params.requireKeeper !== false) {
    const keeper = normalizeAddress(
      await params.publicClient.readContract({
        address: payoutRouter,
        abi: PAYOUT_ROUTER_ABI,
        functionName: 'keeper',
      }),
    )
    checksRun += 1
    if (!keeper) {
      violations.push({
        code: 'payout_router_keeper_unset',
        message: 'PayoutRouter keeper is unset; harvest automation cannot run',
        severity: 'warning',
      })
    }
  }

  if (params.burnStream) {
    const queuerAuthorized = await params.publicClient.readContract({
      address: getAddress(params.burnStream),
      abi: BURN_STREAM_ABI,
      functionName: 'authorizedQueuers',
      args: [payoutRouter],
    })
    checksRun += 1
    if (queuerAuthorized !== true) {
      violations.push({
        code: 'payout_router_queuer_unauthorized',
        message: 'PayoutRouter is not authorized to queue shares on VaultShareBurnStream',
        severity: 'critical',
      })
    }
  }

  for (const entry of params.swapPathTokens ?? []) {
    const path = (await params.publicClient.readContract({
      address: payoutRouter,
      abi: PAYOUT_ROUTER_ABI,
      functionName: 'swapPathToShareOFT',
      args: [getAddress(entry.token)],
    })) as Hex
    checksRun += 1
    if (!isConfiguredSwapPath(path)) {
      violations.push({
        code: 'payout_router_swap_path_missing',
        message: `PayoutRouter has no V3 swap path configured for ${entry.label}`,
        severity: 'warning',
      })
    }
  }

  return { violations, checksRun }
}
