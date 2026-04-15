import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createPublicClient, hashMessage, http, recoverMessageAddress, verifyMessage } from 'viem'
import { base } from 'viem/chains'

import {
  agentAccessProofRequestSchema,
  agentRoomAccessTokenSchema,
  type AgentAccessProofRequest,
  type AgentAccessProofSubmit,
  type AgentRoomAccessToken,
  type RoomCapability,
} from '../../../api/_handlers/v1/agents/_accessSchemas.js'
import { getDb } from '../db/postgres.js'

declare const process: { env: Record<string, string | undefined> }

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type VerifySignatureResult = {
  ok: boolean
  contractValidated: boolean
  recoveredSigner: `0x${string}` | null
}

const ACCESS_PROOF_NONCE_TTL_MS = 10 * 60_000
const ACCESS_TOKEN_TTL_MIN_MS = 15 * 60_000
const ACCESS_TOKEN_TTL_MAX_MS = 60 * 60_000
const ACCESS_TOKEN_DEFAULT_TTL_MS = 30 * 60_000
const EIP1271_MAGICVALUE = '0x1626ba7e'

const EIP1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

let agentAccessSchemaEnsured = false

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

function normalizeRpcUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (!text.startsWith('http://') && !text.startsWith('https://')) return `https://${text}`
  return text
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map(normalizeRpcUrl)
        .filter((value): value is string => Boolean(value))
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

function toBase64Url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): Buffer | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    return Buffer.from(padded, 'base64')
  } catch {
    return null
  }
}

function normalizeAddress(value: string): `0x${string}` {
  return value.trim().toLowerCase() as `0x${string}`
}

function parseIsoMs(value: string): number {
  return Date.parse(String(value))
}

function clampTokenTtlMs(raw: number | undefined): number {
  if (!Number.isFinite(raw ?? Number.NaN)) return ACCESS_TOKEN_DEFAULT_TTL_MS
  const value = Math.floor(Number(raw))
  return Math.max(ACCESS_TOKEN_TTL_MIN_MS, Math.min(ACCESS_TOKEN_TTL_MAX_MS, value))
}

function createNonce(): string {
  if (typeof randomUUID === 'function') return randomUUID()
  return randomBytes(16).toString('hex')
}

function nonceExpiryMs(rawTtlMs?: number): number {
  if (!Number.isFinite(rawTtlMs ?? Number.NaN)) return ACCESS_PROOF_NONCE_TTL_MS
  const value = Math.floor(Number(rawTtlMs))
  return Math.max(60_000, Math.min(30 * 60_000, value))
}

function getAgentAccessTokenSecret(): string {
  const explicit = (process.env.AGENT_ACCESS_TOKEN_SECRET ?? '').trim()
  if (explicit.length >= 16) return explicit
  const fallback = (process.env.AUTH_SESSION_SECRET ?? '').trim()
  if (fallback.length >= 16) return fallback

  const globalAny = globalThis as any
  if (!globalAny.__4626_agent_access_token_secret) {
    globalAny.__4626_agent_access_token_secret = randomBytes(32).toString('hex')
  }
  return String(globalAny.__4626_agent_access_token_secret)
}

function hashMessageHex(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('hex')
}

function signPayload(payloadB64: string): string {
  const secret = getAgentAccessTokenSecret()
  return toBase64Url(createHmac('sha256', secret).update(payloadB64, 'utf8').digest())
}

function createAccessTokenFromClaims(claims: Omit<AgentRoomAccessToken, 'accessToken'>): string {
  const payload = toBase64Url(JSON.stringify(claims))
  const signature = signPayload(payload)
  return `4626aat.v1.${payload}.${signature}`
}

async function ensureAgentAccessSchema(db: Db): Promise<void> {
  if (agentAccessSchemaEnsured) return
  await db.sql`
    CREATE TABLE IF NOT EXISTS agent_access_nonces (
      nonce TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      share_token TEXT NOT NULL,
      room_key TEXT NOT NULL,
      message_hash TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ NULL,
      signer TEXT NULL,
      signature TEXT NULL
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS agent_access_nonces_expires_idx ON agent_access_nonces (expires_at);`
  await db.sql`
    CREATE INDEX IF NOT EXISTS agent_access_nonces_lookup_idx
    ON agent_access_nonces (wallet_address, share_token, room_key, consumed_at, expires_at);
  `

  await db.sql`
    CREATE TABLE IF NOT EXISTS agent_room_access_tokens (
      jti TEXT PRIMARY KEY,
      sub TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      share_token TEXT NOT NULL,
      room_key TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS agent_room_access_tokens_expires_idx ON agent_room_access_tokens (expires_at);`
  await db.sql`CREATE INDEX IF NOT EXISTS agent_room_access_tokens_sub_idx ON agent_room_access_tokens (sub, expires_at);`

  agentAccessSchemaEnsured = true
}

async function verifyEip1271(params: {
  contract: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const digest = hashMessage(params.message)
  for (const rpcUrl of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, { timeout: 12_000 }),
      })
      const code = await client.getBytecode({ address: params.contract })
      if (!code || code === '0x') return false
      const magic = await client.readContract({
        address: params.contract,
        abi: EIP1271_ABI,
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

async function verifyWalletSignature(params: {
  wallet: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<VerifySignatureResult> {
  let recoveredSigner: `0x${string}` | null = null
  try {
    recoveredSigner = normalizeAddress(
      await recoverMessageAddress({
        message: params.message,
        signature: params.signature,
      }),
    )
  } catch {
    recoveredSigner = null
  }

  try {
    const direct = await verifyMessage({
      address: params.wallet,
      message: params.message,
      signature: params.signature,
    })
    if (direct) {
      return {
        ok: true,
        contractValidated: false,
        recoveredSigner: recoveredSigner ?? params.wallet,
      }
    }
  } catch {
    // Fall through to EIP-1271 validation.
  }

  const eip1271Valid = await verifyEip1271({
    contract: params.wallet,
    message: params.message,
    signature: params.signature,
  })

  return {
    ok: eip1271Valid,
    contractValidated: eip1271Valid,
    recoveredSigner,
  }
}

async function storeAccessProofNonce(params: { proofRequest: AgentAccessProofRequest }): Promise<void> {
  const db = (await getDb()) as Db | null
  if (!db) return
  await ensureAgentAccessSchema(db)
  const proof = params.proofRequest
  await db.sql`
    INSERT INTO agent_access_nonces (
      nonce,
      wallet_address,
      chain_id,
      share_token,
      room_key,
      message_hash,
      issued_at,
      expires_at
    ) VALUES (
      ${proof.nonce},
      ${proof.wallet.toLowerCase()},
      ${proof.chainId},
      ${proof.shareToken.toLowerCase()},
      ${proof.roomKey},
      ${hashMessageHex(proof.message)},
      ${proof.issuedAt},
      ${proof.expiresAt}
    )
    ON CONFLICT (nonce) DO UPDATE
    SET
      wallet_address = EXCLUDED.wallet_address,
      chain_id = EXCLUDED.chain_id,
      share_token = EXCLUDED.share_token,
      room_key = EXCLUDED.room_key,
      message_hash = EXCLUDED.message_hash,
      issued_at = EXCLUDED.issued_at,
      expires_at = EXCLUDED.expires_at,
      consumed_at = NULL,
      signer = NULL,
      signature = NULL;
  `
}

async function consumeAccessProofNonce(params: {
  proofRequest: AgentAccessProofRequest
  signer: `0x${string}`
  signature: `0x${string}`
}): Promise<boolean> {
  const db = (await getDb()) as Db | null
  if (!db) return true
  await ensureAgentAccessSchema(db)

  const proof = params.proofRequest
  const result = await db.sql`
    UPDATE agent_access_nonces
    SET
      consumed_at = NOW(),
      signer = ${params.signer.toLowerCase()},
      signature = ${params.signature}
    WHERE nonce = ${proof.nonce}
      AND wallet_address = ${proof.wallet.toLowerCase()}
      AND chain_id = ${proof.chainId}
      AND share_token = ${proof.shareToken.toLowerCase()}
      AND room_key = ${proof.roomKey}
      AND consumed_at IS NULL
      AND expires_at > NOW()
      AND message_hash = ${hashMessageHex(proof.message)}
    RETURNING nonce;
  `

  return Boolean(result.rows?.[0]?.nonce)
}

async function persistRoomTokenClaims(params: { claims: Omit<AgentRoomAccessToken, 'accessToken'> }): Promise<void> {
  const db = (await getDb()) as Db | null
  if (!db) return
  await ensureAgentAccessSchema(db)
  const claims = params.claims
  if (!claims.jti) return
  await db.sql`
    INSERT INTO agent_room_access_tokens (
      jti,
      sub,
      chain_id,
      share_token,
      room_key,
      issued_at,
      expires_at
    ) VALUES (
      ${claims.jti},
      ${claims.sub.toLowerCase()},
      ${claims.chainId},
      ${claims.shareToken.toLowerCase()},
      ${claims.roomKey},
      ${claims.issuedAt},
      ${claims.expiresAt}
    )
    ON CONFLICT (jti) DO UPDATE
    SET
      sub = EXCLUDED.sub,
      chain_id = EXCLUDED.chain_id,
      share_token = EXCLUDED.share_token,
      room_key = EXCLUDED.room_key,
      issued_at = EXCLUDED.issued_at,
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL;
  `
}

async function isRoomTokenJtiActive(jti: string): Promise<boolean> {
  const db = (await getDb()) as Db | null
  if (!db) return true
  await ensureAgentAccessSchema(db)
  const result = await db.sql`
    SELECT jti, revoked_at, expires_at
    FROM agent_room_access_tokens
    WHERE jti = ${jti}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return false
  if (row.revoked_at) return false
  const expiresAt = parseIsoMs(String(row.expires_at ?? ''))
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export function buildAgentAccessProofMessage(fields: {
  wallet: `0x${string}`
  chainId: number
  shareToken: `0x${string}`
  roomKey: string
  nonce: string
  issuedAt: string
  expiresAt: string
}): string {
  return [
    '4626 Access Proof',
    '',
    `Wallet: ${fields.wallet.toLowerCase()}`,
    `Chain ID: ${fields.chainId}`,
    `Share Token: ${fields.shareToken.toLowerCase()}`,
    `Room Key: ${fields.roomKey}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expires At: ${fields.expiresAt}`,
  ].join('\n')
}

export async function issueAgentAccessProofRequest(params: {
  wallet: `0x${string}`
  chainId: number
  shareToken: `0x${string}`
  roomKey: string
  nonceTtlMs?: number
}): Promise<AgentAccessProofRequest> {
  const nowMs = Date.now()
  const expiresMs = nowMs + nonceExpiryMs(params.nonceTtlMs)
  const issuedAt = new Date(nowMs).toISOString()
  const expiresAt = new Date(expiresMs).toISOString()

  const wallet = normalizeAddress(params.wallet)
  const shareToken = normalizeAddress(params.shareToken)
  const roomKey = String(params.roomKey ?? '').trim()
  const chainId = Math.max(1, Math.floor(Number(params.chainId) || 0))

  const requestNoMessage = {
    schema: '4626-agent-access-proof-request-v1' as const,
    wallet,
    chainId,
    shareToken,
    roomKey,
    nonce: createNonce(),
    issuedAt,
    expiresAt,
  }
  const message = buildAgentAccessProofMessage(requestNoMessage)

  const proofRequest = agentAccessProofRequestSchema.parse({
    ...requestNoMessage,
    message,
  })
  await storeAccessProofNonce({ proofRequest })
  return proofRequest
}

export async function verifyAgentAccessProofSubmission(params: {
  submission: AgentAccessProofSubmit
}): Promise<{
  wallet: `0x${string}`
  chainId: number
  shareToken: `0x${string}`
  roomKey: string
  signer: `0x${string}`
  recoveredSigner: `0x${string}` | null
}> {
  const proofRequest = params.submission.proofRequest
  const signer = normalizeAddress(params.submission.signer)
  const signature = params.submission.signature as `0x${string}`
  const now = Date.now()
  const issuedAtMs = parseIsoMs(proofRequest.issuedAt)
  const expiresAtMs = parseIsoMs(proofRequest.expiresAt)

  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    throw new Error('proof_invalid_timestamps')
  }
  if (now > expiresAtMs) {
    throw new Error('proof_expired')
  }
  if (issuedAtMs - now > 60_000) {
    throw new Error('proof_not_yet_valid')
  }

  const expectedMessage = buildAgentAccessProofMessage({
    wallet: normalizeAddress(proofRequest.wallet),
    chainId: proofRequest.chainId,
    shareToken: normalizeAddress(proofRequest.shareToken),
    roomKey: proofRequest.roomKey,
    nonce: proofRequest.nonce,
    issuedAt: proofRequest.issuedAt,
    expiresAt: proofRequest.expiresAt,
  })
  if (proofRequest.message !== expectedMessage) {
    throw new Error('proof_message_mismatch')
  }

  const wallet = normalizeAddress(proofRequest.wallet)
  const verification = await verifyWalletSignature({
    wallet,
    message: proofRequest.message,
    signature,
  })
  if (!verification.ok) {
    throw new Error('proof_signature_invalid')
  }

  if (!verification.contractValidated && signer !== wallet) {
    throw new Error('proof_signer_wallet_mismatch')
  }
  if (verification.recoveredSigner && signer !== verification.recoveredSigner) {
    throw new Error('proof_signer_recovery_mismatch')
  }

  const nonceConsumed = await consumeAccessProofNonce({
    proofRequest,
    signer,
    signature,
  })
  if (!nonceConsumed) {
    throw new Error('proof_nonce_invalid_or_used')
  }

  return {
    wallet,
    chainId: proofRequest.chainId,
    shareToken: normalizeAddress(proofRequest.shareToken),
    roomKey: proofRequest.roomKey,
    signer,
    recoveredSigner: verification.recoveredSigner,
  }
}

export async function issueAgentRoomAccessToken(params: {
  sub: `0x${string}`
  chainId: number
  shareToken: `0x${string}`
  roomKey: string
  capabilities?: RoomCapability[]
  ttlMs?: number
}): Promise<AgentRoomAccessToken> {
  const nowMs = Date.now()
  const ttlMs = clampTokenTtlMs(params.ttlMs)
  const expiresMs = nowMs + ttlMs
  const claims: Omit<AgentRoomAccessToken, 'accessToken'> = {
    schema: '4626-agent-room-access-token-v1',
    sub: normalizeAddress(params.sub),
    chainId: Math.max(1, Math.floor(Number(params.chainId) || 0)),
    shareToken: normalizeAddress(params.shareToken),
    roomKey: String(params.roomKey ?? '').trim(),
    issuedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    tokenType: 'bearer',
    capabilities: params.capabilities && params.capabilities.length > 0 ? params.capabilities : ['join', 'read'],
    jti: createNonce(),
  }
  const accessToken = createAccessTokenFromClaims(claims)
  await persistRoomTokenClaims({ claims })
  return agentRoomAccessTokenSchema.parse({
    ...claims,
    accessToken,
  })
}

export async function verifyAgentRoomAccessToken(token: string): Promise<
  | { ok: true; token: AgentRoomAccessToken }
  | { ok: false; error: string }
> {
  const raw = String(token ?? '').trim()
  if (!raw) return { ok: false, error: 'missing_access_token' }
  const parts = raw.split('.')
  if (parts.length !== 4 || parts[0] !== '4626aat' || parts[1] !== 'v1') {
    return { ok: false, error: 'token_format_invalid' }
  }
  const payloadB64 = parts[2] ?? ''
  const signatureB64 = parts[3] ?? ''
  const expectedSignature = signPayload(payloadB64)
  try {
    const a = Buffer.from(signatureB64, 'utf8')
    const b = Buffer.from(expectedSignature, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: 'token_signature_invalid' }
    }
  } catch {
    return { ok: false, error: 'token_signature_invalid' }
  }

  const payloadBuffer = fromBase64Url(payloadB64)
  if (!payloadBuffer) return { ok: false, error: 'token_payload_invalid' }

  let claims: unknown
  try {
    claims = JSON.parse(payloadBuffer.toString('utf8'))
  } catch {
    return { ok: false, error: 'token_payload_invalid' }
  }

  const parsed = agentRoomAccessTokenSchema.safeParse({
    ...(claims as Record<string, unknown>),
    accessToken: raw,
  })
  if (!parsed.success) {
    return { ok: false, error: 'token_claims_invalid' }
  }

  const tokenPayload = parsed.data
  const expiresAtMs = parseIsoMs(tokenPayload.expiresAt)
  const issuedAtMs = parseIsoMs(tokenPayload.issuedAt)
  const nowMs = Date.now()
  if (!Number.isFinite(expiresAtMs) || nowMs >= expiresAtMs) {
    return { ok: false, error: 'token_expired' }
  }
  if (!Number.isFinite(issuedAtMs) || issuedAtMs - nowMs > 60_000) {
    return { ok: false, error: 'token_not_yet_valid' }
  }

  if (tokenPayload.jti) {
    const jtiActive = await isRoomTokenJtiActive(tokenPayload.jti)
    if (!jtiActive) return { ok: false, error: 'token_revoked_or_unknown' }
  }

  return { ok: true, token: tokenPayload }
}
