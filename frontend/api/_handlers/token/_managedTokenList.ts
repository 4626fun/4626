import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { createPublicClient, getAddress, http, isAddress } from 'viem'

import { setPublicCors, setCache, DEFAULT_CHAIN_ID, getNumberQuery, getStringQuery, handleOptions, requireServerKey } from '../../../server/zora/_shared.js'
import { blobHeadOrNull, blobPutBytes, fetchBytes } from '../../../server/_lib/blob.js'

declare const process: { env: Record<string, string | undefined> }

type TokenListVersion = { major: number; minor: number; patch: number }

const TOKEN_LIST_VERSION: TokenListVersion = { major: 1, minor: 0, patch: 0 }
const TOKEN_LIST_NAME = '4626 Managed ShareOFT Token List'

function normalizeHost(value: string | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).host
    } catch {
      return ''
    }
  }
  return raw.replace(/\/+$/, '')
}

function inferProtocol(host: string): 'http' | 'https' {
  const value = host.toLowerCase()
  if (value.startsWith('localhost') || value.startsWith('127.0.0.1') || value.startsWith('0.0.0.0')) {
    return 'http'
  }
  return 'https'
}

function getTokenListBlobPath(chainId: number): string {
  // Stable blob key so the endpoint URL stays fixed for TokenLists ingestion.
  return `tokenlists/managed-shareofts/chain-${chainId}.json`
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function readKnownShareOfts(chainId: number): Promise<Address[]> {
  const pathname = getTokenListBlobPath(chainId)
  const blob = await blobHeadOrNull(pathname).catch(() => null)
  if (blob?.url) {
    const { bytes } = await fetchBytes(blob.url).catch(() => ({ bytes: null as any }))
    if (bytes) {
      const parsed = safeJsonParse<{ shareOfts?: string[] }>(Buffer.from(bytes).toString('utf8'))
      const addrs = parsed?.shareOfts ?? []
      return addrs.filter((a) => isAddress(a)).map((a) => a as Address)
    }
  }

  const seedRaw = process.env.MANAGED_TOKENLIST_SHAREOFTS_JSON
  if (seedRaw) {
    const parsed = safeJsonParse<{ shareOfts?: string[] }>(seedRaw) ?? safeJsonParse<string[]>(seedRaw) ?? null
    const addrs = Array.isArray(parsed) ? parsed : parsed?.shareOfts ?? []
    return addrs.filter((a) => isAddress(a)).map((a) => a as Address)
  }

  return []
}

async function writeKnownShareOfts(chainId: number, addresses: Address[]): Promise<void> {
  const pathname = getTokenListBlobPath(chainId)
  const bytes = new TextEncoder().encode(JSON.stringify({ chainId, shareOfts: addresses }, null, 2))
  await blobPutBytes({ pathname, bytes, contentType: 'application/json', cacheControlMaxAgeSeconds: 300 })
}

const ERC20_META_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

async function buildTokenEntry(params: {
  chainId: number
  apiBaseUrl: string
  shareOft: Address
  publicClient: ReturnType<typeof createPublicClient>
}): Promise<any> {
  const { chainId, apiBaseUrl, shareOft, publicClient } = params

  const [name, symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: shareOft, abi: ERC20_META_ABI, functionName: 'name' }).catch(() => '4626 Share Token'),
    publicClient.readContract({ address: shareOft, abi: ERC20_META_ABI, functionName: 'symbol' }).catch(() => 'TOKEN'),
    publicClient.readContract({ address: shareOft, abi: ERC20_META_ABI, functionName: 'decimals' }).catch(() => 18n),
  ])

  const tokenAddressLower = shareOft.toLowerCase()
  const logoPngUrl = `${apiBaseUrl}/v1/token/${tokenAddressLower}/logo.png?chain=${chainId}`
  const logoSvgUrl = `${apiBaseUrl}/v1/token/${tokenAddressLower}/logo.svg?chain=${chainId}`

  return {
    chainId,
    address: getAddress(shareOft),
    decimals: Number(decimals),
    name: typeof name === 'string' ? name : '4626 Share Token',
    symbol: typeof symbol === 'string' ? symbol : 'TOKEN',
    logoURI: logoPngUrl,
    extensions: {
      logoSVG: logoSvgUrl,
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  setCache(res, 600)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (handleOptions(req, res)) return

  const chainId = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID
  const hostFromReq = typeof req.headers.host === 'string' ? req.headers.host : ''
  const apiHost = normalizeHost(process.env.API_HOST) || normalizeHost(hostFromReq) || 'api.4626.fun'
  const apiBaseUrl = `${inferProtocol(apiHost)}://${apiHost}`

  if (req.method === 'GET') {
    const shareOfts = await readKnownShareOfts(chainId)
    const publicClient = createPublicClient({
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    })

    const tokens = await Promise.all(
      shareOfts.slice(0, 500).map((shareOft) =>
        buildTokenEntry({
          chainId,
          apiBaseUrl,
          shareOft,
          publicClient,
        }),
      ),
    )

    return res.status(200).json({
      name: TOKEN_LIST_NAME,
      timestamp: new Date().toISOString(),
      version: TOKEN_LIST_VERSION,
      tokens,
    })
  }

  if (req.method === 'POST') {
    const serverKey = requireServerKey()
    if (!serverKey) return res.status(500).json({ error: 'Server API key missing' })

    // Mutation endpoint: allow ingestion by deployment automation.
    // Authorization check: require exact match against `x-zora-server-key` header.
    const provided = typeof req.headers['x-zora-server-key'] === 'string' ? req.headers['x-zora-server-key'] : null
    if (!provided || provided !== serverKey) return res.status(401).json({ error: 'Unauthorized' })

    const shareOftRaw = (req.body as any)?.shareOft
    if (!shareOftRaw || typeof shareOftRaw !== 'string' || !isAddress(shareOftRaw)) {
      return res.status(400).json({ error: 'Invalid shareOft' })
    }

    const existing = await readKnownShareOfts(chainId)
    const normalized = existing.map((a) => a.toLowerCase())
    const nextAddr = shareOftRaw as Address
    const already = normalized.includes(nextAddr.toLowerCase())
    const next = already ? existing : [...existing, nextAddr]
    await writeKnownShareOfts(chainId, next)

    return res.status(200).json({ ok: true, chainId, shareOftsCount: next.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

