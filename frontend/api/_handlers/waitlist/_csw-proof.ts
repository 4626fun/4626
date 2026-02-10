/**
 * CSW Ownership Proof — ERC-1271 challenge-response verification.
 *
 * GET  → returns a nonce + challenge message for the given CSW address
 * POST → verifies the ERC-1271 signature against the CSW contract on Base
 *
 * This proves the user controls the canonical Coinbase Smart Wallet by having
 * one of its owner/signer keys produce a signature that the CSW contract
 * validates via `isValidSignature` (ERC-1271 / 0x1626ba7e).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  makeNonce,
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

// In-memory challenge store (survives across requests within the same serverless invocation).
// For production at scale, move to a DB-backed nonce table.
const challengeStore = new Map<string, { nonce: string; cswAddress: string; message: string; expiresAt: number }>()

// Periodic cleanup of expired challenges
function pruneExpired() {
  const now = Date.now()
  const keys = Array.from(challengeStore.keys())
  for (const key of keys) {
    const entry = challengeStore.get(key)
    if (entry && entry.expiresAt < now) challengeStore.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
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

function buildChallengeMessage(cswAddress: string, nonce: string): string {
  const domain = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://creatorvault.fun'
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

async function verifyErc1271OnBase(params: {
  contract: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const { createPublicClient, hashMessage, http } = await import('viem')
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
      if (!code || code === '0x') return false

      const magic = await (client as any).readContract({
        address: params.contract,
        abi: eip1271Abi,
        functionName: 'isValidSignature',
        args: [digest, params.signature],
      })
      return String(magic).toLowerCase() === EIP1271_MAGICVALUE
    } catch {
      continue
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type ChallengeRequest = {
  cswAddress?: string
}

type VerifyRequest = {
  nonce?: string
  cswAddress?: string
  signature?: string
}

type ChallengeResponse = {
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

    pruneExpired()

    const nonce = makeNonce()
    const message = buildChallengeMessage(cswAddress, nonce)
    const expiresAt = Date.now() + CHALLENGE_TTL_MS

    challengeStore.set(nonce, { nonce, cswAddress: cswAddress.toLowerCase(), message, expiresAt })

    return res.status(200).json({
      success: true,
      data: {
        nonce,
        message,
        cswAddress,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    } satisfies ApiEnvelope<ChallengeResponse>)
  }

  // POST: Verify the signature
  if (req.method === 'POST') {
    const body = await readJsonBody<VerifyRequest>(req)
    if (!body) {
      return res.status(400).json({ success: false, error: 'Invalid request body.' } satisfies ApiEnvelope<never>)
    }

    const { nonce, cswAddress, signature } = body
    if (!nonce || typeof nonce !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing nonce.' } satisfies ApiEnvelope<never>)
    }
    if (!cswAddress || typeof cswAddress !== 'string' || !isValidEvmAddress(cswAddress)) {
      return res.status(400).json({ success: false, error: 'Missing or invalid cswAddress.' } satisfies ApiEnvelope<never>)
    }
    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      return res.status(400).json({ success: false, error: 'Missing or invalid signature.' } satisfies ApiEnvelope<never>)
    }

    pruneExpired()

    const challenge = challengeStore.get(nonce)
    if (!challenge) {
      return res.status(400).json({ success: false, error: 'Challenge expired or not found. Request a new one.' } satisfies ApiEnvelope<never>)
    }

    if (challenge.cswAddress !== cswAddress.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'CSW address does not match the challenge.' } satisfies ApiEnvelope<never>)
    }

    // Consume the nonce (one-time use)
    challengeStore.delete(nonce)

    if (challenge.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, error: 'Challenge expired. Request a new one.' } satisfies ApiEnvelope<never>)
    }

    try {
      const verified = await verifyErc1271OnBase({
        contract: cswAddress as `0x${string}`,
        message: challenge.message,
        signature: signature as `0x${string}`,
      })

      if (!verified) {
        return res.status(403).json({
          success: false,
          error: 'ERC-1271 verification failed. The signature is not valid for this smart wallet.',
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
