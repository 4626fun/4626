import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAddress, isAddress, type Address } from 'viem'

declare const process: { env: Record<string, string | undefined> }

type CustomOwnerSponsorshipTokenPayload = {
  v: 'coo1'
  sa: string
  sw: string
  oa: string
  pid: number | null
  iat: number
  exp: number
}

export type DecodedCustomOwnerSponsorshipToken = {
  sessionAddress: Address
  smartWalletAddress: Address
  ownerToAdd: Address
  profileId: number | null
  issuedAtMs: number
  expiresAtMs: number
}

const DEFAULT_TTL_SECONDS = 5 * 60

function getTokenSecret(): string {
  const secret = String(process.env.AUTH_SESSION_SECRET ?? '').trim()
  if (secret.length < 16) {
    throw new Error('AUTH_SESSION_SECRET missing_or_too_short')
  }
  return secret
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function signPayload(payloadB64: string): string {
  const signature = createHmac('sha256', getTokenSecret()).update(payloadB64, 'utf8').digest()
  return base64UrlEncode(signature)
}

function normalizeAddress(value: string): Address {
  if (!isAddress(value)) throw new Error('invalid_address')
  return getAddress(value)
}

export function issueCustomOwnerSponsorshipToken(params: {
  sessionAddress: Address
  smartWalletAddress: Address
  ownerToAdd: Address
  profileId?: number | null
  ttlSeconds?: number
  nowMs?: number
}): string {
  const now = typeof params.nowMs === 'number' ? params.nowMs : Date.now()
  const ttlSeconds =
    typeof params.ttlSeconds === 'number' && Number.isFinite(params.ttlSeconds) && params.ttlSeconds > 0
      ? Math.floor(params.ttlSeconds)
      : DEFAULT_TTL_SECONDS
  const payload: CustomOwnerSponsorshipTokenPayload = {
    v: 'coo1',
    sa: normalizeAddress(params.sessionAddress).toLowerCase(),
    sw: normalizeAddress(params.smartWalletAddress).toLowerCase(),
    oa: normalizeAddress(params.ownerToAdd).toLowerCase(),
    pid:
      typeof params.profileId === 'number' && Number.isFinite(params.profileId) && params.profileId > 0
        ? Math.trunc(params.profileId)
        : null,
    iat: now,
    exp: now + ttlSeconds * 1000,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = signPayload(payloadB64)
  return `${payloadB64}.${sigB64}`
}

export function readCustomOwnerSponsorshipToken(
  token: string | null | undefined,
): DecodedCustomOwnerSponsorshipToken | null {
  const raw = typeof token === 'string' ? token.trim() : ''
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expectedSig = signPayload(payloadB64)
  try {
    const a = Buffer.from(sigB64, 'utf8')
    const b = Buffer.from(expectedSig, 'utf8')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  const payloadRaw = base64UrlDecode(payloadB64)
  if (!payloadRaw) return null

  let parsed: CustomOwnerSponsorshipTokenPayload
  try {
    parsed = JSON.parse(payloadRaw) as CustomOwnerSponsorshipTokenPayload
  } catch {
    return null
  }
  if (parsed?.v !== 'coo1') return null
  if (typeof parsed.iat !== 'number' || typeof parsed.exp !== 'number') return null
  if (parsed.exp < Date.now()) return null

  const sessionAddress = normalizeAddress(parsed.sa)
  const smartWalletAddress = normalizeAddress(parsed.sw)
  const ownerToAdd = normalizeAddress(parsed.oa)
  const profileId =
    typeof parsed.pid === 'number' && Number.isFinite(parsed.pid) && parsed.pid > 0 ? Math.trunc(parsed.pid) : null

  return {
    sessionAddress,
    smartWalletAddress,
    ownerToAdd,
    profileId,
    issuedAtMs: parsed.iat,
    expiresAtMs: parsed.exp,
  }
}
