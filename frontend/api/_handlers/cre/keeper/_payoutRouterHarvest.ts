/**
 * POST /api/keeper/payout-router-harvest
 *
 * CRE-independent HTTP bridge for the payout-router harvest lane.
 * Processes a single payout router using the keeper wallet:
 * - optionally claimAllProtocolRewards()
 * - convertAndQueue creatorCoin, ZORA, and/or WETH balances
 *
 * Protected by KEEPR_API_KEY Bearer token.
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
} from '../../../../packages/server-core/src/index.js'
import { createPublicClient, createWalletClient, getAddress, http, isAddress, type Abi } from 'viem'
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
  tokens: TokenResult[]
}

type HarvestBody = {
  payoutRouterAddress?: string
  creatorCoinAddress?: string
  includeZora?: boolean
  includeWeth?: boolean
  claimProtocolRewards?: boolean
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
    rateLimitKey('cre-keeper-payout-router-harvest', getClientIp(req)),
    RATE_LIMITS.creRuntimeTriggerWrite,
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

  const keeperPk = process.env.KEEPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KEEPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
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
      if (token.label !== 'creatorCoin') {
        const path = await publicClient.readContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI as unknown as Abi,
          functionName: 'swapPathToCreator',
          args: [token.token],
        }) as `0x${string}`
        if (!path || path === '0x') {
          tokens.push({ token: token.token, label: token.label, balance: balance.toString(), converted: false, skippedReason: 'path_not_configured' })
          continue
        }
      }
      try {
        const txHash = await walletClient.writeContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI as unknown as Abi,
          functionName: 'convertAndQueue',
          args: [token.token, balance, token.minCreatorOut],
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

    return res.status(200).json({
      success: true,
      data: {
        payoutRouterAddress,
        claimedProtocolRewards,
        claimableBefore: claimableBefore.toString(),
        claimTxHash,
        tokens,
      },
    } satisfies ApiEnvelope<HarvestResponse>)
  } catch (error) {
    console.error('[cre/keeper/payout-router-harvest] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
