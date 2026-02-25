import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createPublicClient, erc20Abi, formatUnits, getAddress, http, isAddress, parseUnits, type Address } from 'viem'
import { base } from 'viem/chains'

import { handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '../../../server/_lib/rateLimit.js'
import { readJsonObjectBody } from '../../../server/uniswap/trading.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_ZQUOTER_BASE = '0x69c644eBE4A792f601eDddF593c32DDEc35eC5D7' as const
const MAX_AMOUNT_DECIMALS = 18
const RPC_TIMEOUT_MS = 12_000
const QUOTE_MAX_AGE_MS = 30_000
const ZQUOTER_CHAIN_ID = base.id
const ZQUOTER_CHAIN_NAME = 'Base'

const ZQUOTER_ABI = [
  {
    type: 'function',
    name: 'getQuotes',
    stateMutability: 'view',
    inputs: [
      { name: 'exactOut', type: 'bool' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'swapAmount', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'best',
        type: 'tuple',
        components: [
          { name: 'source', type: 'uint8' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOut', type: 'uint256' },
        ],
      },
      {
        name: 'quotes',
        type: 'tuple[]',
        components: [
          { name: 'source', type: 'uint8' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOut', type: 'uint256' },
        ],
      },
    ],
  },
] as const

type ZQuoteTuple = {
  source: number
  feeBps: bigint
  amountIn: bigint
  amountOut: bigint
}

function getReadRpcUrl(): string {
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://mainnet.base.org'
}

function resolveZquoterAddress(): Address {
  const raw = (process.env.ZQUOTER_BASE_ADDRESS ?? DEFAULT_ZQUOTER_BASE).trim()
  if (!isAddress(raw)) {
    return getAddress(DEFAULT_ZQUOTER_BASE)
  }
  return getAddress(raw)
}

function parseAmountInUnits(raw: unknown): string | null {
  const safe = sanitizeAmount(String(raw ?? ''), MAX_AMOUNT_DECIMALS).trim()
  if (!safe) return null
  if (safe.endsWith('.')) return safe.slice(0, -1) || null
  const n = Number(safe)
  if (!Number.isFinite(n) || n <= 0) return null
  return safe
}

function sanitizeAmount(value: string, maxFractionDigits = 18): string {
  const raw = String(value ?? '')
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const firstDotIdx = normalized.indexOf('.')
  const compact =
    firstDotIdx >= 0
      ? `${normalized.slice(0, firstDotIdx + 1)}${normalized
          .slice(firstDotIdx + 1)
          .replace(/\./g, '')}`
      : normalized

  if (compact.startsWith('.')) return `0.${compact.slice(1, 1 + maxFractionDigits)}`
  if (!compact.includes('.')) return compact

  const [whole, fraction] = compact.split('.', 2)
  const safeWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  const safeFraction = fraction.slice(0, Math.max(0, maxFractionDigits))
  return `${safeWhole}.${safeFraction}`
}

function sourceLabel(source: number): string {
  const labels = [
    'UNI_V2',
    'SUSHI',
    'ZAMM',
    'UNI_V3',
    'UNI_V4',
    'CURVE',
    'LIDO',
    'WETH_WRAP',
    'V4_HOOKED',
  ]
  return labels[source] ?? `UNKNOWN_${source}`
}

function toQuoteRow(tuple: ZQuoteTuple, tokenInDecimals: number, tokenOutDecimals: number) {
  return {
    source: Number(tuple.source),
    sourceLabel: sourceLabel(Number(tuple.source)),
    feeBps: tuple.feeBps.toString(),
    amountIn: tuple.amountIn.toString(),
    amountOut: tuple.amountOut.toString(),
    amountInUnits: formatUnits(tuple.amountIn, tokenInDecimals),
    amountOutUnits: formatUnits(tuple.amountOut, tokenOutDecimals),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('uniswap-zquote', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const body = (await readJsonObjectBody(req)) ?? {}
  const required = ['tokenIn', 'tokenOut', 'amountInUnits'] as const
  for (const key of required) {
    if (!(key in body)) return res.status(400).json({ success: false, error: `Missing required field: ${key}` })
  }

  const tokenInRaw = String(body.tokenIn ?? '').trim()
  const tokenOutRaw = String(body.tokenOut ?? '').trim()
  const amountInUnits = parseAmountInUnits(body.amountInUnits)
  if (!isAddress(tokenInRaw)) return res.status(400).json({ success: false, error: 'Invalid tokenIn address' })
  if (!isAddress(tokenOutRaw)) return res.status(400).json({ success: false, error: 'Invalid tokenOut address' })
  if (!amountInUnits) return res.status(400).json({ success: false, error: 'Invalid amountInUnits' })

  const tokenIn = getAddress(tokenInRaw)
  const tokenOut = getAddress(tokenOutRaw)
  const zQuoter = resolveZquoterAddress()

  const publicClient = createPublicClient({
    chain: base,
    transport: http(getReadRpcUrl(), { timeout: RPC_TIMEOUT_MS }),
  })

  try {
    const code = await publicClient.getBytecode({ address: zQuoter })
    if (!code || code === '0x') {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          reason: `zQuoter ${zQuoter} is not deployed on Base`,
          zQuoter,
          chainId: ZQUOTER_CHAIN_ID,
          chainName: ZQUOTER_CHAIN_NAME,
          fetchedAt: Date.now(),
          maxAgeMs: QUOTE_MAX_AGE_MS,
        },
      })
    }

    const [tokenInDecimals, tokenOutDecimals] = await Promise.all([
      publicClient
        .readContract({
          address: tokenIn,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        .then(Number)
        .catch(() => 18),
      publicClient
        .readContract({
          address: tokenOut,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        .then(Number)
        .catch(() => 18),
    ])

    const amountIn = parseUnits(amountInUnits, tokenInDecimals)
    const [bestRaw, quotesRaw] = await publicClient.readContract({
      address: zQuoter,
      abi: ZQUOTER_ABI,
      functionName: 'getQuotes',
      args: [false, tokenIn, tokenOut, amountIn],
    })

    const best = toQuoteRow(bestRaw as ZQuoteTuple, tokenInDecimals, tokenOutDecimals)
    const quotes = (quotesRaw as ZQuoteTuple[]).map((q) => toQuoteRow(q, tokenInDecimals, tokenOutDecimals))

    return res.status(200).json({
      success: true,
      data: {
        available: true,
        zQuoter,
        tokenIn,
        tokenOut,
        chainId: ZQUOTER_CHAIN_ID,
        chainName: ZQUOTER_CHAIN_NAME,
        amountIn: amountIn.toString(),
        amountInUnits,
        amountOut: best.amountOut,
        amountOutUnits: best.amountOutUnits,
        best,
        quotes,
        fetchedAt: Date.now(),
        maxAgeMs: QUOTE_MAX_AGE_MS,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch zQuoter quote'
    return res.status(502).json({
      success: false,
      error: message || 'Failed to fetch zQuoter quote',
    })
  }
}
