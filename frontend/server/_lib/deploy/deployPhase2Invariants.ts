import { decodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'

import { verifyLotteryProductionReadiness } from '../lottery/lotteryProductionReadiness.js'
import { getApiContracts } from '../onchain/contracts.js'
import { verifyPayoutRouterHarvestReadiness } from '../onchain/payoutRouterHarvestReadiness.js'
import { verifyPayoutRouterProductionReadiness } from '../onchain/payoutRouterProductionReadiness.js'

const ZERO_ADDRESS = `0x${'00'.repeat(20)}` as Address

const DEPLOYMENT_BATCHER_FINALIZE_PHASE2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaLaunchArm', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const DEPLOYMENT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaLaunchArm', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
] as const

const CCA_STRATEGY_FEE_RECIPIENT_VIEW_ABI = [
  {
    type: 'function',
    name: 'feeRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const SHARE_OFT_GAUGE_VIEW_ABI = [
  {
    type: 'function',
    name: 'gaugeController',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const CREATOR_COIN_PAYOUT_RECIPIENT_VIEW_ABI = [
  {
    type: 'function',
    name: 'payoutRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const GAUGE_CREATOR_SPLIT_VIEW_ABI = [
  {
    type: 'function',
    name: 'creatorShareBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'creatorTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const GAUGE_AGENT_SPLIT_VIEW_ABI = [
  {
    type: 'function',
    name: 'treasuryShareBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'agentTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type DeployPhase2InvariantViolation = {
  code: string
  message: string
  expected?: string | number | null
  actual?: string | number | null
}

type FinalizePhase2Info = {
  creatorToken: Address
  shareToken: Address
  gaugeController: Address
  ccaLaunchArm: Address
}

type MinimalPublicClient = {
  readContract(params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
  getBytecode?(params: { address: Address }): Promise<Hex | undefined>
  getStorageAt?(params: { address: Address; slot: Hex }): Promise<Hex | undefined>
}

type VerifyPhase2InvariantsParams = {
  publicClient: MinimalPublicClient
  phase2FinalizeCalls: Array<{ to: Address; value: bigint; data: Hex }>
  payload: Record<string, any>
  defaultPayoutRecipientMode?: 'gauge' | 'payout_router'
  defaultPayoutRecipient?: Address | null
  /**
   * M2-03 — run H-07 / M-15 production-readiness gates (default true).
   * Critical violations become phase-2 invariant failures.
   */
  enforceProductionReadiness?: boolean
  lotteryManager?: Address | null
  approvedPayoutRouterOwners?: Address[]
  requiredHubShareOfts?: Address[]
}

export type VerifyPhase2InvariantsResult = {
  checked: boolean
  checksRun: number
  violations: DeployPhase2InvariantViolation[]
  expectations: {
    creatorToken: Address
    shareToken: Address
    gaugeController: Address
    ccaLaunchArm: Address
    expectedTradeFeeCollector: Address
    expectedPayoutRecipient: Address | null
    payoutRecipientMode: 'gauge' | 'payout_router'
  } | null
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const normalized = getAddress(value as Address)
  return normalized.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? null : normalized
}

function resolveMode(input: unknown, fallback: 'gauge' | 'payout_router'): 'gauge' | 'payout_router' {
  return input === 'payout_router' ? 'payout_router' : fallback
}

function extractFinalizePhase2Info(calls: Array<{ to: Address; value: bigint; data: Hex }>): FinalizePhase2Info | null {
  const finalizeCall = calls[0]
  if (!finalizeCall || typeof finalizeCall.data !== 'string') return null

  for (const abi of [DEPLOYMENT_BATCHER_FINALIZE_PHASE2_ABI, DEPLOYMENT_BATCHER_FINALIZE_PHASE2_LEGACY_ABI]) {
    try {
      const decoded = decodeFunctionData({ abi, data: finalizeCall.data })
      const params = (decoded.args?.[0] ?? null) as {
        creatorToken?: string
        shareToken?: string
        shareOFT?: string
        gaugeController?: string
        ccaLaunchArm?: string
      } | null
      const creatorToken = normalizeAddress(params?.creatorToken)
      const shareToken = normalizeAddress(params?.shareToken ?? params?.shareOFT)
      const gaugeController = normalizeAddress(params?.gaugeController)
      const ccaLaunchArm = normalizeAddress(params?.ccaLaunchArm)
      if (!creatorToken || !shareToken || !gaugeController || !ccaLaunchArm) continue
      return { creatorToken, shareToken, gaugeController, ccaLaunchArm }
    } catch {
      continue
    }
  }
  return null
}

export async function verifyDeployPhase2Invariants(
  params: VerifyPhase2InvariantsParams,
): Promise<VerifyPhase2InvariantsResult> {
  const payload = params.payload ?? {}
  const violations: DeployPhase2InvariantViolation[] = []
  let checksRun = 0

  const info = extractFinalizePhase2Info(params.phase2FinalizeCalls)
  if (!info) {
    return {
      checked: false,
      checksRun,
      violations: [
        {
          code: 'phase2_finalize_decode_failed',
          message: 'Could not decode finalizePhase2 invariant context from call data',
        },
      ],
      expectations: null,
    }
  }

  const expectedTradeFeeCollector =
    normalizeAddress(payload?.expectedTradeFeeCollector) ?? info.gaugeController

  const mode = resolveMode(
    payload?.expectedPayoutRecipientMode,
    params.defaultPayoutRecipientMode === 'payout_router' ? 'payout_router' : 'gauge',
  )

  const expectedPayoutRecipient =
    normalizeAddress(payload?.expectedPayoutRecipient) ??
    params.defaultPayoutRecipient ??
    (mode === 'gauge' ? info.gaugeController : null)

  const recordViolation = (
    code: string,
    message: string,
    expected?: string | number | null,
    actual?: string | number | null,
  ) => {
    violations.push({
      code,
      message,
      ...(expected !== undefined ? { expected } : {}),
      ...(actual !== undefined ? { actual } : {}),
    })
  }

  const strategyFeeRecipient = normalizeAddress(
    await params.publicClient.readContract({
      address: info.ccaLaunchArm,
      abi: CCA_STRATEGY_FEE_RECIPIENT_VIEW_ABI,
      functionName: 'feeRecipient',
    }),
  )
  checksRun++
  if (!strategyFeeRecipient || strategyFeeRecipient.toLowerCase() !== expectedTradeFeeCollector.toLowerCase()) {
    recordViolation(
      'strategy_fee_recipient_mismatch',
      'CCALaunchArm feeRecipient does not match expected tradeFeeCollector',
      expectedTradeFeeCollector,
      strategyFeeRecipient,
    )
  }

  const shareGauge = normalizeAddress(
    await params.publicClient.readContract({
      address: info.shareToken,
      abi: SHARE_OFT_GAUGE_VIEW_ABI,
      functionName: 'gaugeController',
    }),
  )
  checksRun++
  if (!shareGauge || shareGauge.toLowerCase() !== expectedTradeFeeCollector.toLowerCase()) {
    recordViolation(
      'share_trade_fee_collector_mismatch',
      'ShareOFT gaugeController does not match expected tradeFeeCollector',
      expectedTradeFeeCollector,
      shareGauge,
    )
  }

  // Ops canaries may use plain ERC20 assets that do not implement CreatorCoin.payoutRecipient.
  // Treat a revert / missing selector as "not a CreatorCoin" and skip this lane check rather
  // than hard-failing the whole gate before post-phase2 stages can run.
  const creatorCoinPayoutRecipientRaw = await params.publicClient
    .readContract({
      address: info.creatorToken,
      abi: CREATOR_COIN_PAYOUT_RECIPIENT_VIEW_ABI,
      functionName: 'payoutRecipient',
    })
    .catch(() => null)
  const creatorCoinSupportsPayoutRecipient = creatorCoinPayoutRecipientRaw !== null
  const creatorCoinPayoutRecipient = normalizeAddress(creatorCoinPayoutRecipientRaw)
  if (creatorCoinSupportsPayoutRecipient) {
    checksRun++
    if (!expectedPayoutRecipient) {
      recordViolation(
        'creator_coin_payout_recipient_unresolved',
        `Cannot resolve expected creatorCoinPayoutRecipient (external earnings lane) for mode=${mode}`,
        null,
        creatorCoinPayoutRecipient,
      )
    } else if (
      !creatorCoinPayoutRecipient ||
      creatorCoinPayoutRecipient.toLowerCase() !== expectedPayoutRecipient.toLowerCase()
    ) {
      recordViolation(
        'creator_coin_payout_recipient_mismatch',
        'Creator coin creatorCoinPayoutRecipient (external earnings lane) does not match expected recipient',
        expectedPayoutRecipient,
        creatorCoinPayoutRecipient,
      )
    }
  }

  // Creator gauges expose creatorShareBps/creatorTreasury; Agent gauges expose
  // treasuryShareBps/agentTreasury. Missing selectors must not hard-fail the gate.
  const [creatorShareBpsRaw, creatorTreasuryRaw] = await Promise.all([
    params.publicClient
      .readContract({
        address: info.gaugeController,
        abi: GAUGE_CREATOR_SPLIT_VIEW_ABI,
        functionName: 'creatorShareBps',
      })
      .catch(() => null),
    params.publicClient
      .readContract({
        address: info.gaugeController,
        abi: GAUGE_CREATOR_SPLIT_VIEW_ABI,
        functionName: 'creatorTreasury',
      })
      .catch(() => null),
  ])
  const creatorGaugeSplitSupported = creatorShareBpsRaw !== null || creatorTreasuryRaw !== null
  if (creatorGaugeSplitSupported) {
    checksRun += 2
    const creatorShareBps = Number((creatorShareBpsRaw as bigint | null) ?? 0n)
    const creatorTreasury = normalizeAddress(creatorTreasuryRaw)
    if (creatorShareBps > 0 && !creatorTreasury) {
      recordViolation(
        'creator_treasury_missing',
        'Gauge creatorShareBps is non-zero but creatorTreasury is unset',
        'non-zero treasury address',
        creatorTreasury,
      )
    }
  } else {
    const [treasuryShareBpsRaw, agentTreasuryRaw] = await Promise.all([
      params.publicClient
        .readContract({
          address: info.gaugeController,
          abi: GAUGE_AGENT_SPLIT_VIEW_ABI,
          functionName: 'treasuryShareBps',
        })
        .catch(() => null),
      params.publicClient
        .readContract({
          address: info.gaugeController,
          abi: GAUGE_AGENT_SPLIT_VIEW_ABI,
          functionName: 'agentTreasury',
        })
        .catch(() => null),
    ])
    const agentGaugeSplitSupported = treasuryShareBpsRaw !== null || agentTreasuryRaw !== null
    if (agentGaugeSplitSupported) {
      checksRun += 2
      const treasuryShareBps = Number((treasuryShareBpsRaw as bigint | null) ?? 0n)
      const agentTreasury = normalizeAddress(agentTreasuryRaw)
      if (treasuryShareBps > 0 && !agentTreasury) {
        recordViolation(
          'agent_treasury_missing',
          'Gauge treasuryShareBps is non-zero but agentTreasury is unset',
          'non-zero treasury address',
          agentTreasury,
        )
      }
    }
  }

  if (mode === 'payout_router' && expectedPayoutRecipient) {
    const { resolvePayoutRouterSwapPathTokens } = await import('../onchain/payoutRouterHarvestTokens.js')
    const swapPathTokens = await resolvePayoutRouterSwapPathTokens({
      publicClient: params.publicClient,
      shareOft: info.shareToken,
    })
    const readiness = await verifyPayoutRouterHarvestReadiness({
      publicClient: params.publicClient as Parameters<typeof verifyPayoutRouterHarvestReadiness>[0]['publicClient'],
      payoutRouter: expectedPayoutRecipient,
      burnStream: normalizeAddress(payload?.expectedBurnStream),
      swapPathTokens,
    })
    checksRun += readiness.checksRun
    for (const issue of readiness.violations) {
      recordViolation(
        issue.code,
        issue.message,
        issue.severity === 'critical' ? 'required' : 'recommended',
        issue.severity,
      )
    }
  }

  // M2-03: production-readiness (H-07 owner guard, M-15 boost timelock / H-06 hub).
  // Critical only — warnings (e.g. unverified contract owner) stay non-blocking.
  const enforceProductionReadiness = params.enforceProductionReadiness !== false
  if (enforceProductionReadiness) {
    if (mode === 'payout_router' && expectedPayoutRecipient && typeof params.publicClient.getBytecode === 'function') {
      let approvedOwners = params.approvedPayoutRouterOwners
      if (!approvedOwners || approvedOwners.length === 0) {
        try {
          const treasury = normalizeAddress(getApiContracts().protocolTreasury)
          approvedOwners = treasury ? [treasury] : []
        } catch {
          approvedOwners = []
        }
      }
      const prod = await verifyPayoutRouterProductionReadiness({
        publicClient: params.publicClient as Parameters<
          typeof verifyPayoutRouterProductionReadiness
        >[0]['publicClient'],
        payoutRouter: expectedPayoutRecipient,
        approvedOwners,
      })
      checksRun += prod.checksRun
      for (const issue of prod.violations) {
        if (issue.severity !== 'critical') continue
        recordViolation(issue.code, issue.message, issue.expected as string | number | null | undefined, issue.actual as string | number | null | undefined)
      }
    }

    const lotteryManager =
      normalizeAddress(params.lotteryManager) ??
      normalizeAddress(payload?.lotteryManager) ??
      (() => {
        try {
          return normalizeAddress(getApiContracts().lotteryManager)
        } catch {
          return null
        }
      })()

    if (lotteryManager && typeof params.publicClient.getStorageAt === 'function') {
      const hubOfts = (params.requiredHubShareOfts ??
        (Array.isArray(payload?.requiredHubShareOfts) ? payload.requiredHubShareOfts : [])
      )
        .map((a) => normalizeAddress(a))
        .filter((a): a is Address => Boolean(a))

      const lottery = await verifyLotteryProductionReadiness({
        publicClient: params.publicClient as Parameters<
          typeof verifyLotteryProductionReadiness
        >[0]['publicClient'],
        lotteryManager,
        requiredHubShareOfts: hubOfts,
        // Main-launch Phase 2 keeps the one-way source timelock unarmed only while
        // both boost sources stay zero. verifyLotteryProductionReadiness enforces
        // that zero-source gate when requireBoostTimelockArmed is false.
        // Boost-enabled readiness (timelock armed) is checked in the Phase-3 window.
        requireBoostTimelockArmed: false,
      })
      checksRun += lottery.checksRun
      for (const issue of lottery.violations) {
        if (issue.severity !== 'critical') continue
        recordViolation(issue.code, issue.message, issue.expected as string | number | null | undefined, issue.actual as string | number | null | undefined)
      }
    }
  }

  return {
    checked: true,
    checksRun,
    violations,
    expectations: {
      creatorToken: info.creatorToken,
      shareToken: info.shareToken,
      gaugeController: info.gaugeController,
      ccaLaunchArm: info.ccaLaunchArm,
      expectedTradeFeeCollector,
      expectedPayoutRecipient,
      payoutRecipientMode: mode,
    },
  }
}
