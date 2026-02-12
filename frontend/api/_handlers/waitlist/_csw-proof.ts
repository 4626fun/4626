/**
 * CSW Ownership Proof — ERC-1271 challenge-response verification.
 *
 * GET  → returns a signed challenge token + message for the given CSW address
 * POST → verifies the ERC-1271 signature against the CSW contract on Base
 *
 * This proves the user controls the canonical Coinbase Smart Wallet by having
 * one of its owner/signer keys produce a signature that the CSW contract
 * validates via `isValidSignature` (ERC-1271 / 0x1626ba7e).
 *
 * The challenge token is HMAC-signed and self-contained (stateless), so GET
 * and POST can hit different serverless instances without shared state.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  readJsonBody,
} from '../../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const EIP1271_MAGICVALUE = '0x1626ba7e'

const eip1271Abi = [
  {
    type: 'function' as const,
    name: 'isValidSignature' as const,
    stateMutability: 'view' as const,
    inputs: [
      { name: 'hash', type: 'bytes32' as const },
      { name: 'signature', type: 'bytes' as const },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' as const }],
  },
] as const

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'nextOwnerIndex', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

// ---------------------------------------------------------------------------
// HMAC-signed challenge token (stateless across serverless instances)
// ---------------------------------------------------------------------------

type ChallengePayload = {
  /** nonce */
  n: string
  /** CSW address (lowercase) */
  a: string
  /** the full challenge message the user must sign */
  m: string
  /** issued at (ms) */
  iat: number
  /** expires at (ms) */
  exp: number
}

function getCswProofSecret(): string {
  // Prefer a dedicated secret; fall back to the auth session secret; fall back to an ephemeral one.
  const env =
    (process.env.CSW_PROOF_SECRET ?? '').trim() ||
    (process.env.AUTH_SESSION_SECRET ?? '').trim()
  if (env.length >= 16) return env

  const g: any = globalThis as any
  if (!g.__csw_proof_secret) g.__csw_proof_secret = randomBytes(32).toString('hex')
  return g.__csw_proof_secret as string
}

function base64UrlEncode(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToString(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function hmacSha256(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

function makeChallengeToken(payload: ChallengePayload): string {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = base64UrlEncode(hmacSha256(getCswProofSecret(), payloadB64))
  return `${payloadB64}.${sigB64}`
}

function readChallengeToken(token: string | null | undefined): ChallengePayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expected = base64UrlEncode(hmacSha256(getCswProofSecret(), payloadB64))
  try {
    const a = Buffer.from(sigB64, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  const payloadRaw = base64UrlDecodeToString(payloadB64)
  if (!payloadRaw) return null
  let parsed: any
  try {
    parsed = JSON.parse(payloadRaw)
  } catch {
    return null
  }

  const nonce = typeof parsed?.n === 'string' ? parsed.n : ''
  const address = typeof parsed?.a === 'string' ? parsed.a : ''
  const message = typeof parsed?.m === 'string' ? parsed.m : ''
  const exp = typeof parsed?.exp === 'number' ? parsed.exp : 0
  if (!nonce || !address || !message) return null
  if (!exp || exp < Date.now()) return null
  return parsed as ChallengePayload
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function makeNonce(): string {
  return randomBytes(16).toString('hex')
}

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

function getCanonicalDomain(): string {
  // Use the canonical production domain, not VERCEL_URL (which is the preview/deployment URL).
  return (
    (process.env.VITE_APP_URL ?? '').trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://4626.fun')
  )
}

function buildChallengeMessage(cswAddress: string, nonce: string): string {
  const domain = getCanonicalDomain()
  const issuedAt = new Date().toISOString()

  // SIWE-like format so wallets render it nicely
  return [
    `${new URL(domain).hostname} wants you to prove ownership of your Coinbase Smart Wallet:`,
    cswAddress,
    '',
    'Sign this message to prove you control this smart wallet.',
    'This signature will be verified on-chain via ERC-1271.',
    '',
    `URI: ${domain}`,
    'Version: 1',
    'Chain ID: 8453',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n')
}

/**
 * ABI-encode a Coinbase Smart Wallet `SignatureWrapper` struct.
 *
 * The CSW's `_isValidSignature` does `abi.decode(signature, (SignatureWrapper))`
 * which expects tuple encoding: (uint256 ownerIndex, bytes signatureData).
 */
function encodeSignatureWrapper(ownerIndex: number, signatureData: `0x${string}`, encodeAbiParameters: any): `0x${string}` {
  return encodeAbiParameters(
    [
      {
        type: 'tuple' as const,
        components: [
          { name: 'ownerIndex', type: 'uint256' as const },
          { name: 'signatureData', type: 'bytes' as const },
        ],
      },
    ],
    [{ ownerIndex: BigInt(ownerIndex), signatureData }],
  )
}

async function verifyErc1271OnBase(params: {
  contract: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const { createPublicClient, hashMessage, http, encodeAbiParameters } = await import('viem')
  const { base } = await import('viem/chains')

  const urls = getBaseRpcUrls()
  const digest = hashMessage(params.message)

  for (const url of urls) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })

      // Must be a deployed contract
      const code = await client.getBytecode({ address: params.contract })
      if (!code || code === '0x') continue

      // Build candidate signatures to try:
      // 1) Raw signature
      // 2) SignatureWrapper(ownerIndex, signature) across discovered owner indices
      //
      // We query owner bounds dynamically so wallets with owner index > 15 still verify.
      let scanLimit = 16
      try {
        const countRaw = (await (client as any).readContract({
          address: params.contract,
          abi: COINBASE_SMART_WALLET_OWNERS_ABI,
          functionName: 'ownerCount',
          args: [],
        })) as bigint
        let upperBound = Number(countRaw)
        if (!Number.isFinite(upperBound) || upperBound < 0) upperBound = 0
        try {
          const nextRaw = (await (client as any).readContract({
            address: params.contract,
            abi: COINBASE_SMART_WALLET_OWNERS_ABI,
            functionName: 'nextOwnerIndex',
            args: [],
          })) as bigint
          const next = Number(nextRaw)
          if (Number.isFinite(next) && next > 0) upperBound = next
        } catch {
          // ignore; fallback to ownerCount
        }
        scanLimit = Math.min(Math.max(upperBound, 1), 128)
      } catch {
        // ignore; fallback to 16
      }
      const candidates: `0x${string}`[] = [params.signature]
      for (let i = 0; i < scanLimit; i++) {
        candidates.push(encodeSignatureWrapper(i, params.signature, encodeAbiParameters))
      }

      // Try each candidate signature
      for (const sig of candidates) {
        try {
          const magic = await (client as any).readContract({
            address: params.contract,
            abi: eip1271Abi,
            functionName: 'isValidSignature',
            args: [digest, sig],
          })
          if (String(magic).toLowerCase() === EIP1271_MAGICVALUE) return true
        } catch {
          // This candidate failed; try next
          continue
        }
      }
      // All candidates failed on this RPC; try the next provider before failing.
      continue
    } catch {
      // RPC error — try next URL
      continue
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type ChallengeResponse = {
  challengeToken: string
  nonce: string
  message: string
  cswAddress: string
  expiresAt: string
}

type VerifyResponse = {
  verified: boolean
  cswAddress: string
  method: 'erc1271'
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCors(req, res)
  setNoStore(res)

  // GET: Issue a challenge
  if (req.method === 'GET') {
    const cswAddress = typeof req.query.cswAddress === 'string' ? req.query.cswAddress.trim() : ''
    if (!cswAddress || !isValidEvmAddress(cswAddress)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid cswAddress query parameter.' } satisfies ApiEnvelope<never>)
    }

    const nonce = makeNonce()
    const message = buildChallengeMessage(cswAddress, nonce)
    const now = Date.now()
    const expiresAt = now + CHALLENGE_TTL_MS

    const challengeToken = makeChallengeToken({
      n: nonce,
      a: cswAddress.toLowerCase(),
      m: message,
      iat: now,
      exp: expiresAt,
    })

    return res.status(200).json({
      success: true,
      data: {
        challengeToken,
        nonce,
        message,
        cswAddress,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    } satisfies ApiEnvelope<ChallengeResponse>)
  }

  // POST: Verify the signature
  if (req.method === 'POST') {
    const body = await readJsonBody<{
      challengeToken?: string
      cswAddress?: string
      signature?: string
    }>(req)
    if (!body) {
      return res.status(400).json({ success: false, error: 'Invalid request body.' } satisfies ApiEnvelope<never>)
    }

    const { challengeToken, cswAddress, signature } = body
    if (!challengeToken || typeof challengeToken !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing challengeToken.' } satisfies ApiEnvelope<never>)
    }
    if (!cswAddress || typeof cswAddress !== 'string' || !isValidEvmAddress(cswAddress)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid cswAddress.' } satisfies ApiEnvelope<never>)
    }
    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      return res.status(400).json({ success: false, error: 'Missing or invalid signature.' } satisfies ApiEnvelope<never>)
    }

    // Verify the HMAC-signed challenge token (stateless — no in-memory store needed)
    const challenge = readChallengeToken(challengeToken)
    if (!challenge) {
      return res.status(400).json({ success: false, error: 'Challenge token invalid or expired. Request a new one.' } satisfies ApiEnvelope<never>)
    }

    if (challenge.a !== cswAddress.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'CSW address does not match the challenge.' } satisfies ApiEnvelope<never>)
    }

    try {
      const verified = await verifyErc1271OnBase({
        contract: cswAddress as `0x${string}`,
        message: challenge.m,
        signature: signature as `0x${string}`,
      })

      if (!verified) {
        return res.status(403).json({
          success: false,
          error: 'Signature verification failed. Make sure you\'re signing with the same wallet that owns this smart wallet (e.g. Coinbase Wallet or the linked EOA). You can still join the waitlist without proving.',
        } satisfies ApiEnvelope<never>)
      }

      return res.status(200).json({
        success: true,
        data: {
          verified: true,
          cswAddress,
          method: 'erc1271',
        },
      } satisfies ApiEnvelope<VerifyResponse>)
    } catch (err: any) {
      console.error('[csw-proof] ERC-1271 verification error:', err?.message ?? err)
      return res.status(500).json({
        success: false,
        error: 'ERC-1271 verification failed unexpectedly.',
      } satisfies ApiEnvelope<never>)
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' } satisfies ApiEnvelope<never>)
}

export default handler
