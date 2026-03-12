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

function isBytes32Like(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
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

const ERC4626_STRATEGY_ADAPTER_ABI = [
  { type: 'function', name: 'ERC4626_VAULT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'idleBufferBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const AJNA_INNER_VAULT_ABI = [
  { type: 'function', name: 'AJNA_POOL', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'AUTH', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_POOL_ABI = [
  { type: 'function', name: 'collateralAddress', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_AUTH_ABI = [
  { type: 'function', name: 'admin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bufferRatio', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'minBucketIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const

const CHARM_ABI = [
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'swapPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'swapPoolFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { type: 'function', name: 'swapSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'depositSlippageBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maxSwapPercent', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'autoFeeTier', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const

const SOLANA_STRATEGY_ABI = [
  { type: 'function', name: 'bridgeAdapter', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'solanaDestination', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
] as const

type StrategyInfo = {
  address: `0x${string}`
  weight: string
  isActive: boolean | null
  owner: `0x${string}` | null
  asset: `0x${string}` | null
  kind: 'ajna' | 'charm' | 'solana' | 'unknown'
  ajna?: {
    pool: `0x${string}` | null
    collateralToken: `0x${string}` | null
    idleBufferBps: string | null
    innerVault: `0x${string}` | null
    auth: `0x${string}` | null
    authAdmin: `0x${string}` | null
    bufferRatioBps: string | null
    minBucketIndex: string | null
    paused: boolean | null
  }
  charm?: {
    charmVault: `0x${string}` | null
    swapPool: `0x${string}` | null
    swapPoolFee: string | null
    swapSlippageBps: string | null
    depositSlippageBps: string | null
    maxSwapPercent: string | null
    autoFeeTier: boolean | null
  }
  solana?: {
    bridgeAdapter: `0x${string}` | null
    destination: `0x${string}` | null
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
          // Charm probes
          { address: s, abi: CHARM_ABI, functionName: 'charmVault' },
          { address: s, abi: CHARM_ABI, functionName: 'swapPool' },
          { address: s, abi: CHARM_ABI, functionName: 'swapPoolFee' },
          { address: s, abi: CHARM_ABI, functionName: 'swapSlippageBps' },
          { address: s, abi: CHARM_ABI, functionName: 'depositSlippageBps' },
          { address: s, abi: CHARM_ABI, functionName: 'maxSwapPercent' },
          { address: s, abi: CHARM_ABI, functionName: 'autoFeeTier' },
          // Solana bridge probes
          { address: s, abi: SOLANA_STRATEGY_ABI, functionName: 'bridgeAdapter' },
          { address: s, abi: SOLANA_STRATEGY_ABI, functionName: 'solanaDestination' },
        ],
      })

      const pick = <T,>(idx: number): T | null => (calls[idx]?.status === 'success' ? (calls[idx] as any).result : null)

      const isActive = pick<boolean>(0)
      const owner = pick<`0x${string}`>(1)
      const asset = pick<`0x${string}`>(2)

      const charmVault = pick<`0x${string}`>(3)
      const bridgeAdapter = pick<`0x${string}`>(10)
      const solanaDestination = pick<`0x${string}`>(11)
      const hasSolanaConfig =
        isAddressLike(String(bridgeAdapter ?? '')) || (typeof solanaDestination === 'string' && isBytes32Like(solanaDestination) && !/^0x0{64}$/i.test(solanaDestination))

      let ajnaPool: `0x${string}` | null = null
      let ajnaCollateralToken: `0x${string}` | null = null
      let ajnaIdleBufferBps: string | null = null
      let ajnaInnerVault: `0x${string}` | null = null
      let ajnaAuth: `0x${string}` | null = null
      let ajnaAuthAdmin: `0x${string}` | null = null
      let ajnaBufferRatioBps: string | null = null
      let ajnaMinBucketIndex: string | null = null
      let ajnaPaused: boolean | null = null

      const adapterCalls = await client.multicall({
        allowFailure: true,
        contracts: [
          { address: s, abi: ERC4626_STRATEGY_ADAPTER_ABI, functionName: 'ERC4626_VAULT' },
          { address: s, abi: ERC4626_STRATEGY_ADAPTER_ABI, functionName: 'idleBufferBps' },
        ],
      })
      const adapterVault = adapterCalls[0]?.status === 'success' ? ((adapterCalls[0] as any).result as `0x${string}`) : null
      const adapterIdleBuffer = adapterCalls[1]?.status === 'success' ? ((adapterCalls[1] as any).result as bigint) : null

      if (adapterVault && isAddressLike(adapterVault)) {
        ajnaInnerVault = adapterVault
        ajnaIdleBufferBps =
          adapterIdleBuffer === null || adapterIdleBuffer === undefined ? null : BigInt(adapterIdleBuffer as any).toString()

        const innerCalls = await client.multicall({
          allowFailure: true,
          contracts: [
            { address: adapterVault, abi: AJNA_INNER_VAULT_ABI, functionName: 'AJNA_POOL' },
            { address: adapterVault, abi: AJNA_INNER_VAULT_ABI, functionName: 'AUTH' },
          ],
        })
        const nestedAjnaPool = innerCalls[0]?.status === 'success' ? ((innerCalls[0] as any).result as `0x${string}`) : null
        const nestedAjnaAuth = innerCalls[1]?.status === 'success' ? ((innerCalls[1] as any).result as `0x${string}`) : null

        if (nestedAjnaPool && isAddressLike(nestedAjnaPool)) {
          ajnaPool = nestedAjnaPool
          const poolCalls = await client.multicall({
            allowFailure: true,
            contracts: [{ address: nestedAjnaPool, abi: AJNA_POOL_ABI, functionName: 'collateralAddress' }],
          })
          const collateralAddress =
            poolCalls[0]?.status === 'success' ? ((poolCalls[0] as any).result as `0x${string}`) : null
          ajnaCollateralToken =
            collateralAddress && isAddressLike(collateralAddress) ? (collateralAddress as `0x${string}`) : null
        }

        ajnaAuth = nestedAjnaAuth && isAddressLike(nestedAjnaAuth) ? nestedAjnaAuth : null

        if (ajnaAuth) {
          const authCalls = await client.multicall({
            allowFailure: true,
            contracts: [
              { address: ajnaAuth, abi: AJNA_AUTH_ABI, functionName: 'admin' },
              { address: ajnaAuth, abi: AJNA_AUTH_ABI, functionName: 'bufferRatio' },
              { address: ajnaAuth, abi: AJNA_AUTH_ABI, functionName: 'minBucketIndex' },
              { address: ajnaAuth, abi: AJNA_AUTH_ABI, functionName: 'paused' },
            ],
          })
          const authAdmin = authCalls[0]?.status === 'success' ? ((authCalls[0] as any).result as `0x${string}`) : null
          const bufferRatio = authCalls[1]?.status === 'success' ? ((authCalls[1] as any).result as bigint) : null
          const minBucket = authCalls[2]?.status === 'success' ? ((authCalls[2] as any).result as bigint) : null
          const paused = authCalls[3]?.status === 'success' ? ((authCalls[3] as any).result as boolean) : null

          ajnaAuthAdmin = authAdmin && isAddressLike(authAdmin) ? authAdmin : null
          ajnaBufferRatioBps = bufferRatio === null || bufferRatio === undefined ? null : BigInt(bufferRatio as any).toString()
          ajnaMinBucketIndex = minBucket === null || minBucket === undefined ? null : BigInt(minBucket as any).toString()
          ajnaPaused = typeof paused === 'boolean' ? paused : null
        }
      }

      const kind: StrategyInfo['kind'] = isAddressLike(String(ajnaPool ?? ''))
        ? 'ajna'
        : isAddressLike(String(charmVault ?? ''))
          ? 'charm'
          : hasSolanaConfig
            ? 'solana'
            : 'unknown'

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
          collateralToken: ajnaCollateralToken,
          idleBufferBps: ajnaIdleBufferBps,
          innerVault: ajnaInnerVault,
          auth: ajnaAuth,
          authAdmin: ajnaAuthAdmin,
          bufferRatioBps: ajnaBufferRatioBps,
          minBucketIndex: ajnaMinBucketIndex,
          paused: ajnaPaused,
        }
      }

      if (kind === 'charm') {
        info.charm = {
          charmVault: charmVault && isAddressLike(charmVault) ? (charmVault as any) : null,
          swapPool: (() => {
            const v = pick<`0x${string}`>(4)
            return v && isAddressLike(v) ? (v as any) : null
          })(),
          swapPoolFee: (() => {
            const v = pick<number>(5)
            return v === null || v === undefined ? null : String(v)
          })(),
          swapSlippageBps: (() => {
            const v = pick<bigint>(6)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          depositSlippageBps: (() => {
            const v = pick<bigint>(7)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          maxSwapPercent: (() => {
            const v = pick<bigint>(8)
            return v === null || v === undefined ? null : BigInt(v as any).toString()
          })(),
          autoFeeTier: (() => {
            const v = pick<boolean>(9)
            return typeof v === 'boolean' ? v : null
          })(),
        }
      }

      if (kind === 'solana') {
        info.solana = {
          bridgeAdapter: bridgeAdapter && isAddressLike(bridgeAdapter) ? (bridgeAdapter as any) : null,
          destination: solanaDestination && isBytes32Like(solanaDestination) ? (solanaDestination as any) : null,
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

