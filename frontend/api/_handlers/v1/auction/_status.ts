import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'
import { auctionTokenDisplaySymbol } from '../../../../server/_lib/auctionTokenDisplaySymbol.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function getReadRpcUrls(): string[] {
  const urls = [
    (process.env.BASE_READ_RPC_URL ?? '').trim(),
    (process.env.BASE_RPC_URL ?? '').trim(),
    (process.env.BASE_RPC_URL_FALLBACK ?? '').trim(),
    'https://mainnet.base.org',
  ].filter((entry): entry is string => Boolean(entry))
  return Array.from(new Set(urls))
}

function isRpcRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('too many requests') ||
    lower.includes('status: 429') ||
    lower.includes('http request failed') ||
    lower.includes('rate limit')
  )
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function normalizeHost(raw: string): string | null {
  const host = raw.trim().toLowerCase()
  if (!host) return null
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) return null
  return host
}

function inferProtocol(host: string): 'http' | 'https' {
  const normalized = host.toLowerCase()
  if (
    normalized.startsWith('localhost') ||
    normalized.startsWith('127.0.0.1') ||
    normalized.startsWith('0.0.0.0')
  ) {
    return 'http'
  }
  return 'https'
}

function getCanonicalApiOrigin(): string | null {
  const configuredApiHost = normalizeHost(String(process.env.API_HOST ?? ''))
  if (!configuredApiHost) return null
  return `${inferProtocol(configuredApiHost)}://${configuredApiHost}`
}

function getStrategyParam(req: VercelRequest): string {
  const v =
    (typeof req.query?.ccaStrategy === 'string' ? req.query.ccaStrategy : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  return v
}

// Minimal CCALaunchStrategy reads (mirrors the UI ABI)
const CCA_LAUNCH_STRATEGY_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  { name: 'currency', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'auctionToken', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  {
    name: 'getLifecycleStatus',
    type: 'function',
    inputs: [],
    outputs: [
      {
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
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getBackingTelemetry',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'vault', type: 'address' },
      { name: 'launchTotalAssets', type: 'uint256' },
      { name: 'launchTotalSupply', type: 'uint256' },
      { name: 'currentTotalAssets', type: 'uint256' },
      { name: 'currentTotalSupply', type: 'uint256' },
      { name: 'assetsDelta', type: 'int256' },
      { name: 'supplyDelta', type: 'int256' },
    ],
    stateMutability: 'view',
  },
] as const

const ERC20_META_ABI = [
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/auction/status', kind: 'read' })
  if (!g.ok) return

  const ccaStrategy = getStrategyParam(req)
  if (!ccaStrategy) return res.status(400).json({ success: false, error: 'ccaStrategy is required' })
  if (!isAddressLike(ccaStrategy)) return res.status(400).json({ success: false, error: 'Invalid ccaStrategy address' })

  try {
    const { createPublicClient, http, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const rpcUrls = getReadRpcUrls()
    let status: unknown = null
    let currency: unknown = null
    let auctionToken: unknown = null
    let lifecycle: unknown = null
    let backingTelemetry: unknown = null
    let resolvedRpcUrl: string | null = null
    let lastError: unknown = null

    for (let index = 0; index < rpcUrls.length; index += 1) {
      const rpcUrl = rpcUrls[index]
      try {
        const client = createPublicClient({
          chain: base,
          transport: http(rpcUrl, { timeout: 20_000 }),
        })
        const response = await Promise.all([
          client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'getAuctionStatus' }),
          client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'currency' }).catch(() => null),
          client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'auctionToken' }).catch(() => null),
          client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'getLifecycleStatus' }).catch(() => null),
          client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'getBackingTelemetry' }).catch(() => null),
        ])
        status = response[0]
        currency = response[1]
        auctionToken = response[2]
        lifecycle = response[3]
        backingTelemetry = response[4]
        resolvedRpcUrl = rpcUrl
        lastError = null
        break
      } catch (error) {
        lastError = error
        const hasNext = index < rpcUrls.length - 1
        if (!hasNext || !isRpcRateLimitError(error)) {
          throw error
        }
      }
    }

    if (!status && lastError) throw lastError

    const auction = String((status as any)?.[0] ?? '')
    const isActive = Boolean((status as any)?.[1] ?? false)
    const isGraduated = Boolean((status as any)?.[2] ?? false)
    const clearingPriceQ96 = BigInt((status as any)?.[3] ?? 0n).toString()
    const currencyRaised = BigInt((status as any)?.[4] ?? 0n).toString()
    const lifecyclePhase = Number((lifecycle as any)?.phase ?? (lifecycle as any)?.[0] ?? 0)
    const lifecycleAuctionWindowOpen = Boolean((lifecycle as any)?.auctionWindowOpen ?? (lifecycle as any)?.[3] ?? false)
    const lifecycleClaimOpen = Boolean((lifecycle as any)?.claimOpen ?? (lifecycle as any)?.[4] ?? false)
    const lifecycleCurrencySwept = Boolean((lifecycle as any)?.currencySwept ?? (lifecycle as any)?.[5] ?? false)
    const lifecycleUnsoldSwept = Boolean((lifecycle as any)?.unsoldSwept ?? (lifecycle as any)?.[6] ?? false)
    const lifecycleMigrated = Boolean((lifecycle as any)?.migrated ?? (lifecycle as any)?.[7] ?? false)
    const lifecycleFailedFinalized = Boolean((lifecycle as any)?.failedFinalized ?? (lifecycle as any)?.[8] ?? false)
    const lifecycleStartBlock = BigInt((lifecycle as any)?.startBlock ?? (lifecycle as any)?.[9] ?? 0n).toString()
    const lifecycleEndBlock = BigInt((lifecycle as any)?.endBlock ?? (lifecycle as any)?.[10] ?? 0n).toString()
    const lifecycleClaimBlock = BigInt((lifecycle as any)?.claimBlock ?? (lifecycle as any)?.[11] ?? 0n).toString()
    const lifecycleMigrationBlock = BigInt((lifecycle as any)?.migrationBlock ?? (lifecycle as any)?.[12] ?? 0n).toString()
    const lifecycleSweepBlock = BigInt((lifecycle as any)?.sweepBlock ?? (lifecycle as any)?.[13] ?? 0n).toString()
    const lifecycleLpReserveAmount = BigInt((lifecycle as any)?.lpReserveAmount ?? (lifecycle as any)?.[14] ?? 0n).toString()

    const backingVault = typeof (backingTelemetry as any)?.vault === 'string'
      ? ((backingTelemetry as any).vault as string)
      : typeof (backingTelemetry as any)?.[0] === 'string'
        ? ((backingTelemetry as any)[0] as string)
        : null
    const launchTotalAssets = BigInt((backingTelemetry as any)?.launchTotalAssets ?? (backingTelemetry as any)?.[1] ?? 0n).toString()
    const launchTotalSupply = BigInt((backingTelemetry as any)?.launchTotalSupply ?? (backingTelemetry as any)?.[2] ?? 0n).toString()
    const currentTotalAssets = BigInt((backingTelemetry as any)?.currentTotalAssets ?? (backingTelemetry as any)?.[3] ?? 0n).toString()
    const currentTotalSupply = BigInt((backingTelemetry as any)?.currentTotalSupply ?? (backingTelemetry as any)?.[4] ?? 0n).toString()
    const assetsDelta = BigInt((backingTelemetry as any)?.assetsDelta ?? (backingTelemetry as any)?.[5] ?? 0n).toString()
    const supplyDelta = BigInt((backingTelemetry as any)?.supplyDelta ?? (backingTelemetry as any)?.[6] ?? 0n).toString()

    const tokenAddr = typeof auctionToken === 'string' && isAddress(auctionToken) ? (auctionToken as `0x${string}`) : null
    const currencyAddr = typeof currency === 'string' && isAddressLike(currency) ? (currency as `0x${string}`) : null
    const tokenAddressLower = tokenAddr ? tokenAddr.toLowerCase() : null
    const tokenImagePath = tokenAddressLower ? `/api/v1/token/${tokenAddressLower}/image?chain=8453&format=png` : null
    const tokenImageCanonicalPath = tokenAddressLower ? `/v1/token/${tokenAddressLower}/image?chain=8453&format=png` : null
    const canonicalApiOrigin = getCanonicalApiOrigin()
    const tokenImageUrl = tokenImageCanonicalPath && canonicalApiOrigin ? `${canonicalApiOrigin}${tokenImageCanonicalPath}` : tokenImagePath
    const metadataClient = createPublicClient({
      chain: base,
      transport: http(resolvedRpcUrl ?? rpcUrls[0], { timeout: 20_000 }),
    })
    const [tokenDecimals, tokenSymbolRaw, currencyDecimals] = await Promise.all([
      tokenAddr
        ? metadataClient.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
      tokenAddr
        ? metadataClient.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'symbol' }).catch(() => null)
        : null,
      currencyAddr
        ? metadataClient.readContract({ address: currencyAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
    ])

    const tokenSymbolOnChain = typeof tokenSymbolRaw === 'string' ? tokenSymbolRaw : null
    const tokenSymbol = auctionTokenDisplaySymbol(tokenSymbolOnChain) ?? tokenSymbolOnChain

    const auctionAddrNorm = isAddressLike(auction) ? auction.toLowerCase() : null
    const hasRealAuction = Boolean(auctionAddrNorm && auctionAddrNorm !== ZERO_ADDRESS)
    /** LifecyclePhase.AuctionScheduled — auction contract exists but window not open yet */
    const auctionScheduledPhase = 7
    /** True when the strategy should not be promoted on swap/featured surfaces (idle, failed, between phases, etc.) */
    const auctionLifecycleDegraded = !(
      isGraduated ||
      (hasRealAuction && (isActive || lifecycleAuctionWindowOpen || lifecyclePhase === auctionScheduledPhase))
    )

    setCache(res, 20)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        ccaStrategy: ccaStrategy.toLowerCase(),
        auction: auctionAddrNorm && auctionAddrNorm !== ZERO_ADDRESS ? auctionAddrNorm : null,
        isActive,
        isGraduated,
        clearingPriceQ96,
        currencyRaised,
        lifecyclePhase,
        lifecycleAuctionWindowOpen,
        lifecycleClaimOpen,
        lifecycleCurrencySwept,
        lifecycleUnsoldSwept,
        lifecycleMigrated,
        lifecycleFailedFinalized,
        lifecycleStartBlock,
        lifecycleEndBlock,
        lifecycleClaimBlock,
        lifecycleMigrationBlock,
        lifecycleSweepBlock,
        lifecycleLpReserveAmount,
        backingVault: backingVault && isAddressLike(backingVault) ? backingVault.toLowerCase() : null,
        launchTotalAssets,
        launchTotalSupply,
        currentTotalAssets,
        currentTotalSupply,
        assetsDelta,
        supplyDelta,
        currency: currencyAddr ? currencyAddr.toLowerCase() : null,
        currencyDecimals: typeof currencyDecimals === 'number' ? currencyDecimals : currencyDecimals === null ? null : Number(currencyDecimals),
        auctionToken: tokenAddressLower,
        auctionTokenSymbol: typeof tokenSymbol === 'string' ? tokenSymbol : null,
        auctionLifecycleDegraded,
        auctionTokenDecimals: typeof tokenDecimals === 'number' ? tokenDecimals : tokenDecimals === null ? null : Number(tokenDecimals),
        auctionTokenImagePath: tokenImagePath,
        auctionTokenImageUrl: tokenImageUrl,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read auction status' })
  }
}

