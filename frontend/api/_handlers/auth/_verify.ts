import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  clearCookie,
  consumeNonce,
  COOKIE_NONCE,
  COOKIE_SESSION,
  ensureNonceSchema,
  handleOptions,
  hostMatchesDomain,
  makeSessionToken,
  parseCookies,
  parseSiweMessage,
  readNonceToken,
  readJsonBody,
  setCookie,
  setCors,
  setNoStore,
  verifySiweSignature,
} from '../../../server/auth/_shared.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { upsertProfileByWallet } from '../../../server/_lib/profileSync.js'


type VerifyBody = { message?: string; signature?: string; nonceToken?: string; cswAddress?: string }

const DEFAULT_BASE_RPCS = ['https://mainnet.base.org', 'https://base.llamarpc.com'] as const

const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

type VerifyResponse = {
  address: string
  sessionToken: string
  cswOwnership?: {
    cswAddress: string
    ownerAddress: string
    verified: boolean
  } | null
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').split(',')[0]?.trim() ?? ''
}

function getRequestOrigin(req: VercelRequest): string {
  const protoRaw = firstHeaderValue(req.headers?.['x-forwarded-proto'])
  const hostRaw =
    firstHeaderValue(req.headers?.['x-forwarded-host']) || firstHeaderValue(req.headers?.host)
  if (!hostRaw) return ''
  const proto = protoRaw.toLowerCase().startsWith('https') ? 'https' : 'http'
  return `${proto}://${hostRaw}`
}

function isAddressLike(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(v)
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  if (!raw) return [...DEFAULT_BASE_RPCS]
  const parts = raw.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean)
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

async function verifyCswOwnerOnBase(params: { smartWallet: string; ownerAddress: string }): Promise<boolean> {
  const { createPublicClient, encodeAbiParameters, getAddress, http } = await import('viem')
  const { base } = await import('viem/chains')

  const smartWallet = getAddress(params.smartWallet as `0x${string}`)
  const ownerAddress = getAddress(params.ownerAddress as `0x${string}`)

  for (const rpc of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpc, { timeout: 10_000 }),
      })

      try {
        const isOwner = await client.readContract({
          address: smartWallet,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'isOwnerAddress',
          args: [ownerAddress],
        })
        if (isOwner === true) return true
      } catch {
        // Fallback to owner scan for wallets/contracts that don't expose isOwnerAddress.
      }

      const countRaw = (await client.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerCount',
      })) as bigint
      let upperBound = Number(countRaw)
      if (!Number.isFinite(upperBound) || upperBound < 0) upperBound = 0
      try {
        const nextRaw = (await client.readContract({
          address: smartWallet,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'nextOwnerIndex',
        })) as bigint
        const next = Number(nextRaw)
        if (Number.isFinite(next) && next > 0) upperBound = next
      } catch {
        // ignore; fallback to ownerCount
      }
      const maxScan = Math.min(upperBound, 128)
      const expected = String(encodeAbiParameters([{ type: 'address' }], [ownerAddress])).toLowerCase()
      for (let i = 0; i < maxScan; i += 1) {
        const ownerBytes = (await client.readContract({
          address: smartWallet,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'ownerAtIndex',
          args: [BigInt(i)],
        })) as string
        if (String(ownerBytes).toLowerCase() === expected) return true
      }
      // Reached a healthy RPC and found no owner match.
      return false
    } catch {
      // Try next RPC
      continue
    }
  }

  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<VerifyBody>(req)
  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''
  const nonceTokenRaw = typeof body?.nonceToken === 'string' ? body.nonceToken : ''
  const cswAddressRaw = typeof body?.cswAddress === 'string' ? body.cswAddress.trim() : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }
  if (cswAddressRaw && !isAddressLike(cswAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid cswAddress' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiweMessage(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid message' } satisfies ApiEnvelope<never>)
  }

  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  if (!hostMatchesDomain(host, parsed.domain)) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const cookies = parseCookies(req)
  const cookieNonce = cookies[COOKIE_NONCE] ?? ''
  const cookieMatches = cookieNonce && cookieNonce === parsed.nonce
  if (!cookieMatches) {
    // Fallback for embedded contexts where cookies may be blocked: validate the signed nonce token.
    const nonceToken = nonceTokenRaw ? readNonceToken(nonceTokenRaw) : null
    if (!nonceToken || nonceToken.nonce !== parsed.nonce) {
      return res.status(400).json({ success: false, error: 'Nonce mismatch' } satisfies ApiEnvelope<never>)
    }
  }

  // Best-effort replay window: message must be recent.
  const issuedAtMs = Date.parse(parsed.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > 1000 * 60 * 15) {
    return res.status(400).json({ success: false, error: 'Message expired' } satisfies ApiEnvelope<never>)
  }

  if (parsed.chainId !== 8453) {
    return res.status(400).json({ success: false, error: 'Invalid chain' } satisfies ApiEnvelope<never>)
  }

  const parsedUriOrigin = normalizeOrigin(parsed.uri)
  if (!parsedUriOrigin) {
    return res.status(400).json({ success: false, error: 'URI mismatch' } satisfies ApiEnvelope<never>)
  }
  const requestOrigin = normalizeOrigin(getRequestOrigin(req))
  const acceptedOrigins = new Set<string>()
  if (requestOrigin) acceptedOrigins.add(requestOrigin)
  try {
    const canonicalOrigin = normalizeOrigin(getCanonicalOrigin(req))
    if (canonicalOrigin) acceptedOrigins.add(canonicalOrigin)
  } catch {
    // Canonical origin may be intentionally unset in some environments; rely on request-origin binding.
  }
  if (!acceptedOrigins.has(parsedUriOrigin)) {
    return res.status(400).json({ success: false, error: 'URI mismatch' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }
  try {
    await ensureNonceSchema(db as any)
    const consumed = await consumeNonce(db as any, parsed.nonce)
    if (!consumed) {
      return res.status(400).json({ success: false, error: 'Nonce already used or expired' } satisfies ApiEnvelope<never>)
    }
  } catch {
    return res.status(503).json({ success: false, error: 'Auth service unavailable' } satisfies ApiEnvelope<never>)
  }

  const verified = await verifySiweSignature({ message, signature })
  if (!verified) {
    return res.status(401).json({ success: false, error: 'Signature invalid' } satisfies ApiEnvelope<never>)
  }

  let cswOwnership: VerifyResponse['cswOwnership'] = null
  if (cswAddressRaw) {
    const ownerVerified = await verifyCswOwnerOnBase({
      smartWallet: cswAddressRaw,
      ownerAddress: verified.address,
    })
    cswOwnership = {
      cswAddress: cswAddressRaw,
      ownerAddress: verified.address,
      verified: ownerVerified,
    }
  }

  const token = makeSessionToken({ address: verified.address })
  setCookie(req, res, COOKIE_SESSION, token, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })
  clearCookie(req, res, COOKIE_NONCE)

  try {
    await ensureWaitlistSchema(db as any)
    const verifiedCanonicalCsw =
      cswOwnership?.verified === true ? cswOwnership.cswAddress.toLowerCase() : null
    await upsertProfileByWallet(db as any, {
      primaryWallet: verified.address,
      cswAddress: verifiedCanonicalCsw,
      baseSubAccount: verifiedCanonicalCsw,
    })
  } catch {
    // best-effort: auth should succeed even if DB is unavailable
  }

  return res.status(200).json({
    success: true,
    data: { address: verified.address, sessionToken: token, cswOwnership } satisfies VerifyResponse,
  } satisfies ApiEnvelope<VerifyResponse>)
}

