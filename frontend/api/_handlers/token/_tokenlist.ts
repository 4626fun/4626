import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { isAddress } from 'viem'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  requireServerKey,
  setPublicCors,
} from '../../../server/zora/_shared.js'
import { buildShareTokenMetadata } from '../../../server/_lib/shareTokenMetadata.js'

declare const process: { env: Record<string, string | undefined> }

type TokenListVersion = {
  major: number
  minor: number
  patch: number
}

const TOKEN_LIST_VERSION: TokenListVersion = {
  major: 1,
  minor: 0,
  patch: 0,
}

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

function toNumberOrDefault(value: unknown, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.trunc(num))
}

/**
 * Token List compatible output for a single Share token entry.
 * This endpoint publishes logoURI as an absolute HTTPS URL that points to
 * canonical extension-based aliases (/logo.png and /logo.svg).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = getStringQuery(req, 'address')
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: 'Invalid token address' })
  }

  const chainId = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID
  const hostFromReq = typeof req.headers.host === 'string' ? req.headers.host : ''
  const apiHost = normalizeHost(process.env.API_HOST) || normalizeHost(hostFromReq) || 'api.4626.fun'
  const apiBaseUrl = `${inferProtocol(apiHost)}://${apiHost}`
  const tokenAddress = address.toLowerCase()
  const logoPngUrl = `${apiBaseUrl}/v1/token/${tokenAddress}/logo.png?chain=${chainId}`
  const logoSvgUrl = `${apiBaseUrl}/v1/token/${tokenAddress}/logo.svg?chain=${chainId}`

  try {
    const metadata = await buildShareTokenMetadata({
      address: address as Address,
      chainId,
      rpcUrl: process.env.BASE_RPC_URL,
      apiHost,
      appHost: process.env.APP_HOST?.trim().replace(/\/+$/, ''),
      zoraKey: requireServerKey(),
    })

    const nameRaw = typeof metadata?.name === 'string' ? metadata.name.trim() : ''
    const symbolRaw = typeof metadata?.symbol === 'string' ? metadata.symbol.trim() : ''
    const tokenName = nameRaw || '4626 Share Token'
    const tokenSymbol = symbolRaw || 'TOKEN'
    const tokenDecimals = toNumberOrDefault(metadata?.decimals, 18)

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    return res.status(200).json({
      name: `4626 Share Token List`,
      timestamp: new Date().toISOString(),
      version: TOKEN_LIST_VERSION,
      tokens: [
        {
          chainId,
          address: tokenAddress,
          decimals: tokenDecimals,
          name: tokenName,
          symbol: tokenSymbol,
          logoURI: logoPngUrl,
          extensions: {
            logoSVG: logoSvgUrl,
          },
        },
      ],
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to build token list'
    return res.status(500).json({ error: message })
  }
}
