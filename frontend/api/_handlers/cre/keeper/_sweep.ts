/**
 * POST /api/cre/keeper/sweep
 *
 * HTTP bridge endpoint for CRE workflows. Accepts a CCA strategy address and
 * executes canonical completion phases:
 *   1) sweepCurrency()
 *   2) migrate() when migrationBlock is ready
 *   3) optional hook setTaxConfig() when keeper hook mode is enabled
 *
 * Notes:
 * - sweepCurrency(), migrate(), sweepUnsoldTokens() are permissionless calls on strategy.
 * - hook configuration may require owner privileges on the hook.
 * - dual mode:
 *   - default: owner/manual hook config required
 *   - optional: keeper attempts hook config when enabled
 *
 * Protected by KEEPR_API_KEY Bearer token.
 *
 * Request body: { ccaStrategyAddress: string, attemptHookConfig?: boolean }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { createPublicClient, createWalletClient, http, type Abi } from 'viem'
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
  { type: 'function', name: 'sweepCurrency', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'migrate', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sweepUnsoldTokens', inputs: [], outputs: [], stateMutability: 'nonpayable' },
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
  | 'in_progress'

function parseLifecycleStatus(raw: unknown): LifecycleSnapshot {
  const lifecycle = raw as any
  return {
    phase: Number(lifecycle?.phase ?? lifecycle?.[0] ?? -1),
    currencySwept: Boolean(lifecycle?.currencySwept ?? lifecycle?.[5] ?? false),
    migrated: Boolean(lifecycle?.migrated ?? lifecycle?.[7] ?? false),
    migrationBlock: BigInt(lifecycle?.migrationBlock ?? lifecycle?.[12] ?? 0n),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Auth check
  const secret = process.env.KEEPR_API_KEY
  if (!secret) {
    return res.status(500).json({ success: false, error: 'KEEPR_API_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const { ccaStrategyAddress, attemptHookConfig } = req.body as {
    ccaStrategyAddress?: string
    attemptHookConfig?: boolean
  }
  if (!ccaStrategyAddress || !ccaStrategyAddress.startsWith('0x') || ccaStrategyAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid ccaStrategyAddress' } satisfies ApiEnvelope<never>)
  }

  const keeperPk = process.env.KEEPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KEEPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const account = privateKeyToAccount(keeperPk as `0x${string}`)
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

    const hookFlagFromEnv = process.env.KEEPER_ENABLE_HOOK_CONFIG === 'true'
    const shouldAttemptHookConfig = typeof attemptHookConfig === 'boolean' ? attemptHookConfig : hookFlagFromEnv

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

    const readLifecycle = async (): Promise<LifecycleSnapshot> =>
      parseLifecycleStatus(await publicClient.readContract({
        address: ccaStrategyAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'getLifecycleStatus',
      }))

    let lifecycle = await readLifecycle()

    // Step 1: sweepCurrency if needed.
    if (!lifecycle.currencySwept) {
      sweepTxHash = await walletClient.writeContract({
        address: ccaStrategyAddress as `0x${string}`,
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

    // Step 2: migrate when ready.
    if (!lifecycle.migrated) {
      const currentBlock = await publicClient.getBlockNumber()
      if (currentBlock < lifecycle.migrationBlock) {
        migrateStatus = 'awaiting_block'
        completionStage = 'awaiting_migration_block'
      } else {
        migrateTxHash = await walletClient.writeContract({
          address: ccaStrategyAddress as `0x${string}`,
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

    // Step 3: optional hook config (dual mode).
    if (lifecycle.migrated) {
      if (shouldAttemptHookConfig) {
        try {
          const [target, calldata] = await publicClient.readContract({
            address: ccaStrategyAddress as `0x${string}`,
            abi: CCA_STRATEGY_ABI as unknown as Abi,
            functionName: 'getTaxHookCalldata',
          }) as readonly [`0x${string}`, `0x${string}`]

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
      }
    }

    // Step 4: sweepUnsoldTokens best-effort (non-critical).
    try {
      unsoldTxHash = await walletClient.writeContract({
        address: ccaStrategyAddress as `0x${string}`,
        abi: CCA_STRATEGY_ABI as unknown as Abi,
        functionName: 'sweepUnsoldTokens',
        chain: base,
        account,
      })

      const unsoldReceipt = await publicClient.waitForTransactionReceipt({ hash: unsoldTxHash, timeout: 120_000 })
      unsoldStatus = unsoldReceipt.status === 'success' ? 'success' : 'reverted'
    } catch (err) {
      // sweepUnsoldTokens failure is non-critical
      console.warn('[cre/keeper/sweep] sweepUnsoldTokens failed (non-critical):', err)
      unsoldStatus = 'failed'
    }

    const completed = completionStage === 'completed'
    const currentBlock = await publicClient.getBlockNumber()
    if (!lifecycle.migrated && completionStage === 'in_progress') {
      completionStage = 'awaiting_migration_block'
    }
    if (!completed && completionStage === 'in_progress' && lifecycle.migrated) {
      completionStage = 'awaiting_owner_hook_config'
    }

    return res.status(200).json({
      success: true,
      data: {
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
      },
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
    }>)
  } catch (err) {
    console.error('[cre/keeper/sweep] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
