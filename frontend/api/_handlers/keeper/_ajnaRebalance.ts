import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, createWalletClient, http, type Abi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

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
} from '../../../packages/server-core/src/index.js'
import {
  getAjnaVaultRegistryEntry,
  recordAjnaVaultManagerRun,
  type AjnaVaultRegistryRow,
} from '../../../server/_lib/ajnaVaultManager/registry.js'

const AJNA_INNER_VAULT_REBALANCE_ABI = [
  { type: 'function', name: 'bufferAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'moveFromBuffer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'toIndex', type: 'uint256' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [
      { name: 'movedAssets', type: 'uint256' },
      { name: 'mintedBucketLp', type: 'uint256' },
    ],
  },
] as const

const AJNA_AUTH_CONFIG_ABI = [
  { type: 'function', name: 'bufferRatio', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'minBucketIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

type RebalanceRequestBody = {
  chainId?: number | string
  creatorToken?: string
  strategyAdapter?: string
}

type RebalanceResponse = {
  mode: 'dry_run' | 'live' | 'skipped'
  action: 'move_from_buffer' | 'none'
  reason?: string
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  innerAjnaVault: Address
  auth: Address
  plan: {
    minBucketIndex: number
    bufferRatioBps: number
    bufferAssets: string
    totalAssets: string
    targetBufferAssets: string
    moveAssets: string
  }
  txHash?: string
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as Address) : null
}

function parseChainId(value: unknown): number {
  const parsed = Number(value ?? base.id)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : base.id
}

function resolveChainContext(chainId: number): { chain: typeof base; rpcUrl: string } | null {
  if (chainId !== base.id) return null
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  return { chain: base, rpcUrl }
}

async function loadRebalanceConfig(params: {
  publicClient: any
  row: AjnaVaultRegistryRow
}): Promise<{ bufferRatioBps: number; minBucketIndex: number }> {
  let bufferRatioBps = params.row.bufferRatioBps
  let minBucketIndex = params.row.minBucketIndex
  if (typeof minBucketIndex === 'number' && Number.isFinite(minBucketIndex) && minBucketIndex <= 0) {
    // `0` is an unset/invalid sentinel for Ajna bucket index.
    minBucketIndex = null
  }

  if (bufferRatioBps === null || minBucketIndex === null) {
    const [bufferRatioRaw, minBucketRaw] = await Promise.all([
      params.publicClient
        .readContract({
          address: params.row.ajnaAuth,
          abi: AJNA_AUTH_CONFIG_ABI,
          functionName: 'bufferRatio',
        })
        .catch(() => null),
      params.publicClient
        .readContract({
          address: params.row.ajnaAuth,
          abi: AJNA_AUTH_CONFIG_ABI,
          functionName: 'minBucketIndex',
        })
        .catch(() => null),
    ])
    if (bufferRatioBps === null && bufferRatioRaw != null && Number.isFinite(Number(bufferRatioRaw))) {
      bufferRatioBps = Number(bufferRatioRaw)
    }
    if (minBucketIndex === null && minBucketRaw != null && Number.isFinite(Number(minBucketRaw))) {
      minBucketIndex = Number(minBucketRaw)
    }
  }

  return {
    bufferRatioBps: Math.max(0, Math.min(10_000, Math.trunc(bufferRatioBps ?? 0))),
    minBucketIndex: Math.max(0, Math.min(7388, Math.trunc(minBucketIndex ?? 0))),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(rateLimitKey('keeper-ajna-rebalance', getClientIp(req)), RATE_LIMITS.creRuntimeTriggerWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as RebalanceRequestBody | null
  const chainId = parseChainId(body?.chainId)
  const creatorToken = normalizeAddress(body?.creatorToken)
  const strategyAdapter = normalizeAddress(body?.strategyAdapter)
  if (!creatorToken || !strategyAdapter) {
    return res.status(400).json({
      success: false,
      error: 'creatorToken and strategyAdapter are required',
    } satisfies ApiEnvelope<never>)
  }

  const row = await getAjnaVaultRegistryEntry({ chainId, creatorToken, strategyAdapter })
  if (!row) {
    return res.status(404).json({ success: false, error: 'Ajna vault registry entry not found' } satisfies ApiEnvelope<never>)
  }
  if (row.automationStatus === 'paused' || row.automationStatus === 'halted') {
    return res.status(200).json({
      success: true,
      data: {
        mode: 'skipped',
        action: 'none',
        reason: `automation_${row.automationStatus}`,
        chainId,
        creatorToken,
        strategyAdapter,
        innerAjnaVault: row.innerAjnaVault,
        auth: row.ajnaAuth,
        plan: {
          minBucketIndex: row.minBucketIndex ?? 0,
          bufferRatioBps: row.bufferRatioBps ?? 0,
          bufferAssets: '0',
          totalAssets: '0',
          targetBufferAssets: '0',
          moveAssets: '0',
        },
      } satisfies RebalanceResponse,
    } satisfies ApiEnvelope<RebalanceResponse>)
  }

  const chainContext = resolveChainContext(chainId)
  if (!chainContext) {
    return res.status(400).json({
      success: false,
      error: `unsupported_chain:${chainId}`,
    } satisfies ApiEnvelope<never>)
  }

  const { chain, rpcUrl } = chainContext
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
  const { bufferRatioBps, minBucketIndex } = await loadRebalanceConfig({ publicClient, row })
  if (minBucketIndex < 1) {
    await recordAjnaVaultManagerRun({
      chainId,
      creatorToken,
      strategyAdapter,
      error: 'ajna_invalid_min_bucket_index',
      metadataPatch: {
        lastAction: 'none',
        reason: 'invalid_min_bucket_index',
      },
    })
    return res.status(200).json({
      success: true,
      data: {
        mode: 'skipped',
        action: 'none',
        reason: 'invalid_min_bucket_index',
        chainId,
        creatorToken,
        strategyAdapter,
        innerAjnaVault: row.innerAjnaVault,
        auth: row.ajnaAuth,
        plan: {
          minBucketIndex,
          bufferRatioBps,
          bufferAssets: '0',
          totalAssets: '0',
          targetBufferAssets: '0',
          moveAssets: '0',
        },
      } satisfies RebalanceResponse,
    } satisfies ApiEnvelope<RebalanceResponse>)
  }
  const [bufferAssetsRaw, totalAssetsRaw] = await Promise.all([
    publicClient.readContract({
      address: row.innerAjnaVault,
      abi: AJNA_INNER_VAULT_REBALANCE_ABI,
      functionName: 'bufferAssets',
    }),
    publicClient.readContract({
      address: row.innerAjnaVault,
      abi: AJNA_INNER_VAULT_REBALANCE_ABI,
      functionName: 'totalAssets',
    }),
  ])
  const bufferAssets = BigInt(bufferAssetsRaw ?? 0n)
  const totalAssets = BigInt(totalAssetsRaw ?? 0n)
  const targetBufferAssets = (totalAssets * BigInt(bufferRatioBps) + 9_999n) / 10_000n
  const excessBufferAssets = bufferAssets > targetBufferAssets ? bufferAssets - targetBufferAssets : 0n
  const maxAssetsPerMove = row.maxAssetsPerMove ?? excessBufferAssets
  const moveAssets = excessBufferAssets > maxAssetsPerMove ? maxAssetsPerMove : excessBufferAssets

  const responseBase: Omit<RebalanceResponse, 'mode' | 'action' | 'reason' | 'txHash'> = {
    chainId,
    creatorToken,
    strategyAdapter,
    innerAjnaVault: row.innerAjnaVault,
    auth: row.ajnaAuth,
    plan: {
      minBucketIndex,
      bufferRatioBps,
      bufferAssets: bufferAssets.toString(),
      totalAssets: totalAssets.toString(),
      targetBufferAssets: targetBufferAssets.toString(),
      moveAssets: moveAssets.toString(),
    },
  }

  if (moveAssets <= 0n) {
    await recordAjnaVaultManagerRun({
      chainId,
      creatorToken,
      strategyAdapter,
      metadataPatch: {
        lastAction: 'none',
        reason: 'buffer_within_target',
      },
    })
    return res.status(200).json({
      success: true,
      data: {
        ...responseBase,
        mode: row.automationStatus === 'dry_run' ? 'dry_run' : 'live',
        action: 'none',
        reason: 'buffer_within_target',
      } satisfies RebalanceResponse,
    } satisfies ApiEnvelope<RebalanceResponse>)
  }

  const keeperPk = process.env.KEEPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KEEPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }
  const account = privateKeyToAccount(keeperPk as `0x${string}`)

  await publicClient
    .simulateContract({
      address: row.innerAjnaVault,
      abi: AJNA_INNER_VAULT_REBALANCE_ABI as unknown as Abi,
      functionName: 'moveFromBuffer',
      args: [BigInt(minBucketIndex), moveAssets],
      account,
    })
    .catch((error: unknown) => {
      throw new Error(`ajna_move_simulation_failed:${error instanceof Error ? error.message : String(error ?? 'unknown')}`)
    })

  if (row.automationStatus === 'dry_run') {
    await recordAjnaVaultManagerRun({
      chainId,
      creatorToken,
      strategyAdapter,
      metadataPatch: {
        lastAction: 'move_from_buffer',
        dryRun: true,
        moveAssets: moveAssets.toString(),
        minBucketIndex,
      },
    })
    return res.status(200).json({
      success: true,
      data: {
        ...responseBase,
        mode: 'dry_run',
        action: 'move_from_buffer',
      } satisfies RebalanceResponse,
    } satisfies ApiEnvelope<RebalanceResponse>)
  }

  try {
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl, { timeout: 30_000 }) })
    const txHash = await walletClient.writeContract({
      address: row.innerAjnaVault,
      abi: AJNA_INNER_VAULT_REBALANCE_ABI as unknown as Abi,
      functionName: 'moveFromBuffer',
      args: [BigInt(minBucketIndex), moveAssets],
      chain,
      account,
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
    await recordAjnaVaultManagerRun({
      chainId,
      creatorToken,
      strategyAdapter,
      txHash,
      metadataPatch: {
        lastAction: 'move_from_buffer',
        moveAssets: moveAssets.toString(),
        minBucketIndex,
      },
    })
    return res.status(200).json({
      success: true,
      data: {
        ...responseBase,
        mode: 'live',
        action: 'move_from_buffer',
        txHash,
      } satisfies RebalanceResponse,
    } satisfies ApiEnvelope<RebalanceResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'ajna_move_failed')
    await recordAjnaVaultManagerRun({
      chainId,
      creatorToken,
      strategyAdapter,
      error: message,
      metadataPatch: {
        lastAction: 'move_from_buffer',
        moveAssets: moveAssets.toString(),
        minBucketIndex,
      },
    })
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
