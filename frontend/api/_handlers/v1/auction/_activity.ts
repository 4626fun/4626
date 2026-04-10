import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


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

function getReadRpcUrl(): string {
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://mainnet.base.org'
}

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base.meowrpc.com'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStrategyParam(req: VercelRequest): string {
  const v =
    (typeof req.query?.ccaStrategy === 'string' ? req.query.ccaStrategy : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  return v
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = value ? Number(value) : NaN
  if (!Number.isFinite(n)) return def
  const i = Math.floor(n)
  return Math.max(min, Math.min(max, i))
}

function formatDisplayAmount(
  raw: string,
  decimals: number | null,
  symbol: string | null,
  formatUnitsFn: (value: bigint, decimals: number) => string,
): string {
  if (!raw) return symbol ? `0 ${symbol}` : '0'
  const value = Number(formatUnitsFn(BigInt(raw), decimals ?? 18))
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return symbol ? `${formatted} ${symbol}` : formatted
}

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

const BID_SUBMITTED_EVENT =
  'event BidSubmitted(uint256 indexed id,address indexed owner,uint256 price,uint256 amount)'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/auction/activity', kind: 'logs' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-auction-activity', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.auctionRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const ccaStrategy = getStrategyParam(req)
  if (!ccaStrategy) return res.status(400).json({ success: false, error: 'ccaStrategy is required' })
  if (!isAddressLike(ccaStrategy)) return res.status(400).json({ success: false, error: 'Invalid ccaStrategy address' })

  const limit = clampInt(typeof req.query?.limit === 'string' ? req.query.limit : null, 3, 1, 25)
  const MAX_LOOKBACK_BLOCKS = 200_000n

  try {
    const { createPublicClient, formatUnits, http, isAddress, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')

    const readClient = createPublicClient({
      chain: base,
      transport: http(getReadRpcUrl(), { timeout: 20_000 }),
    })
    const logsClient = createPublicClient({
      chain: base,
      transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
    })

    const [status, currency, auctionToken] = await Promise.all([
      readClient.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'getAuctionStatus' }),
      readClient.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'currency' }).catch(() => null),
      readClient.readContract({ address: ccaStrategy as any, abi: CCA_LAUNCH_STRATEGY_ABI, functionName: 'auctionToken' }).catch(() => null),
    ])

    const auction = String((status as any)?.[0] ?? '')
    const isActive = Boolean((status as any)?.[1] ?? false)
    const isGraduated = Boolean((status as any)?.[2] ?? false)
    const currencyRaised = BigInt((status as any)?.[4] ?? 0n).toString()

    const tokenAddr = typeof auctionToken === 'string' && isAddress(auctionToken) ? (auctionToken as `0x${string}`) : null
    const currencyAddr = typeof currency === 'string' && isAddressLike(currency) ? (currency as `0x${string}`) : null

    const [auctionTokenDecimals, auctionTokenSymbolRaw, currencyDecimals] = await Promise.all([
      tokenAddr
        ? readClient.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
      tokenAddr
        ? readClient.readContract({ address: tokenAddr, abi: ERC20_META_ABI as any, functionName: 'symbol' }).catch(() => null)
        : null,
      currencyAddr
        ? readClient.readContract({ address: currencyAddr, abi: ERC20_META_ABI as any, functionName: 'decimals' }).catch(() => null)
        : null,
    ])

    const auctionTokenSymbol =
      auctionTokenDisplaySymbol(typeof auctionTokenSymbolRaw === 'string' ? auctionTokenSymbolRaw : null) ??
      (typeof auctionTokenSymbolRaw === 'string' ? auctionTokenSymbolRaw : null)

    const hasLiveAuction = isActive && isAddressLike(auction)
    let activity: Array<{
      kind: 'bid'
      transactionHash: string
      blockNumber: string
      logIndex: number
      id: string
      owner: string
      priceQ96: string
      amount: string
      amountDisplay: string
    }> = []

    if (hasLiveAuction) {
      const latest = await logsClient.getBlockNumber()
      const toBlock = latest
      const fromBlock = toBlock > MAX_LOOKBACK_BLOCKS ? toBlock - MAX_LOOKBACK_BLOCKS : 0n
      const event = parseAbiItem(BID_SUBMITTED_EVENT)
      const logs = await logsClient.getLogs({
        address: auction as any,
        event: event as any,
        fromBlock,
        toBlock,
      })

      activity = logs
        .slice(-limit)
        .reverse()
        .map((l: any) => {
          const amount = (l.args?.amount ?? 0n).toString()
          return {
            kind: 'bid' as const,
            transactionHash: String(l.transactionHash ?? ''),
            blockNumber: (l.blockNumber ?? 0n).toString(),
            logIndex: typeof l.logIndex === 'number' ? l.logIndex : Number(l.logIndex ?? 0),
            id: (l.args?.id ?? 0n).toString(),
            owner: String(l.args?.owner ?? '').toLowerCase(),
            priceQ96: (l.args?.price ?? 0n).toString(),
            amount,
            amountDisplay: formatDisplayAmount(
              amount,
              typeof auctionTokenDecimals === 'number' ? auctionTokenDecimals : auctionTokenDecimals === null ? null : Number(auctionTokenDecimals),
              auctionTokenSymbol,
              formatUnits,
            ),
          }
        })
    }

    setCache(res, 20)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        ccaStrategy: ccaStrategy.toLowerCase(),
        auction: hasLiveAuction ? auction.toLowerCase() : null,
        isActive,
        isGraduated,
        currency: currencyAddr ? currencyAddr.toLowerCase() : null,
        currencyDecimals: typeof currencyDecimals === 'number' ? currencyDecimals : currencyDecimals === null ? null : Number(currencyDecimals),
        currencyRaised,
        auctionToken: tokenAddr ? tokenAddr.toLowerCase() : null,
        auctionTokenSymbol: typeof auctionTokenSymbol === 'string' ? auctionTokenSymbol : null,
        auctionTokenDecimals: typeof auctionTokenDecimals === 'number'
          ? auctionTokenDecimals
          : auctionTokenDecimals === null
            ? null
            : Number(auctionTokenDecimals),
        limit,
        activity,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read auction activity' })
  }
}
