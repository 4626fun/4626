import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAddress, isAddress, type Address } from 'viem'

declare const process: { env: Record<string, string | undefined> }

const ACTIVATION_PURPOSE = 'enable_4626_server_owner' as const
const DEFAULT_TTL_SECONDS = 10 * 60

type ActivationOwnerTokenPayload = {
  v: 'act1'
  uid: string
  pid: number
  sa: string
  sw: string
  ew: string
  ow: string
  purpose: typeof ACTIVATION_PURPOSE
  iat: number
  exp: number
}

export type DecodedActivationOwnerToken = {
  privyUserId: string
  profileId: number
  sessionAddress: Address
  smartWalletAddress: Address
  embeddedOwnerAddress: Address
  serverOwnerAddress: Address
  purpose: typeof ACTIVATION_PURPOSE
  issuedAtMs: number
  expiresAtMs: number
}

function tokenSecret(): Buffer {
  const secret = String(process.env.AUTH_SESSION_SECRET ?? '').trim()
  if (secret.length < 16) throw new Error('AUTH_SESSION_SECRET missing_or_too_short')
  return createHmac('sha256', secret)
    .update('4626:activation-owner-policy:v1', 'utf8')
    .digest()
}

function encodeBase64Url(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  return buffer.toString('base64url')
}

function sign(payload: string): string {
  return encodeBase64Url(createHmac('sha256', tokenSecret()).update(payload, 'utf8').digest())
}

function normalizeAddress(value: string): Address {
  if (!isAddress(value)) throw new Error('invalid_activation_address')
  return getAddress(value)
}

export function issueActivationOwnerToken(params: {
  privyUserId: string
  profileId: number
  sessionAddress: Address
  smartWalletAddress: Address
  embeddedOwnerAddress: Address
  serverOwnerAddress: Address
  ttlSeconds?: number
  nowMs?: number
}): string {
  const now = params.nowMs ?? Date.now()
  const ttlSeconds =
    typeof params.ttlSeconds === 'number' &&
    Number.isFinite(params.ttlSeconds) &&
    params.ttlSeconds > 0
      ? Math.floor(params.ttlSeconds)
      : DEFAULT_TTL_SECONDS
  const payload: ActivationOwnerTokenPayload = {
    v: 'act1',
    uid: String(params.privyUserId).trim(),
    pid: Math.trunc(params.profileId),
    sa: normalizeAddress(params.sessionAddress).toLowerCase(),
    sw: normalizeAddress(params.smartWalletAddress).toLowerCase(),
    ew: normalizeAddress(params.embeddedOwnerAddress).toLowerCase(),
    ow: normalizeAddress(params.serverOwnerAddress).toLowerCase(),
    purpose: ACTIVATION_PURPOSE,
    iat: now,
    exp: now + ttlSeconds * 1000,
  }
  if (!payload.uid || payload.pid <= 0) throw new Error('invalid_activation_identity')
  const encoded = encodeBase64Url(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

export function readActivationOwnerToken(
  token: string | null | undefined,
  nowMs = Date.now(),
): DecodedActivationOwnerToken | null {
  const [payloadPart, signaturePart, extra] = String(token ?? '').trim().split('.')
  if (!payloadPart || !signaturePart || extra) return null
  const expected = sign(payloadPart)
  const actualBuffer = Buffer.from(signaturePart, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }

  let payload: ActivationOwnerTokenPayload
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (
    payload?.v !== 'act1' ||
    payload.purpose !== ACTIVATION_PURPOSE ||
    !payload.uid ||
    !Number.isFinite(payload.pid) ||
    payload.pid <= 0 ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp) ||
    payload.exp < nowMs
  ) {
    return null
  }
  try {
    return {
      privyUserId: payload.uid,
      profileId: Math.trunc(payload.pid),
      sessionAddress: normalizeAddress(payload.sa),
      smartWalletAddress: normalizeAddress(payload.sw),
      embeddedOwnerAddress: normalizeAddress(payload.ew),
      serverOwnerAddress: normalizeAddress(payload.ow),
      purpose: ACTIVATION_PURPOSE,
      issuedAtMs: payload.iat,
      expiresAtMs: payload.exp,
    }
  } catch {
    return null
  }
}
