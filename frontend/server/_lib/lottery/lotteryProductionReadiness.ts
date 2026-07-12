import { getAddress, isAddress, type Address, type Hex } from 'viem'

/** Verified via `forge inspect LotteryManager4626 storageLayout` (BoostSourceTimelock tests). */
export const LOTTERY_TIMELOCK_ARMED_STORAGE_SLOT = 64n

const HUB_FORWARDER_ABI = [
  {
    type: 'function',
    name: 'authorizedHubShareOftForwarders',
    stateMutability: 'view',
    inputs: [{ name: 'shareOft', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

/** Public getters for boost sources that stay mutable until the one-way timelock is armed. */
const BOOST_SOURCE_ABI = [
  {
    type: 'function',
    name: 'boostManager',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultGaugeVoting',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export type LotteryProductionReadinessViolation = {
  code: string
  message: string
  severity: 'critical' | 'warning'
  expected?: string | boolean | null
  actual?: string | boolean | null
}

type ReaderClient = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  getStorageAt: (args: { address: Address; slot: Hex }) => Promise<Hex>
}

export type VerifyLotteryProductionReadinessParams = {
  publicClient: ReaderClient
  lotteryManager: Address
  /** Hub ShareOFT addresses that must be authorized to forward remote lottery entries (H-06). */
  requiredHubShareOfts?: Address[]
  /** When true, missing boost timelock arm is critical (M-15). */
  requireBoostTimelockArmed?: boolean
}

export type VerifyLotteryProductionReadinessResult = {
  checked: boolean
  checksRun: number
  violations: LotteryProductionReadinessViolation[]
  boostTimelockArmed: boolean | null
  boostManager: Address | null
  vaultGaugeVoting: Address | null
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value as Address)
}

export async function readLotteryBoostTimelockArmed(
  publicClient: ReaderClient,
  lotteryManager: Address,
): Promise<boolean> {
  const raw = await publicClient.getStorageAt({
    address: lotteryManager,
    slot: `0x${LOTTERY_TIMELOCK_ARMED_STORAGE_SLOT.toString(16).padStart(64, '0')}` as Hex,
  })
  return BigInt(raw) !== 0n
}

export async function verifyLotteryProductionReadiness(
  params: VerifyLotteryProductionReadinessParams,
): Promise<VerifyLotteryProductionReadinessResult> {
  const violations: LotteryProductionReadinessViolation[] = []
  let checksRun = 0
  const requireArmed = params.requireBoostTimelockArmed !== false

  let boostTimelockArmed: boolean | null = null
  let boostManager: Address | null = null
  let vaultGaugeVoting: Address | null = null

  try {
    boostTimelockArmed = await readLotteryBoostTimelockArmed(params.publicClient, params.lotteryManager)
    checksRun++
    if (requireArmed && !boostTimelockArmed) {
      violations.push({
        code: 'lottery_boost_timelock_not_armed',
        message:
          'LotteryManager4626 boost-source timelock is not armed; call armBoostSourceTimelock() before production traffic (M-15)',
        severity: 'critical',
        expected: true,
        actual: false,
      })
    }
  } catch (error) {
    violations.push({
      code: 'lottery_boost_timelock_read_failed',
      message: `Failed to read boost timelock armed flag: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'critical',
    })
  }

  // Boost-off canary (requireBoostTimelockArmed=false) is only safe when both boost
  // sources are still zero. A configured source with an unarmed timelock leaves
  // setBoostManager / setVe4626GaugeVoting immediately mutable under production traffic.
  if (!requireArmed) {
    try {
      const rawBoostManager = await params.publicClient.readContract({
        address: params.lotteryManager,
        abi: BOOST_SOURCE_ABI,
        functionName: 'boostManager',
      })
      const rawGauge = await params.publicClient.readContract({
        address: params.lotteryManager,
        abi: BOOST_SOURCE_ABI,
        functionName: 'vaultGaugeVoting',
      })
      boostManager = normalizeAddress(rawBoostManager) ?? ZERO_ADDRESS
      vaultGaugeVoting = normalizeAddress(rawGauge) ?? ZERO_ADDRESS
      checksRun += 2

      if (boostManager !== ZERO_ADDRESS) {
        violations.push({
          code: 'lottery_boost_manager_set_while_timelock_unarmed',
          message:
            'boostManager is configured but boost-source timelock is unarmed; arm the timelock or clear boostManager for boost-off canary mode',
          severity: 'critical',
          expected: ZERO_ADDRESS,
          actual: boostManager,
        })
      }
      if (vaultGaugeVoting !== ZERO_ADDRESS) {
        violations.push({
          code: 'lottery_vault_gauge_set_while_timelock_unarmed',
          message:
            'vaultGaugeVoting is configured but boost-source timelock is unarmed; arm the timelock or clear vaultGaugeVoting for boost-off canary mode',
          severity: 'critical',
          expected: ZERO_ADDRESS,
          actual: vaultGaugeVoting,
        })
      }
    } catch (error) {
      violations.push({
        code: 'lottery_boost_sources_read_failed',
        message: `Failed to read boost sources while timelock arm is optional: ${
          error instanceof Error ? error.message : String(error)
        }`,
        severity: 'critical',
      })
    }
  }

  for (const shareOftRaw of params.requiredHubShareOfts ?? []) {
    const shareOft = normalizeAddress(shareOftRaw)
    if (!shareOft) {
      violations.push({
        code: 'lottery_hub_share_oft_invalid',
        message: 'requiredHubShareOfts contains an invalid address',
        severity: 'critical',
        actual: String(shareOftRaw),
      })
      continue
    }

    checksRun++
    const authorized = Boolean(
      await params.publicClient.readContract({
        address: params.lotteryManager,
        abi: HUB_FORWARDER_ABI,
        functionName: 'authorizedHubShareOftForwarders',
        args: [shareOft],
      }),
    )
    if (!authorized) {
      violations.push({
        code: 'lottery_hub_forwarder_not_authorized',
        message:
          'Hub ShareOFT is not authorized to forward remote lottery entries; call setAuthorizedHubShareOftForwarder(shareOft, true) (H-06)',
        severity: 'critical',
        expected: shareOft,
        actual: false,
      })
    }
  }

  return {
    checked: true,
    checksRun,
    violations,
    boostTimelockArmed,
    boostManager,
    vaultGaugeVoting,
  }
}
