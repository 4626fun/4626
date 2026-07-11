/**
 * POST /api/keeper/sweep
 *
 * HTTP bridge endpoint for keeper workflows. Accepts a CCA strategy address and
 * executes canonical completion phases:
 *   1) sweepCurrency()
 *   2) migrate() when migrationBlock is ready
 *   3) deployShareMeshLpManager() + seedLpManager() + seedRebalance() when share-mesh bundle is configured
 *   4) optional hook setTaxConfig() when keeper hook mode is enabled
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import { createVaultControlPlane } from '../../../server/_lib/controlPlane/vaultControlPlane.js'
import { SWEEP_COMPLETION_AUTHORITY } from '../../../server/_lib/controlPlane/executors/executeSettleVault.js'
import { verifyLotteryProductionReadiness } from '../../../server/_lib/lottery/lotteryProductionReadiness.js'
import { getApiContracts } from '../../../server/_lib/onchain/contracts.js'
import { validateKeeperVaultListing } from '../../../server/_lib/onchain/registry4626Verification.js'
import { verifyPayoutRouterHarvestReadiness } from '../../../server/_lib/onchain/payoutRouterHarvestReadiness.js'
import { verifyPayoutRouterProductionReadiness } from '../../../server/_lib/onchain/payoutRouterProductionReadiness.js'
import { resolvePayoutRouterSwapPathTokens } from '../../../server/_lib/onchain/payoutRouterHarvestTokens.js'
import {
  evaluateShareMeshInvariants,
  resolveShareMeshCompletionConfig,
  runShareMeshCompletion,
  type ShareMeshCompletionResult,
} from '../../../server/_lib/onchain/shareMeshCompletion.js'
import { createPublicClient, createWalletClient, http, type Abi, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const CCA_STRATEGY_ABI = [
  {
    type: 'function',
    name: 'getLifecycleStatus',
    inputs: [],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'phase', type: 'uint8' },
        { name: 'auction', type: 'address' },
        { name: 'isGraduated', type: 'bool' },
        { name: 'auctionWindowOpen', type: 'bool' },
        { name: 'claimOpen', type: 'bool' },
        { name: 'currencySwept', type: 'bool' },
        { name: 'unsoldSwept', type: 'bool' },
        { name: 'migrated', type: 'bool' },
        { name: 'failedFinalized', type: 'bool' },
        { name: 'startBlock', type: 'uint64' },
        { name: 'endBlock', type: 'uint64' },
        { name: 'claimBlock', type: 'uint64' },
        { name: 'migrationBlock', type: 'uint64' },
        { name: 'sweepBlock', type: 'uint64' },
        { name: 'lpReserveAmount', type: 'uint256' },
        { name: 'clearingPrice', type: 'uint256' },
        { name: 'currencyRaised', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTaxHookCalldata',
    inputs: [],
    outputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  { type: 'function', name: 'sweepCurrency', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'migrate', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sweepUnsoldTokens', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

const CREATOR_COIN_PAYOUT_RECIPIENT_ABI = [
  {
    type: 'function',
    name: 'payoutRecipient',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const SHARE_OFT_ABI = [
  {
    type: 'function',
    name: 'gaugeController',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const GAUGE_CONTROLLER_ABI = [
  {
    type: 'function',
    name: 'creatorShareBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'creatorTreasury',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const PAYOUT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'burnStream',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

type LifecycleSnapshot = {
  phase: number
  currencySwept: boolean
  migrated: boolean
  migrationBlock: bigint
}

type CompletionStage =
  | 'completed'
  | 'awaiting_migration_block'
  | 'awaiting_owner_hook_config'
  | 'invariant_failed'
  | 'in_progress'

type PayoutRecipientMode = 'gauge' | 'payout_router'

type CompletionInvariantInput = {
  creatorCoinAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  gaugeControllerAddress: `0x${string}` | null
  burnStreamAddress: `0x${string}` | null
  payoutRouterAddress: `0x${string}` | null
  payoutRecipientMode: PayoutRecipientMode
  oracleAddress: `0x${string}` | null
  vaultAddress: `0x${string}` | null
  vaultOwnerAddress: `0x${string}` | null
}

type InvariantViolation = {
  code: string
  message: string
  expected?: string | number | null
  actual?: string | number | null
}

type MarkSettledInput = {
  vaultAddress: string
}

function parseLifecycleStatus(raw: unknown): LifecycleSnapshot {
  const lifecycle = raw as any
  return {
    phase: Number(lifecycle?.phase ?? lifecycle?.[0] ?? -1),
    currencySwept: Boolean(lifecycle?.currencySwept ?? lifecycle?.[5] ?? false),
    migrated: Boolean(lifecycle?.migrated ?? lifecycle?.[7] ?? false),
    migrationBlock: BigInt(lifecycle?.migrationBlock ?? lifecycle?.[12] ?? 0n),
  }
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized as `0x${string}`
}

function parseAddressAllowlist(raw: string | undefined): Set<`0x${string}`> {
  const out = new Set<`0x${string}`>()
  const source = String(raw ?? '').trim()
  if (!source) return out
  for (const part of source.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(part)
    if (normalized) out.add(normalized)
  }
  return out
}

function parseMarkSettledInput(raw: unknown): MarkSettledInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const markSettled = raw as { vaultAddress?: unknown }
  const vaultAddress = typeof markSettled.vaultAddress === 'string' ? markSettled.vaultAddress.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(vaultAddress)) return null
  return { vaultAddress }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-sweep', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as {
    ccaLaunchArmAddress?: string
    markSettled?: {
      vaultAddress?: string
    }
    invariants?: {
      creatorCoinAddress?: string
      shareTokenAddress?: string
      gaugeControllerAddress?: string
      burnStreamAddress?: string
      payoutRouterAddress?: string
      payoutRecipientMode?: PayoutRecipientMode
      oracleAddress?: string
      vaultAddress?: string
      vaultOwnerAddress?: string
    }
  } | null
  const { ccaLaunchArmAddress, invariants } = body ?? {}
  const markSettled = parseMarkSettledInput(body?.markSettled)
  if (!ccaLaunchArmAddress || !ccaLaunchArmAddress.startsWith('0x') || ccaLaunchArmAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid ccaLaunchArmAddress' } satisfies ApiEnvelope<never>)
  }

  const invariantInput: CompletionInvariantInput = {
    creatorCoinAddress: normalizeAddress(invariants?.creatorCoinAddress),
    shareTokenAddress: normalizeAddress(invariants?.shareTokenAddress),
    gaugeControllerAddress: normalizeAddress(invariants?.gaugeControllerAddress),
    burnStreamAddress: normalizeAddress(invariants?.burnStreamAddress),
    payoutRouterAddress: normalizeAddress(invariants?.payoutRouterAddress),
    payoutRecipientMode:
      invariants?.payoutRecipientMode === 'payout_router' ? 'payout_router' : 'gauge',
    oracleAddress: normalizeAddress(invariants?.oracleAddress),
    vaultAddress: normalizeAddress(invariants?.vaultAddress),
    vaultOwnerAddress: normalizeAddress(invariants?.vaultOwnerAddress),
  }

  const shareMeshConfig = resolveShareMeshCompletionConfig()

  const keeperPk = process.env.KPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const account = privateKeyToAccount(keeperPk as `0x${string}`)
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

    const hookFlagFromEnv = process.env.KEEPER_ENABLE_HOOK_CONFIG === 'true'
    const hookStrategyAllowlist = parseAddressAllowlist(process.env.KEEPER_HOOK_CONFIG_STRATEGY_ALLOWLIST)
    const normalizedStrategyAddress = normalizeAddress(ccaLaunchArmAddress)
    const strategyAllowedForHookConfig =
      !!normalizedStrategyAddress &&
      hookStrategyAllowlist.size > 0 &&
      hookStrategyAllowlist.has(normalizedStrategyAddress)
    const shouldAttemptHookConfig = hookFlagFromEnv && strategyAllowedForHookConfig
    // Completion invariants are enforced by env only — there is intentionally
    // no per-request bypass (audit H2-05). Disabling via env is an emergency
    // override and must page operations.
    // Completion invariants are env-only (H2-05). In production, fail closed even if env is false (M2-02 parity).
    const isProdRuntime =
      String(process.env.VERCEL_ENV ?? '').trim().toLowerCase() === 'production' ||
      String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
    let enforceCompletionInvariants = process.env.KEEPER_ENFORCE_COMPLETION_INVARIANTS !== 'false'
    if (isProdRuntime && !enforceCompletionInvariants) {
      console.error(
        '[keeper/sweep] ALERT: KEEPER_ENFORCE_COMPLETION_INVARIANTS=false ignored in production (fail-closed)',
        { ccaLaunchArmAddress: normalizedStrategyAddress },
      )
      enforceCompletionInvariants = true
    } else if (!enforceCompletionInvariants) {
      console.error('[keeper/sweep] ALERT: KEEPER_ENFORCE_COMPLETION_INVARIANTS=false — completion invariants disabled via env override', {
        ccaLaunchArmAddress: normalizedStrategyAddress,
      })
    }

    let sweepTxHash: `0x${string}` | null = null
    let migrateTxHash: `0x${string}` | null = null
    let hookConfigTxHash: `0x${string}` | null = null
    let unsoldTxHash: `0x${string}` | null = null

    let sweepStatus: 'already_done' | 'success' | 'failed' = 'already_done'
    let migrateStatus: 'already_done' | 'success' | 'awaiting_block' | 'failed' = 'already_done'
    let hookConfigStatus: 'not_attempted' | 'configured' | 'owner_manual_required' | 'attempt_failed' = 'not_attempted'
    let unsoldStatus: 'skipped' | 'success' | 'reverted' | 'failed' = 'skipped'
    let completionStage: CompletionStage = 'in_progress'
    let hookConfigError: string | null = null
    let shareMeshResult: ShareMeshCompletionResult | null = null
    let invariantChecksRun = 0
    const invariantViolations: InvariantViolation[] = []

    const readLifecycle = async (): Promise<LifecycleSnapshot> =>
      parseLifecycleStatus(await publicClient.readContract({
        address: ccaLaunchArmAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'getLifecycleStatus',
      }))
    const readFeeRecipient = async (): Promise<`0x${string}`> =>
      (await publicClient.readContract({
        address: ccaLaunchArmAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'feeRecipient',
      })) as `0x${string}`

    const recordInvariantViolation = (
      code: string,
      message: string,
      expected?: string | number | null,
      actual?: string | number | null,
    ) => {
      invariantViolations.push({ code, message, ...(expected !== undefined ? { expected } : {}), ...(actual !== undefined ? { actual } : {}) })
    }

    const runCompletionInvariants = async (): Promise<void> => {
      const expectedGauge = invariantInput.gaugeControllerAddress
      if (!expectedGauge) {
        recordInvariantViolation('missing_expected_gauge', 'Missing expected gaugeControllerAddress for completion invariants')
      }

      const expectedCreatorCoin = invariantInput.creatorCoinAddress
      if (!expectedCreatorCoin) {
        recordInvariantViolation('missing_expected_creator_coin', 'Missing expected creatorCoinAddress for completion invariants')
      }

      const expectedShareToken = invariantInput.shareTokenAddress
      if (!expectedShareToken) {
        recordInvariantViolation('missing_expected_share_token', 'Missing expected shareTokenAddress for completion invariants')
      }

      if (expectedGauge) {
        const strategyFeeRecipient = (await publicClient.readContract({
          address: ccaLaunchArmAddress as `0x${string}`,
          abi: CCA_STRATEGY_ABI as unknown as Abi,
          functionName: 'feeRecipient',
        }) as `0x${string}`).toLowerCase()
        invariantChecksRun++
        if (strategyFeeRecipient !== expectedGauge) {
          recordInvariantViolation(
            'strategy_fee_recipient_mismatch',
            'CCA strategy feeRecipient does not match expected tradeFeeCollector',
            expectedGauge,
            strategyFeeRecipient,
          )
        }
      }

      if (expectedCreatorCoin && expectedGauge) {
        const creatorCoinPayoutRecipient = (await publicClient.readContract({
          address: expectedCreatorCoin,
          abi: CREATOR_COIN_PAYOUT_RECIPIENT_ABI as unknown as Abi,
          functionName: 'payoutRecipient',
        }) as `0x${string}`).toLowerCase()
        invariantChecksRun++

        const expectedRecipient = invariantInput.payoutRecipientMode === 'payout_router'
          ? invariantInput.payoutRouterAddress
          : expectedGauge
        if (!expectedRecipient) {
          recordInvariantViolation(
            'missing_expected_creator_coin_payout_recipient',
            'Cannot resolve expected creatorCoinPayoutRecipient (external earnings lane) from completion invariants',
          )
        } else if (creatorCoinPayoutRecipient !== expectedRecipient) {
          recordInvariantViolation(
            'creator_coin_payout_recipient_mismatch',
            'Creator coin creatorCoinPayoutRecipient (external earnings lane) does not match expected lane',
            expectedRecipient,
            creatorCoinPayoutRecipient,
          )
        }
      }

      if (expectedShareToken && expectedGauge) {
        const shareGauge = (await publicClient.readContract({
          address: expectedShareToken,
          abi: SHARE_OFT_ABI as unknown as Abi,
          functionName: 'gaugeController',
        }) as `0x${string}`).toLowerCase()
        invariantChecksRun++
        if (shareGauge !== expectedGauge) {
          recordInvariantViolation(
            'trade_fee_collector_mismatch',
            'ShareOFT gaugeController does not match expected tradeFeeCollector',
            expectedGauge,
            shareGauge,
          )
        }
      }

      if (expectedGauge) {
        const [creatorShareBpsRaw, creatorTreasuryRaw] = await Promise.all([
          publicClient.readContract({
            address: expectedGauge,
            abi: GAUGE_CONTROLLER_ABI as unknown as Abi,
            functionName: 'creatorShareBps',
          }),
          publicClient.readContract({
            address: expectedGauge,
            abi: GAUGE_CONTROLLER_ABI as unknown as Abi,
            functionName: 'creatorTreasury',
          }),
        ])
        const creatorShareBps = Number(creatorShareBpsRaw as bigint)
        const creatorTreasury = (creatorTreasuryRaw as `0x${string}`).toLowerCase()
        invariantChecksRun += 2
        if (creatorShareBps > 0 && creatorTreasury === zeroAddress) {
          recordInvariantViolation(
            'creator_treasury_missing',
            'Gauge creatorShareBps is non-zero but creatorTreasury is unset',
            'non-zero treasury address',
            creatorTreasury,
          )
        }
      }

      if (invariantInput.payoutRecipientMode === 'payout_router') {
        if (!invariantInput.payoutRouterAddress) {
          recordInvariantViolation(
            'missing_expected_payout_router',
            'Router mode selected but payoutRouterAddress is missing',
          )
        }
        if (!invariantInput.burnStreamAddress) {
          recordInvariantViolation(
            'missing_expected_burn_stream',
            'Router mode selected but burnStreamAddress is missing',
          )
        }
        if (invariantInput.payoutRouterAddress && invariantInput.burnStreamAddress) {
          const routerBurnStream = (await publicClient.readContract({
            address: invariantInput.payoutRouterAddress,
            abi: PAYOUT_ROUTER_ABI as unknown as Abi,
            functionName: 'burnStream',
          }) as `0x${string}`).toLowerCase()
          invariantChecksRun++
          if (routerBurnStream !== invariantInput.burnStreamAddress) {
            recordInvariantViolation(
              'router_burn_stream_mismatch',
              'PayoutRouter burnStream does not match expected burn stream',
              invariantInput.burnStreamAddress,
              routerBurnStream,
            )
          }

          if (invariantInput.shareTokenAddress) {
            const swapPathTokens = await resolvePayoutRouterSwapPathTokens({
              publicClient,
              shareOft: invariantInput.shareTokenAddress,
            })
            const readiness = await verifyPayoutRouterHarvestReadiness({
              publicClient,
              payoutRouter: invariantInput.payoutRouterAddress,
              burnStream: invariantInput.burnStreamAddress,
              swapPathTokens,
            })
            invariantChecksRun += readiness.checksRun
            for (const issue of readiness.violations) {
              if (issue.severity !== 'critical') continue
              recordInvariantViolation(issue.code, issue.message)
            }
          }

          // M2-03 / H-07: PayoutRouter owner must not be a hot EOA before settledAt.
          try {
            let approvedOwners: `0x${string}`[] = []
            try {
              const treasury = getApiContracts().protocolTreasury
              if (treasury) approvedOwners = [treasury as `0x${string}`]
            } catch {
              // ignore config read failures; production check still runs without allowlist
            }
            const prod = await verifyPayoutRouterProductionReadiness({
              publicClient,
              payoutRouter: invariantInput.payoutRouterAddress,
              approvedOwners,
            })
            invariantChecksRun += prod.checksRun
            for (const issue of prod.violations) {
              if (issue.severity !== 'critical') continue
              recordInvariantViolation(issue.code, issue.message, issue.expected as string | number | null | undefined, issue.actual as string | number | null | undefined)
            }
          } catch (err) {
            recordInvariantViolation(
              'payout_router_production_readiness_error',
              `PayoutRouter production-readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
      }

      // M2-03 / M-15 / H-06: global lottery production readiness before vault completion.
      try {
        const lotteryManager = getApiContracts().lotteryManager as `0x${string}` | undefined
        if (lotteryManager && lotteryManager !== zeroAddress) {
          const lottery = await verifyLotteryProductionReadiness({
            publicClient,
            lotteryManager,
            requireBoostTimelockArmed: true,
          })
          invariantChecksRun += lottery.checksRun
          for (const issue of lottery.violations) {
            if (issue.severity !== 'critical') continue
            recordInvariantViolation(issue.code, issue.message, issue.expected as string | number | null | undefined, issue.actual as string | number | null | undefined)
          }
        }
      } catch (err) {
        recordInvariantViolation(
          'lottery_production_readiness_error',
          `Lottery production-readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }

      if (shareMeshConfig.enabled && invariantInput.oracleAddress) {
        invariantChecksRun += await evaluateShareMeshInvariants({
          publicClient,
          input: {
            ccaLaunchArmAddress: ccaLaunchArmAddress as `0x${string}`,
            shareTokenAddress: invariantInput.shareTokenAddress,
            oracleAddress: invariantInput.oracleAddress,
          },
          recordViolation: recordInvariantViolation,
        })
      }
    }

    let lifecycle = await readLifecycle()

    if (!lifecycle.currencySwept) {
      sweepTxHash = await walletClient.writeContract({
        address: ccaLaunchArmAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'sweepCurrency',
        chain: base,
        account,
      })

      const sweepReceipt = await publicClient.waitForTransactionReceipt({ hash: sweepTxHash, timeout: 120_000 })
      if (sweepReceipt.status !== 'success') {
        sweepStatus = 'failed'
        return res.status(500).json({
          success: false,
          error: 'sweepCurrency() reverted',
          data: { sweepTxHash, sweepStatus },
        } satisfies ApiEnvelope<{ sweepTxHash: `0x${string}` | null; sweepStatus: string }>)
      }

      sweepStatus = 'success'
      lifecycle = await readLifecycle()
    }

    if (!lifecycle.migrated) {
      const currentBlock = await publicClient.getBlockNumber()
      if (currentBlock < lifecycle.migrationBlock) {
        migrateStatus = 'awaiting_block'
        completionStage = 'awaiting_migration_block'
      } else {
        // M2-01: preflight completion invariants on the pre-migration snapshot.
        // Block migrate when wiring is already wrong (fee recipient / payout recipient).
        if (enforceCompletionInvariants) {
          try {
            await runCompletionInvariants()
          } catch (err) {
            recordInvariantViolation(
              'preflight_invariant_check_error',
              'Pre-migration invariant evaluation failed',
              undefined,
              err instanceof Error ? err.message : 'unknown_error',
            )
          }
          // Only gate on preflight-stable codes (ignore post-migrate-only share-mesh noise).
          const preflightBlocking = invariantViolations.filter((v) =>
            [
              'missing_expected_gauge',
              'missing_expected_creator_coin',
              'strategy_fee_recipient_mismatch',
              'creator_coin_payout_recipient_mismatch',
            ].includes(v.code),
          )
          if (preflightBlocking.length > 0) {
            completionStage = 'invariant_failed'
            return res.status(409).json({
              success: false,
              error: 'preflight_invariant_failed',
              data: {
                sweepTxHash,
                migrateTxHash: null,
                sweepStatus,
                migrateStatus: 'blocked_preflight',
                completionStage,
                invariantViolations: preflightBlocking,
              },
            })
          }
          // Clear soft noise so post-migrate full pass re-evaluates cleanly.
          invariantViolations.length = 0
          invariantChecksRun = 0
        }

        migrateTxHash = await walletClient.writeContract({
          address: ccaLaunchArmAddress as `0x${string}`,
          abi: CCA_STRATEGY_ABI as unknown as Abi,
          functionName: 'migrate',
          chain: base,
          account,
        })
        const migrateReceipt = await publicClient.waitForTransactionReceipt({ hash: migrateTxHash, timeout: 180_000 })
        if (migrateReceipt.status !== 'success') {
          migrateStatus = 'failed'
          return res.status(500).json({
            success: false,
            error: 'migrate() reverted',
            data: { sweepTxHash, migrateTxHash, sweepStatus, migrateStatus },
          } satisfies ApiEnvelope<{
            sweepTxHash: `0x${string}` | null
            migrateTxHash: `0x${string}` | null
            sweepStatus: string
            migrateStatus: string
          }>)
        }
        migrateStatus = 'success'
        lifecycle = await readLifecycle()
      }
    }

    if (
      lifecycle.migrated
      && shareMeshConfig.enabled
      && invariantInput.oracleAddress
      && invariantInput.vaultAddress
      && invariantInput.creatorCoinAddress
      && invariantInput.shareTokenAddress
    ) {
      shareMeshResult = await runShareMeshCompletion({
        publicClient,
        walletClient,
        keeperAddress: account.address as `0x${string}`,
        config: shareMeshConfig,
        input: {
          ccaLaunchArmAddress: ccaLaunchArmAddress as `0x${string}`,
          creatorCoinAddress: invariantInput.creatorCoinAddress,
          shareTokenAddress: invariantInput.shareTokenAddress,
          vaultAddress: invariantInput.vaultAddress,
          oracleAddress: invariantInput.oracleAddress,
          vaultOwnerAddress: invariantInput.vaultOwnerAddress,
        },
      })
    }

    if (lifecycle.migrated) {
      if (shouldAttemptHookConfig) {
        try {
          const [target, calldata] = await publicClient.readContract({
            address: ccaLaunchArmAddress as `0x${string}`,
            abi: CCA_STRATEGY_ABI as unknown as Abi,
            functionName: 'getTaxHookCalldata',
          }) as readonly [`0x${string}`, `0x${string}`]
          const expectedHookTarget = (await readFeeRecipient()).toLowerCase()
          if (!target || target.toLowerCase() !== expectedHookTarget) {
            throw new Error('hook_target_not_allowed')
          }
          if (typeof calldata !== 'string' || !/^0x[0-9a-fA-F]+$/.test(calldata) || calldata.length < 10) {
            throw new Error('hook_calldata_not_allowed')
          }

          hookConfigTxHash = await walletClient.sendTransaction({
            account,
            chain: base,
            to: target,
            data: calldata,
          })
          const hookReceipt = await publicClient.waitForTransactionReceipt({
            hash: hookConfigTxHash,
            timeout: 120_000,
          })
          if (hookReceipt.status === 'success') {
            hookConfigStatus = 'configured'
            completionStage = 'completed'
          } else {
            hookConfigStatus = 'attempt_failed'
            completionStage = 'awaiting_owner_hook_config'
            hookConfigError = 'hook_config_reverted'
          }
        } catch (err) {
          hookConfigStatus = 'attempt_failed'
          completionStage = 'awaiting_owner_hook_config'
          hookConfigError = err instanceof Error ? err.message : 'hook_config_failed'
        }
      } else {
        hookConfigStatus = 'owner_manual_required'
        completionStage = 'awaiting_owner_hook_config'
        if (hookFlagFromEnv && !strategyAllowedForHookConfig) {
          hookConfigError = 'hook_config_strategy_not_allowlisted'
        }
      }
    }

    if (lifecycle.migrated && enforceCompletionInvariants) {
      try {
        await runCompletionInvariants()
      } catch (err) {
        recordInvariantViolation(
          'invariant_check_error',
          'Invariant evaluation failed',
          undefined,
          err instanceof Error ? err.message : 'unknown_error',
        )
      }

      if (invariantViolations.length > 0) {
        completionStage = 'invariant_failed'
      }
    }

    try {
      unsoldTxHash = await walletClient.writeContract({
        address: ccaLaunchArmAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'sweepUnsoldTokens',
        chain: base,
        account,
      })

      const unsoldReceipt = await publicClient.waitForTransactionReceipt({ hash: unsoldTxHash, timeout: 120_000 })
      unsoldStatus = unsoldReceipt.status === 'success' ? 'success' : 'reverted'
    } catch (err) {
      console.warn('[keeper/sweep] sweepUnsoldTokens failed (non-critical):', err)
      unsoldStatus = 'failed'
    }

    const completed = completionStage === 'completed'
    const invariantGateFailed = completionStage === 'invariant_failed'
    const currentBlock = await publicClient.getBlockNumber()
    if (!lifecycle.migrated && completionStage === 'in_progress') {
      completionStage = 'awaiting_migration_block'
    }
    if (!completed && completionStage === 'in_progress' && lifecycle.migrated) {
      completionStage = 'awaiting_owner_hook_config'
    }

    const settlementWrite = {
      requested: Boolean(markSettled),
      applied: false,
      operationId: null as string | null,
      error: null as string | null,
    }
    let settlementBindingFailed = false
    if (completed && markSettled) {
      try {
        if (
          !invariantInput.creatorCoinAddress
          || !invariantInput.vaultAddress
          || markSettled.vaultAddress !== invariantInput.vaultAddress
        ) {
          settlementBindingFailed = true
          settlementWrite.error = 'settlement_vault_binding_invalid'
        } else {
          const listing = await validateKeeperVaultListing({
            creatorCoinAddress: invariantInput.creatorCoinAddress,
            vaultAddress: markSettled.vaultAddress,
            shareTokenAddress: invariantInput.shareTokenAddress,
          })
          if (!listing.ok) {
            settlementBindingFailed = true
            settlementWrite.error = `settlement_vault_binding_${listing.reason}`
          }
        }
        if (settlementBindingFailed) {
          console.warn('[keeper/sweep] settlement write blocked by creator-coin/vault binding', {
            vaultAddress: markSettled.vaultAddress,
            creatorCoinAddress: invariantInput.creatorCoinAddress,
            error: settlementWrite.error,
          })
        } else {
          const controlPlane = createVaultControlPlane()
          const settleResult = await controlPlane.settleVault({
            vaultAddress: markSettled.vaultAddress,
            settledAt: new Date().toISOString(),
            settlementStage: 'completed',
            settledAtAuthority: SWEEP_COMPLETION_AUTHORITY,
            requestedBy: 'api:keeper/sweep',
            idempotencyKey: `sweep-complete:${markSettled.vaultAddress}`,
          })
          settlementWrite.applied = settleResult.accepted
          settlementWrite.operationId = settleResult.operationId
        }
      } catch (error) {
        settlementBindingFailed = true
        settlementWrite.error = 'settlement_registry_verification_unavailable'
        console.warn('[keeper/sweep] control-plane settle failed (will rely on follow-up):', {
          vaultAddress: markSettled.vaultAddress,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const responseData = {
      sweepTxHash,
      migrateTxHash,
      hookConfigTxHash,
      sweepStatus,
      migrateStatus,
      hookConfigStatus,
      hookConfigAttempted: shouldAttemptHookConfig,
      hookConfigError,
      unsoldTxHash,
      unsoldStatus,
      completionStage,
      completed,
      lifecyclePhase: lifecycle.phase,
      migrationBlock: lifecycle.migrationBlock.toString(),
      currentBlock: currentBlock.toString(),
      invariantsEnforced: enforceCompletionInvariants,
      invariantChecksRun,
      invariantViolations,
      shareMesh: shareMeshResult,
      settlementWrite,
    }

    if (invariantGateFailed) {
      return res.status(200).json({
        success: false,
        error: 'completion_invariant_failed',
        data: responseData,
      } satisfies ApiEnvelope<typeof responseData>)
    }

    if (settlementBindingFailed) {
      return res.status(409).json({
        success: false,
        error: settlementWrite.error ?? 'settlement_vault_binding_failed',
        data: responseData,
      } satisfies ApiEnvelope<typeof responseData>)
    }

    return res.status(200).json({
      success: true,
      data: responseData,
    } satisfies ApiEnvelope<{
      sweepTxHash: string | null
      migrateTxHash: string | null
      hookConfigTxHash: string | null
      sweepStatus: string
      migrateStatus: string
      hookConfigStatus: string
      hookConfigAttempted: boolean
      hookConfigError: string | null
      unsoldTxHash: string | null
      unsoldStatus: string
      completionStage: CompletionStage
      completed: boolean
      lifecyclePhase: number
      migrationBlock: string
      currentBlock: string
      invariantsEnforced: boolean
      invariantChecksRun: number
      invariantViolations: InvariantViolation[]
      settlementWrite: { requested: boolean; applied: boolean; operationId: string | null; error: string | null }
    }>)
  } catch (err) {
    console.error('[keeper/sweep] Error:', err)
    return res.status(500).json({
      success: false,
      error: 'keeper_sweep_failed',
    } satisfies ApiEnvelope<never>)
  }
}
