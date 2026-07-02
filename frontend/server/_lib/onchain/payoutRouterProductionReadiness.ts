import { getAddress, isAddress, type Address, type Hex } from 'viem'

const OWNABLE_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const SAFE_ABI = [
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const TIMELOCK_ABI = [
  {
    type: 'function',
    name: 'getMinDelay',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export type PayoutRouterProductionReadinessViolation = {
  code: string
  message: string
  severity: 'critical' | 'warning'
  expected?: string | number | boolean | null
  actual?: string | number | boolean | null
}

type ReaderClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  getBytecode: (args: { address: Address }) => Promise<Hex | undefined>
}

export type VerifyPayoutRouterProductionReadinessParams = {
  publicClient: ReaderClient
  payoutRouter: Address
  /** Optional allowlist of known-safe owner addresses (multisig / timelock). */
  approvedOwners?: Address[]
}

export type VerifyPayoutRouterProductionReadinessResult = {
  checked: boolean
  checksRun: number
  owner: Address | null
  violations: PayoutRouterProductionReadinessViolation[]
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value as Address)
}

async function isContract(publicClient: ReaderClient, address: Address): Promise<boolean> {
  const bytecode = await publicClient.getBytecode({ address })
  return Boolean(bytecode && bytecode !== '0x')
}

async function looksLikeMultisig(publicClient: ReaderClient, address: Address): Promise<boolean> {
  try {
    const threshold = await publicClient.readContract({
      address,
      abi: SAFE_ABI,
      functionName: 'getThreshold',
    })
    return typeof threshold === 'bigint' && threshold >= 2n
  } catch {
    return false
  }
}

async function looksLikeTimelock(publicClient: ReaderClient, address: Address): Promise<boolean> {
  try {
    const minDelay = await publicClient.readContract({
      address,
      abi: TIMELOCK_ABI,
      functionName: 'getMinDelay',
    })
    return typeof minDelay === 'bigint' && minDelay > 0n
  } catch {
    return false
  }
}

/**
 * H-07 ops gate — PayoutRouter owner must not be a hot EOA before production traffic.
 */
export async function verifyPayoutRouterProductionReadiness(
  params: VerifyPayoutRouterProductionReadinessParams,
): Promise<VerifyPayoutRouterProductionReadinessResult> {
  const violations: PayoutRouterProductionReadinessViolation[] = []
  let checksRun = 0

  let owner: Address | null = null
  try {
    owner = normalizeAddress(
      await params.publicClient.readContract({
        address: params.payoutRouter,
        abi: OWNABLE_ABI,
        functionName: 'owner',
      }),
    )
    checksRun++
  } catch (error) {
    violations.push({
      code: 'payout_router_owner_read_failed',
      message: `Failed to read PayoutRouter owner: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'critical',
    })
    return { checked: true, checksRun, owner, violations }
  }

  if (!owner) {
    violations.push({
      code: 'payout_router_owner_invalid',
      message: 'PayoutRouter owner is not a valid address',
      severity: 'critical',
    })
    return { checked: true, checksRun, owner, violations }
  }

  const approved = (params.approvedOwners ?? []).map((a) => getAddress(a))
  if (approved.includes(owner)) {
    return { checked: true, checksRun, owner, violations }
  }

  checksRun++
  const ownerIsContract = await isContract(params.publicClient, owner)
  if (!ownerIsContract) {
    violations.push({
      code: 'payout_router_owner_is_eoa',
      message:
        'PayoutRouter owner is an EOA; transfer ownership to a multisig or timelock before production (H-07)',
      severity: 'critical',
      expected: 'contract',
      actual: owner,
    })
    return { checked: true, checksRun, owner, violations }
  }

  checksRun++
  const multisig = await looksLikeMultisig(params.publicClient, owner)
  checksRun++
  const timelock = await looksLikeTimelock(params.publicClient, owner)

  if (!multisig && !timelock) {
    violations.push({
      code: 'payout_router_owner_unverified_guard',
      message:
        'PayoutRouter owner is a contract but does not look like a Gnosis Safe (threshold >= 2) or TimelockController; verify manually or add to approvedOwners (H-07)',
      severity: 'warning',
      actual: owner,
    })
  }

  return { checked: true, checksRun, owner, violations }
}
