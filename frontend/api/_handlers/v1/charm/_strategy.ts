import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'



declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 120) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function getReadRpcUrl(): string {
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://mainnet.base.org'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStrategyParam(req: VercelRequest): string {
  const v = (typeof req.query?.strategy === 'string' ? req.query.strategy : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  return v
}

const STRAT_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'CREATOR', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'USDC', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'UNISWAP_ROUTER', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'swapPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'uniFactory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'autoFeeTier', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'maxSwapPercent', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'swapSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'depositSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'swapPoolFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { type: 'function', name: 'active', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'getTotalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'isCharmInRange',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }, { type: 'int24' }, { type: 'int24' }, { type: 'int24' }],
  },
  { type: 'function', name: 'isActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const CHARM_VAULT_ABI = [
  { type: 'function', name: 'pool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'baseLower', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { type: 'function', name: 'baseUpper', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { type: 'function', name: 'getTotalAmounts', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/charm/strategy', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-charm-strategy', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.charmRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const strategy = getStrategyParam(req)
  if (!strategy) return res.status(400).json({ success: false, error: 'strategy is required' })
  if (!isAddressLike(strategy)) return res.status(400).json({ success: false, error: 'Invalid strategy address' })

  try {
    const { createPublicClient, http, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getReadRpcUrl(), { timeout: 20_000 }),
    })

    const calls = await client.multicall({
      allowFailure: true,
      contracts: [
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'owner' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'vault' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'CREATOR' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'USDC' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'UNISWAP_ROUTER' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'charmVault' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'swapPool' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'uniFactory' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'autoFeeTier' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'maxSwapPercent' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'swapSlippageBps' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'depositSlippageBps' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'swapPoolFee' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'active' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'getTotalAssets' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'isCharmInRange' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'isActive' },
        { address: strategy as `0x${string}`, abi: STRAT_ABI, functionName: 'asset' },
      ],
    })

    const pick = <T,>(idx: number): T | null => (calls[idx]?.status === 'success' ? (calls[idx] as any).result : null)

    const owner = pick<`0x${string}`>(0)
    const vault = pick<`0x${string}`>(1)
    const creator = pick<`0x${string}`>(2)
    const usdc = pick<`0x${string}`>(3)
    const router = pick<`0x${string}`>(4)
    const charmVault = pick<`0x${string}`>(5)
    const swapPool = pick<`0x${string}`>(6)
    const uniFactory = pick<`0x${string}`>(7)
    const autoFeeTier = pick<boolean>(8)
    const maxSwapPercent = pick<bigint>(9)
    const swapSlippageBps = pick<bigint>(10)
    const depositSlippageBps = pick<bigint>(11)
    const swapPoolFee = pick<number>(12)
    const active = pick<boolean>(13)
    const totalAssets = pick<bigint>(14)
    const inRangeTuple = pick<any>(15)
    const isActive = pick<boolean>(16)
    const asset = pick<`0x${string}`>(17)

    const inRange = Array.isArray(inRangeTuple) ? Boolean(inRangeTuple[0]) : null
    const currentTick = Array.isArray(inRangeTuple) ? Number(inRangeTuple[1]) : null
    const lower = Array.isArray(inRangeTuple) ? Number(inRangeTuple[2]) : null
    const upper = Array.isArray(inRangeTuple) ? Number(inRangeTuple[3]) : null

    // Optional: peek into the Charm vault if configured.
    let charm: any = null
    if (charmVault && isAddress(String(charmVault))) {
      const charmCalls = await client.multicall({
        allowFailure: true,
        contracts: [
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'pool' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'token0' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'token1' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'baseLower' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'baseUpper' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'getTotalAmounts' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'totalSupply' },
          { address: charmVault as `0x${string}`, abi: CHARM_VAULT_ABI, functionName: 'balanceOf', args: [strategy as `0x${string}`] },
        ],
      })
      const p2 = <T,>(idx: number): T | null => (charmCalls[idx]?.status === 'success' ? (charmCalls[idx] as any).result : null)
      const totalAmounts = p2<any>(5)
      charm = {
        pool: p2<`0x${string}`>(0),
        token0: p2<`0x${string}`>(1),
        token1: p2<`0x${string}`>(2),
        baseLower: p2<number>(3),
        baseUpper: p2<number>(4),
        total0: Array.isArray(totalAmounts) ? (BigInt(totalAmounts[0] as any).toString() as string) : null,
        total1: Array.isArray(totalAmounts) ? (BigInt(totalAmounts[1] as any).toString() as string) : null,
        totalSupply: (() => {
          const v = p2<bigint>(6)
          return v == null ? null : BigInt(v as any).toString()
        })(),
        strategyShares: (() => {
          const v = p2<bigint>(7)
          return v == null ? null : BigInt(v as any).toString()
        })(),
      }
    }

    setCache(res, 120)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        strategy: strategy.toLowerCase(),
        generatedAt: new Date().toISOString(),
        owner: owner && isAddressLike(owner) ? owner.toLowerCase() : null,
        vault: vault && isAddressLike(vault) ? vault.toLowerCase() : null,
        asset: asset && isAddressLike(asset) ? asset.toLowerCase() : null,
        isActive: typeof isActive === 'boolean' ? isActive : null,
        activeFlag: typeof active === 'boolean' ? active : null,
        tokens: {
          creator: creator && isAddressLike(creator) ? creator.toLowerCase() : null,
          usdc: usdc && isAddressLike(usdc) ? usdc.toLowerCase() : null,
        },
        routers: {
          uniswap: router && isAddressLike(router) ? router.toLowerCase() : null,
          uniFactory: uniFactory && isAddressLike(uniFactory) ? uniFactory.toLowerCase() : null,
          autoFeeTier: typeof autoFeeTier === 'boolean' ? autoFeeTier : null,
        },
        params: {
          maxSwapPercent: maxSwapPercent == null ? null : BigInt(maxSwapPercent as any).toString(),
          swapSlippageBps: swapSlippageBps == null ? null : BigInt(swapSlippageBps as any).toString(),
          depositSlippageBps: depositSlippageBps == null ? null : BigInt(depositSlippageBps as any).toString(),
          swapPoolFee: swapPoolFee == null ? null : String(swapPoolFee),
          swapPool: swapPool && isAddressLike(swapPool) ? swapPool.toLowerCase() : null,
          charmVault: charmVault && isAddressLike(charmVault) ? charmVault.toLowerCase() : null,
        },
        totals: {
          totalAssetsCreatorWei: totalAssets == null ? null : BigInt(totalAssets as any).toString(),
        },
        inRange: {
          inRange,
          currentTick,
          lower,
          upper,
        },
        charmVault: charm,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to load charm strategy' })
  }
}
