import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'

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

function getVaultParam(req: VercelRequest): string {
  const v = (typeof req.query?.vault === 'string' ? req.query.vault : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  return v
}

const VAULT_STRATS_ABI = [
  {
    type: 'function',
    name: 'getStrategies',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'strategies', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'assets', type: 'uint256[]' },
    ],
  },
] as const

const STRATEGY_BASE_ABI = [
  { type: 'function', name: 'isActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_ABI = [
  { type: 'function', name: 'ajnaPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'ajnaFactory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'collateralToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bucketIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'idleBufferBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const CHARM_ABI = [
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'swapPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'swapPoolFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { type: 'function', name: 'swapSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'depositSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxSwapPercent', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'useZRouter', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'autoFeeTier', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const

type StrategyInfo = {
  address: `0x${string}`
  weight: string
  isActive: boolean | null
  owner: `0x${string}` | null
  asset: `0x${string}` | null
  kind: 'ajna' | 'charm' | 'unknown'
  ajna?: {
    pool: `0x${string}` | null
    factory: `0x${string}` | null
    collateralToken: `0x${string}` | null
    bucketIndex: string | null
    idleBufferBps: string | null
  }
  charm?: {
    charmVault: `0x${string}` | null
    swapPool: `0x${string}` | null
    swapPoolFee: string | null
    swapSlippageBps: string | null
    depositSlippageBps: string | null
    maxSwapPercent: string | null
    useZRouter: boolean | null
    autoFeeTier: boolean | null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/strategies', kind: 'read' })
  if (!g.ok) return

  const vault = getVaultParam(req)
  if (!vault) return res.status(400).json({ success: false, error: 'vault is required' })
  if (!isAddressLike(vault)) return res.status(400).json({ success: false, error: 'Invalid vault address' })

  try {
    const { createPublicClient, http, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getReadRpcUrl(), { timeout: 20_000 }),
    })

    const stratsTuple = (await client.readContract({
      address: vault as `0x${string}`,
      abi: VAULT_STRATS_ABI,
      functionName: 'getStrategies',
      args: [],
    })) as any

    const strategies = (stratsTuple?.[0] ?? []) as `0x${string}`[]
    const weights = (stratsTuple?.[1] ?? []) as bigint[]

    const out: StrategyInfo[] = []

    for (let i = 0; i < strategies.length; i++) {
      const s = strategies[i]
      const weight = (weights[i] ?? 0n).toString()
      if (!s || !isAddress(s)) continue

      const calls = await client.multicall({
        allowFailure: true,
        contracts: [
          { address: s, abi: STRATEGY_BASE_ABI, functionName: 'isActive' },
          { address: s, abi: STRATEGY_BASE_ABI, functionName: 'owner' },
          { address: s, abi: STRATEGY_BASE_ABI, functionName: 'asset' },
          // Ajna probes
          { address: s, abi: AJNA_ABI, functionName: 'ajnaPool' },
          { address: s, abi: AJNA_ABI, functionName: 'ajnaFactory' },
          { address: s, abi: AJNA_ABI, functionName: 'collateralToken' },
          { address: s, abi: AJNA_ABI, functionName: 'bucketIndex' },
          { address: s, abi: AJNA_ABI, functionName: 'idleBufferBps' },
          // Charm probes
          { address: s, abi: CHARM_ABI, functionName: 'charmVault' },
          { address: s, abi: CHARM_ABI, functionName: 'swapPool' },
          { address: s, abi: CHARM_ABI, functionName: 'swapPoolFee' },
          { address: s, abi: CHARM_ABI, functionName: 'swapSlippageBps' },
          { address: s, abi: CHARM_ABI, functionName: 'depositSlippageBps' },
          { address: s, abi: CHARM_ABI, functionName: 'maxSwapPercent' },
          { address: s, abi: CHARM_ABI, functionName: 'useZRouter' },
          { address: s, abi: CHARM_ABI, functionName: 'autoFeeTier' },
        ],
      })

      const pick = <T,>(idx: number): T | null => (calls[idx]?.status === 'success' ? (calls[idx] as any).result : null)

      const isActive = pick<boolean>(0)
      const owner = pick<`0x${string}`>(1)
      const asset = pick<`0x${string}`>(2)

      const ajnaPool = pick<`0x${string}`>(3)
      const charmVault = pick<`0x${string}`>(8)

      const kind: StrategyInfo['kind'] = isAddressLike(String(ajnaPool ?? '')) ? 'ajna' : isAddressLike(String(charmVault ?? '')) ? 'charm' : 'unknown'

      const info: StrategyInfo = {
        address: s,
        weight,
        isActive: typeof isActive === 'boolean' ? isActive : null,
        owner: owner && isAddressLike(owner) ? (owner as any) : null,
        asset: asset && isAddressLike(asset) ? (asset as any) : null,
        kind,
      }

      if (kind === 'ajna') {
        info.ajna = {
          pool: ajnaPool && isAddressLike(ajnaPool) ? (ajnaPool as any) : null,
          factory: (() => {
            const v = pick<`0x${string}`>(4)
            return v && isAddressLike(v) ? (v as any) : null
          })(),
          collateralToken: (() => {
            const v = pick<`0x${string}`>(5)
            return v && isAddressLike(v) ? (v as any) : null
          })(),
          bucketIndex: (() => {
            const v = pick<bigint>(6)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          idleBufferBps: (() => {
            const v = pick<bigint>(7)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
        }
      }

      if (kind === 'charm') {
        info.charm = {
          charmVault: charmVault && isAddressLike(charmVault) ? (charmVault as any) : null,
          swapPool: (() => {
            const v = pick<`0x${string}`>(9)
            return v && isAddressLike(v) ? (v as any) : null
          })(),
          swapPoolFee: (() => {
            const v = pick<number>(10)
            return v === null || v === undefined ? null : String(v)
          })(),
          swapSlippageBps: (() => {
            const v = pick<bigint>(11)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          depositSlippageBps: (() => {
            const v = pick<bigint>(12)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          maxSwapPercent: (() => {
            const v = pick<bigint>(13)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          useZRouter: (() => {
            const v = pick<boolean>(14)
            return typeof v === 'boolean' ? v : null
          })(),
          autoFeeTier: (() => {
            const v = pick<boolean>(15)
            return typeof v === 'boolean' ? v : null
          })(),
        }
      }

      out.push(info)
    }

    setCache(res, 120)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        vault: vault.toLowerCase(),
        generatedAt: new Date().toISOString(),
        strategies: out,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to load strategies' })
  }
}

