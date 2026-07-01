/**
 * POST /api/keeper/payout-router-harvest
 *
 * HTTP bridge for payout-router harvest lane:
 * - optionally claimAllProtocolRewards()
 * - plan + processBatch for creatorCoin, ZORA, WETH, and USDC balances
 * - optional DefiLlama external swap fallback (parity with KPR)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  rateLimitKey,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
} from '@4626/server-core'
import { resolvePayoutRouterKeeperPrivateKey } from '../../../server/_lib/onchain/payoutRouterRuntime.js'
import {
  executePayoutRouterTreasurySetup,
  payoutRouterTreasuryAutoSetupEnabled,
} from '../../../server/_lib/onchain/payoutRouterTreasurySetup.js'
import {
  PAYOUT_ROUTER_HARVEST_ABI,
  planPayoutRouterHarvestConversions,
  type HarvestPlanReader,
  type HarvestTokenPlanEntry,
} from '../../../server/_lib/onchain/payoutRouterHarvestPlan.js'
import { buildDefaultPayoutRouterHarvestTokenPlan } from '../../../server/_lib/onchain/payoutRouterHarvestTokens.js'
import {
  executePlannedHarvestConversions,
  parseHarvestPerTokenFallbackEnv,
} from '../../../server/_lib/onchain/payoutRouterHarvestExecute.js'
import { createPublicClient, createWalletClient, getAddress, http, isAddress, type Abi, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const DEFAULT_ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69' as const
const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as const
const DEFAULT_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

const PAYOUT_ROUTER_ABI = [
  ...PAYOUT_ROUTER_HARVEST_ABI,
  {
    type: 'function',
    name: 'protocolRewardsClaimable',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimAllProtocolRewards',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shareOFT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

const BURN_STREAM_ABI = [
  {
    type: 'function',
    name: 'checkpoint',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

type TokenResult = {
  token: `0x${string}`
  label: string
  balance: string
  converted: boolean
  route?: 'v3' | 'external' | 'direct'
  txHash?: `0x${string}`
  batchTxHash?: `0x${string}`
  skippedReason?: string
  error?: string
}

type HarvestResponse = {
  payoutRouterAddress: `0x${string}`
  claimedProtocolRewards: boolean
  claimableBefore: string
  claimTxHash: `0x${string}` | null
  batchTxHash?: `0x${string}` | null
  burnStreamCheckpointTxHash?: `0x${string}` | null
  tokens: TokenResult[]
}

type HarvestBody = {
  payoutRouterAddress?: string
  creatorCoinAddress?: string
  burnStreamAddress?: string
  vaultAddress?: string
  includeZora?: boolean
  includeWeth?: boolean
  claimProtocolRewards?: boolean
  dripBurnStream?: boolean
  minBalanceWei?: string
  minOutWei?: string
  tokens?: Array<{ token?: string; label?: string; minOutWei?: string }>
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return isAddress(raw) ? (getAddress(raw) as `0x${string}`) : null
}

function parseNonNegativeBigInt(value: unknown, fallback = 0n): bigint {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback
  try {
    const parsed = BigInt(raw)
    return parsed >= 0n ? parsed : fallback
  } catch {
    return fallback
  }
}

function readTokenPlan(body: HarvestBody): HarvestTokenPlanEntry[] {
  const defaultMinOut = parseNonNegativeBigInt(body.minOutWei)
  const creatorCoin = normalizeAddress(body.creatorCoinAddress)
  const hasCustomTokens = Array.isArray(body.tokens) && body.tokens.length > 0
  if (creatorCoin && !hasCustomTokens) {
    return buildDefaultPayoutRouterHarvestTokenPlan({
      creatorCoin,
      includeWeth: body.includeWeth !== false,
      minOutDefault: defaultMinOut,
      minOutZora: parseNonNegativeBigInt(process.env.PAYOUT_ROUTER_MIN_OUT_ZORA_WEI, defaultMinOut),
      minOutWeth: parseNonNegativeBigInt(process.env.PAYOUT_ROUTER_MIN_OUT_WETH_WEI, defaultMinOut),
      minOutUsdc: parseNonNegativeBigInt(process.env.PAYOUT_ROUTER_MIN_OUT_USDC_WEI, defaultMinOut),
    }).map((entry) => ({
      ...entry,
      token: getAddress(entry.token) as `0x${string}`,
    }))
  }

  const out: HarvestTokenPlanEntry[] = []
  const seen = new Set<string>()
  const add = (token: `0x${string}` | null, label: string, minOut = defaultMinOut) => {
    if (!token) return
    const normalized = getAddress(token) as `0x${string}`
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ token: normalized, label, minOut })
  }

  add(creatorCoin, 'creatorCoin', 0n)
  if (body.includeZora !== false) add(normalizeAddress(process.env.PAYOUT_ROUTER_ZORA_TOKEN) ?? DEFAULT_ZORA_TOKEN, 'ZORA')
  if (body.includeWeth !== false) add(normalizeAddress(process.env.WETH) ?? DEFAULT_WETH, 'WETH')
  add(normalizeAddress(process.env.USDC ?? process.env.PAYOUT_ROUTER_USDC_TOKEN) ?? DEFAULT_USDC, 'USDC')
  for (const entry of Array.isArray(body.tokens) ? body.tokens : []) {
    add(normalizeAddress(entry.token), entry.label || 'custom', parseNonNegativeBigInt(entry.minOutWei, defaultMinOut))
  }
  return out
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
    rateLimitKey('keeper-payout-router-harvest', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody<HarvestBody>(req, { maxBytes: 16_384 })) ?? {}
  const payoutRouterAddress = normalizeAddress(body.payoutRouterAddress)
  if (!payoutRouterAddress) {
    return res.status(400).json({ success: false, error: 'Invalid payoutRouterAddress' } satisfies ApiEnvelope<never>)
  }
  const tokenPlan = readTokenPlan(body)
  if (tokenPlan.length === 0) {
    return res.status(400).json({ success: false, error: 'No harvest tokens configured' } satisfies ApiEnvelope<never>)
  }

  const keeperPk = resolvePayoutRouterKeeperPrivateKey(process.env)
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'Payout router keeper private key not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const account = privateKeyToAccount(keeperPk as `0x${string}`)
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
    const planClient = publicClient as unknown as HarvestPlanReader
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
    const minBalance = parseNonNegativeBigInt(body.minBalanceWei)
    const claimProtocolRewards = body.claimProtocolRewards !== false

    let claimTxHash: `0x${string}` | null = null
    let claimedProtocolRewards = false
    const claimableBefore = claimProtocolRewards
      ? (await publicClient.readContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI as unknown as Abi,
          functionName: 'protocolRewardsClaimable',
        }) as bigint)
      : 0n

    if (claimProtocolRewards && claimableBefore > 0n) {
      claimTxHash = await walletClient.writeContract({
        address: payoutRouterAddress,
        abi: PAYOUT_ROUTER_ABI as unknown as Abi,
        functionName: 'claimAllProtocolRewards',
        chain: base,
        account,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTxHash, timeout: 120_000 })
      claimedProtocolRewards = receipt.status === 'success'
    }

    const creatorCoinAddress = normalizeAddress(body.creatorCoinAddress)
    let treasurySetupAttempted = false

    const readSwapPath = async (tokenIn: Address): Promise<Hex> => {
      const path = await publicClient.readContract({
        address: payoutRouterAddress,
        abi: PAYOUT_ROUTER_ABI as unknown as Abi,
        functionName: 'swapPathToShareOFT',
        args: [tokenIn],
      }) as Hex
      return path && path !== '0x' ? path : '0x'
    }

    const maybeSelfHealSwapPath = async (tokenIn: Address): Promise<Hex> => {
      if (treasurySetupAttempted || !creatorCoinAddress || !payoutRouterTreasuryAutoSetupEnabled()) {
        return '0x'
      }
      treasurySetupAttempted = true
      try {
        const setup = await executePayoutRouterTreasurySetup({
          publicClient: publicClient as Parameters<typeof executePayoutRouterTreasurySetup>[0]['publicClient'],
          rpcUrl,
          payoutRouter: payoutRouterAddress,
          creatorToken: creatorCoinAddress,
        })
        console.info('[keeper/payout-router-harvest] treasury setup self-heal', {
          payoutRouterAddress,
          executed: setup.executed,
          txHash: setup.txHash ?? null,
          skipReason: setup.plan.skipReason ?? null,
        })
        if (!setup.executed) return '0x'
      } catch (error) {
        console.warn('[keeper/payout-router-harvest] treasury setup self-heal failed', {
          payoutRouterAddress,
          message: error instanceof Error ? error.message : String(error),
        })
        return '0x'
      }
      return readSwapPath(tokenIn)
    }

    const shareOft = await publicClient.readContract({
      address: payoutRouterAddress,
      abi: PAYOUT_ROUTER_ABI as unknown as Abi,
      functionName: 'shareOFT',
    }) as Address

    const { conversions, skipped } = await planPayoutRouterHarvestConversions({
      publicClient: planClient,
      payoutRouterAddress,
      shareOft,
      tokenPlan,
      minBalance,
      env: process.env,
      resolveSwapPath: async (tokenIn) => {
        let path = await readSwapPath(tokenIn)
        if (path === '0x') path = await maybeSelfHealSwapPath(tokenIn)
        return path
      },
    })

    const tokens: TokenResult[] = skipped.map((entry) => ({
      token: entry.token as `0x${string}`,
      label: entry.label,
      balance: entry.balance.toString(),
      converted: false,
      skippedReason: entry.skippedReason,
    }))

    let batchTxHash: `0x${string}` | null = null
    let batchSucceeded = false
    if (conversions.length > 0) {
      const perTokenFallback = parseHarvestPerTokenFallbackEnv(process.env)
      const execution = await executePlannedHarvestConversions({
        conversions,
        perTokenFallback,
        submitBatch: async (actions) => {
          try {
            const hash = await walletClient.writeContract({
              address: payoutRouterAddress,
              abi: PAYOUT_ROUTER_ABI as unknown as Abi,
              functionName: 'processBatch',
              args: [actions],
              chain: base,
              account,
            })
            const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
            if (receipt.status === 'success') {
              return { success: true, txHash: hash }
            }
            return { success: false, txHash: hash, error: 'process_batch_reverted' }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'process_batch_failed',
            }
          }
        },
      })

      batchTxHash = execution.primaryBatchTxHash ?? null
      batchSucceeded = execution.converted.length > 0

      for (const success of execution.converted) {
        tokens.push({
          token: success.conversion.token as `0x${string}`,
          label: success.conversion.label,
          balance: success.conversion.balance.toString(),
          converted: true,
          route: success.conversion.route,
          txHash: success.txHash ?? execution.primaryBatchTxHash,
          batchTxHash: success.txHash ?? execution.primaryBatchTxHash,
        })
      }

      for (const failure of execution.failed) {
        tokens.push({
          token: failure.conversion.token as `0x${string}`,
          label: failure.conversion.label,
          balance: failure.conversion.balance.toString(),
          converted: false,
          route: failure.conversion.route,
          batchTxHash: failure.txHash ?? execution.primaryBatchTxHash,
          error: failure.error ?? 'process_batch_failed',
        })
      }

      if (execution.usedPerTokenFallback && execution.converted.length > 0) {
        console.info('[keeper/payout-router-harvest] per-token fallback converted partial batch', {
          payoutRouterAddress,
          converted: execution.converted.length,
          failed: execution.failed.length,
        })
      }
    }

    let burnStreamCheckpointTxHash: `0x${string}` | null = null
    const dripBurnStream = body.dripBurnStream !== false
    const burnStreamAddress = normalizeAddress(body.burnStreamAddress)
    if (batchSucceeded && dripBurnStream && burnStreamAddress) {
      try {
        burnStreamCheckpointTxHash = await walletClient.writeContract({
          address: burnStreamAddress,
          abi: BURN_STREAM_ABI as unknown as Abi,
          functionName: 'checkpoint',
          chain: base,
          account,
        })
        await publicClient.waitForTransactionReceipt({ hash: burnStreamCheckpointTxHash, timeout: 120_000 })
      } catch (error) {
        console.warn('[keeper/payout-router-harvest] burn stream checkpoint failed', {
          burnStreamAddress,
          message: error instanceof Error ? error.message : String(error),
        })
        burnStreamCheckpointTxHash = null
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        payoutRouterAddress,
        claimedProtocolRewards,
        claimableBefore: claimableBefore.toString(),
        claimTxHash,
        batchTxHash,
        burnStreamCheckpointTxHash,
        tokens,
      },
    } satisfies ApiEnvelope<HarvestResponse>)
  } catch (error) {
    console.error('[keeper/payout-router-harvest] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
