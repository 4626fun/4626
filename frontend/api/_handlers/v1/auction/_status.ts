import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
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

    const client = createPublicClient({
      chain: base,
      transport: http(getReadRpcUrl(), { timeout: 20_000 }),
    })

    const [status, currency, auctionToken] = await Promise.all([
      client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'getAuctionStatus' }),
      client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'currency' }).catch(() => null),
      client.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'auctionToken' }).catch(() => null),
    ])

    const auction = String((status as any)?.[0] ?? '')
    const isActive = Boolean((status as any)?.[1] ?? false)
    const isGraduated = Boolean((status as any)?.[2] ?? false)
    const clearingPriceQ96 = BigInt((status as any)?.[3] ?? 0n).toString()
    const currencyRaised = BigInt((status as any)?.[4] ?? 0n).toString()

    const tokenAddr = typeof auctionToken === 'string' && isAddress(auctionToken) ? (auctionToken as `0x${string}`) : null
    const currencyAddr = typeof currency === 'string' && isAddressLike(currency) ? (currency as `0x${string}`) : null
    const [tokenDecimals, tokenSymbol, currencyDecimals] = await Promise.all([
      tokenAddr
        ? client.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
      tokenAddr
        ? client.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'symbol' }).catch(() => null)
        : null,
      currencyAddr
        ? client.readContract({ address: currencyAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
    ])

    setCache(res, 20)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        ccaStrategy: ccaStrategy.toLowerCase(),
        auction: isAddressLike(auction) ? auction.toLowerCase() : null,
        isActive,
        isGraduated,
        clearingPriceQ96,
        currencyRaised,
        currency: currencyAddr ? currencyAddr.toLowerCase() : null,
        currencyDecimals: typeof currencyDecimals === 'number' ? currencyDecimals : currencyDecimals === null ? null : Number(currencyDecimals),
        auctionToken: tokenAddr ? tokenAddr.toLowerCase() : null,
        auctionTokenSymbol: typeof tokenSymbol === 'string' ? tokenSymbol : null,
        auctionTokenDecimals: typeof tokenDecimals === 'number' ? tokenDecimals : tokenDecimals === null ? null : Number(tokenDecimals),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read auction status' })
  }
}

