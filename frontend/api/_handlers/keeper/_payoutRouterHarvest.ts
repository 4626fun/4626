/**
 * POST /api/keeper/payout-router-harvest
 *
 * HTTP bridge for payout-router harvest lane:
 * - optionally claimAllProtocolRewards()
 * - convertAndQueue creatorCoin, ZORA, and/or WETH balances
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
import { resolveHarvestMinCreatorOut } from '../../../server/_lib/onchain/payoutRouterMinOut.js'
import {
  executePayoutRouterTreasurySetup,
  payoutRouterTreasuryAutoSetupEnabled,
} from '../../../server/_lib/onchain/payoutRouterTreasurySetup.js'
import { createPublicClient, createWalletClient, getAddress, http, isAddress, type Abi, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const DEFAULT_ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69' as const
const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as const

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const PAYOUT_ROUTER_ABI = [
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
    name: 'convertAndQueue',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minCreatorOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'creatorOut', type: 'uint256' },
      { name: 'sharesQueued', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'swapPathToCreator',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
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
  txHash?: `0x${string}`
  skippedReason?: string
  error?: string
}

type HarvestResponse = {
  payoutRouterAddress: `0x${string}`
  claimedProtocolRewards: boolean
  claimableBefore: string
  claimTxHash: `0x${string}` | null
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
  minCreatorOutWei?: string
  tokens?: Array<{ token?: string; label?: string; minCreatorOutWei?: string }>
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

function readTokenPlan(body: HarvestBody): Array<{ token: `0x${string}`; label: string; minCreatorOut: bigint }> {
  const minCreatorOut = parseNonNegativeBigInt(body.minCreatorOutWei)
  const out: Array<{ token: `0x${string}`; label: string; minCreatorOut: bigint }> = []
  const seen = new Set<string>()
  const add = (token: `0x${string}` | null, label: string, minOut = minCreatorOut) => {
    if (!token) return
    const key = token.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({ token, label, minCreatorOut: minOut })
  }

  add(normalizeAddress(body.creatorCoinAddress), 'creatorCoin', 0n)
  if (body.includeZora !== false) add(normalizeAddress(process.env.PAYOUT_ROUTER_ZORA_TOKEN) ?? DEFAULT_ZORA_TOKEN, 'ZORA')
  if (body.includeWeth !== false) add(normalizeAddress(process.env.WETH) ?? DEFAULT_WETH, 'WETH')
  for (const entry of Array.isArray(body.tokens) ? body.tokens : []) {
    add(normalizeAddress(entry.token), entry.label || 'custom', parseNonNegativeBigInt(entry.minCreatorOutWei, minCreatorOut))
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
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
    const minBalance = parseNonNegativeBigInt(body.minBalanceWei)
    const claimProtocolRewards = body.claimProtocolRewards !== false

    let claimTxHash: `0x${string}` | null = null
    let claimedProtocolRewards = false
    const claimableBefore = claimProtocolRewards
      ? await publicClient.readContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI as unknown as Abi,
          functionName: 'protocolRewardsClaimable',
        }) as bigint
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

    const readSwapPath = async (tokenIn: `0x${string}`): Promise<Hex> => {
      const path = await publicClient.readContract({
        address: payoutRouterAddress,
        abi: PAYOUT_ROUTER_ABI as unknown as Abi,
        functionName: 'swapPathToCreator',
        args: [tokenIn],
      }) as `0x${string}`
      return (path && path !== '0x' ? path : '0x') as Hex
    }

    // Self-heal: when a swap path is missing and treasury auto-setup is
    // enabled, run the Safe-batched setup plan (setKeeper/setSwapPath/external
    // approvals) once per request, then re-read the path.
    const maybeSelfHealSwapPath = async (tokenIn: `0x${string}`): Promise<Hex> => {
      if (treasurySetupAttempted || !creatorCoinAddress || !payoutRouterTreasuryAutoSetupEnabled()) {
        return '0x' as Hex
      }
      treasurySetupAttempted = true
      try {
        const setup = await executePayoutRouterTreasurySetup({
          publicClient,
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
        if (!setup.executed) return '0x' as Hex
      } catch (error) {
        console.warn('[keeper/payout-router-harvest] treasury setup self-heal failed', {
          payoutRouterAddress,
          message: error instanceof Error ? error.message : String(error),
        })
        return '0x' as Hex
      }
      return readSwapPath(tokenIn)
    }

    const tokens: TokenResult[] = []
    for (const token of tokenPlan) {
      const balance = await publicClient.readContract({
        address: token.token,
        abi: ERC20_ABI as unknown as Abi,
        functionName: 'balanceOf',
        args: [payoutRouterAddress],
      }) as bigint
      if (balance <= minBalance) {
        tokens.push({ token: token.token, label: token.label, balance: balance.toString(), converted: false, skippedReason: 'balance_below_threshold' })
        continue
      }
      let minCreatorOut = token.minCreatorOut
      if (token.label !== 'creatorCoin') {
        let path = await readSwapPath(token.token)
        if (path === '0x') {
          path = await maybeSelfHealSwapPath(token.token)
        }
        if (path === '0x') {
          tokens.push({ token: token.token, label: token.label, balance: balance.toString(), converted: false, skippedReason: 'path_not_configured' })
          continue
        }
        // Slippage guard: the V3 route does not enforce min-out on-chain, so
        // never submit a swap with min-out 0 — quote it, or skip (fail closed).
        const minOut = await resolveHarvestMinCreatorOut({
          publicClient,
          path,
          amountIn: balance,
          configuredMinOut: token.minCreatorOut,
        })
        if (!minOut.ok) {
          tokens.push({ token: token.token, label: token.label, balance: balance.toString(), converted: false, skippedReason: minOut.reason })
          continue
        }
        minCreatorOut = minOut.minCreatorOut
      }
      try {
        const txHash = await walletClient.writeContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI as unknown as Abi,
          functionName: 'convertAndQueue',
          args: [token.token, balance, minCreatorOut],
          chain: base,
          account,
        })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
        tokens.push({ token: token.token, label: token.label, balance: balance.toString(), converted: receipt.status === 'success', txHash })
      } catch (error) {
        tokens.push({
          token: token.token,
          label: token.label,
          balance: balance.toString(),
          converted: false,
          error: error instanceof Error ? error.message : 'convert_failed',
        })
      }
    }

    let burnStreamCheckpointTxHash: `0x${string}` | null = null
    const dripBurnStream = body.dripBurnStream !== false
    const burnStreamAddress = normalizeAddress(body.burnStreamAddress)
    if (dripBurnStream && burnStreamAddress) {
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
