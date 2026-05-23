import { createPrivateKey, sign } from 'node:crypto'
import { assertTeeAttestationOrThrow } from '../agent/teeAttestationGate.js'

declare const process: { env: Record<string, string | undefined> }

const PRIVY_API_ORIGIN = 'https://api.privy.io'

/**
 * CAIP-2 chain identifiers for Privy wallet RPC calls.
 *
 * Privy's /v1/wallets/{id}/rpc endpoint requires a top-level `caip2` field for
 * chain-action RPC methods (notably `eth_sendTransaction`). Raw signing methods
 * (`secp256k1_sign`, `personal_sign`, `eth_signTypedData_v4`) do not require it.
 *
 * Docs: https://docs.privy.io/api-reference/wallets/ethereum/eth-send-transaction
 */
export const BASE_CAIP2 = 'eip155:8453' as const
export type Caip2 = `eip155:${number}`

type PrivyWallet = {
  id: string
  address: string
  chain_type: 'ethereum' | string
  policy_ids: string[]
  owner_id: string | null
}

function requireEnv(key: string): string {
  const v = (process.env[key] ?? '').trim()
  if (!v) throw new Error(`${key} missing`)
  return v
}

function optionalEnv(key: string): string | null {
  const v = (process.env[key] ?? '').trim()
  return v ? v : null
}

function basicAuthHeader(appId: string, appSecret: string): string {
  const token = Buffer.from(`${appId}:${appSecret}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

function normalizePrivyUrl(url: string): string {
  // Privy signature payload requires full URL without trailing slash.
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function stableCanonicalize(value: unknown): string {
  // Deterministic JSON serialization (RFC8785-ish): recursively sort object keys.
  // This is sufficient for our simple signature payloads (strings, objects, arrays).
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null'
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableCanonicalize).join(',')}]`
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalize(obj[k])}`)
    return `{${parts.join(',')}}`
  }
  // functions/symbols/etc are not valid in JSON signature payloads
  return JSON.stringify(String(value))
}

function getAuthorizationKeyPrivateKeyPem(): string {
  // Privy authorization keys are provided as PKCS#8 base64 with `wallet-auth:` prefix.
  const raw = requireEnv('PRIVY_WALLET_AUTHORIZATION_KEY')
  const b64 = raw.replace(/^wallet-auth:/, '').trim()
  if (!b64) throw new Error('PRIVY_WALLET_AUTHORIZATION_KEY invalid')
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
}

function getPrivyAuth(): { appId: string; appSecret: string } {
  // Reuse the same env vars we already use for Privy server-auth.
  const appId = requireEnv('PRIVY_APP_ID')
  const appSecret = requireEnv('PRIVY_APP_SECRET')
  return { appId, appSecret }
}

function getPrivyOwnerId(): string {
  // Key quorum for server agent wallets — dashboard label: "4626 Server Agent Owner".
  return requireEnv('PRIVY_WALLET_OWNER_ID')
}

function getPrivyPolicyId(): string | null {
  return optionalEnv('PRIVY_WALLET_POLICY_ID')
}

function requirePrivyPolicyId(): string | null {
  const id = getPrivyPolicyId()
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isProd = nodeEnv === 'production' || Boolean((process.env.VERCEL ?? '').trim())
  if (isProd && !id) {
    throw new Error('PRIVY_WALLET_POLICY_ID missing in production')
  }
  return id
}

function makePrivyAuthorizationSignature(params: {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body: unknown
  privyHeaders: Record<string, string>
}): string {
  const payload = {
    version: 1,
    method: params.method,
    url: normalizePrivyUrl(params.url),
    body: params.body ?? {},
    headers: params.privyHeaders,
  }

  const serialized = stableCanonicalize(payload)
  const keyPem = getAuthorizationKeyPrivateKeyPem()
  const key = createPrivateKey({ key: keyPem, format: 'pem' })
  const sig = sign('sha256', Buffer.from(serialized, 'utf8'), key)
  return sig.toString('base64')
}

async function privyFetchJson<T>(params: {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body: unknown
  idempotencyKey?: string
}): Promise<T> {
  const { appId, appSecret } = getPrivyAuth()
  const url = `${PRIVY_API_ORIGIN}${params.path}`

  const privyHeaders: Record<string, string> = { 'privy-app-id': appId }
  if (params.idempotencyKey) privyHeaders['privy-idempotency-key'] = params.idempotencyKey

  const authSig = makePrivyAuthorizationSignature({
    method: params.method,
    url,
    body: params.body,
    privyHeaders,
  })

  const res = await fetch(url, {
    method: params.method,
    headers: {
      ...privyHeaders,
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(appId, appSecret),
      'privy-authorization-signature': authSig,
    },
    body: JSON.stringify(params.body ?? {}),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`privy_http_${res.status}: ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`privy_non_json_response: ${text.slice(0, 500)}`)
  }
}

async function privyGetJson<T>(path: string): Promise<T> {
  const { appId, appSecret } = getPrivyAuth()
  const url = `${PRIVY_API_ORIGIN}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'privy-app-id': appId,
      Authorization: basicAuthHeader(appId, appSecret),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`privy_http_${res.status}: ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`privy_non_json_response: ${text.slice(0, 500)}`)
  }
}

export async function createAgentWallet(params?: { idempotencyKey?: string }): Promise<{ walletId: string; address: `0x${string}` }> {
  const ownerId = getPrivyOwnerId()
  const policyId = requirePrivyPolicyId()

  const body: any = {
    chain_type: 'ethereum',
    owner_id: ownerId,
  }
  if (policyId) body.policy_ids = [policyId]

  const wallet = await privyFetchJson<PrivyWallet>({
    method: 'POST',
    path: '/v1/wallets',
    body,
    idempotencyKey: params?.idempotencyKey,
  })

  const addr = String(wallet?.address ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error('privy_create_wallet_invalid_address')
  return { walletId: String(wallet.id), address: addr.toLowerCase() as `0x${string}` }
}

export async function getWalletById(walletId: string): Promise<{ walletId: string; address: `0x${string}` }> {
  const normalizedWalletId = String(walletId ?? '').trim()
  if (!normalizedWalletId) throw new Error('privy_wallet_id_missing')
  const wallet = await privyGetJson<PrivyWallet>(`/v1/wallets/${encodeURIComponent(normalizedWalletId)}`)
  const addr = String(wallet?.address ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error('privy_wallet_invalid_address')
  return { walletId: String(wallet.id), address: addr.toLowerCase() as `0x${string}` }
}

export async function walletRpc<T>(params: {
  walletId: string
  method: string
  rpcParams: any
  /**
   * CAIP-2 chain identifier (e.g. 'eip155:8453' for Base).
   *
   * REQUIRED by Privy for chain-action RPC methods such as `eth_sendTransaction`.
   * Optional for raw signing methods (`secp256k1_sign`, `personal_sign`,
   * `eth_signTypedData_v4`). When omitted, the field is not sent in the body.
   */
  caip2?: Caip2
  chainType?: 'ethereum' | 'solana'
  idempotencyKey?: string
  teeContext?: {
    action?: string
    actorAddress?: string
    metadata?: Record<string, unknown>
  }
}): Promise<T> {
  // FIX: FINDING-17 — TEE attestation is invoked on every signing operation with no caching.
  // Consider caching successful attestations with a short TTL (e.g., 30s) to reduce
  // per-operation latency while maintaining security guarantees. Add monitoring/alerting
  // on attestation failures; a persistent service outage blocks all vault deployments.
  await assertTeeAttestationOrThrow({
    action: params.teeContext?.action ?? `privy_wallet_rpc:${params.method}`,
    actorAddress: params.teeContext?.actorAddress,
    metadata: {
      walletId: params.walletId,
      chainType: params.chainType ?? 'ethereum',
      ...(params.teeContext?.metadata ?? {}),
    },
  })

  const body: Record<string, unknown> = {
    method: params.method,
    params: params.rpcParams,
    chain_type: params.chainType ?? 'ethereum',
  }
  // Only include caip2 when provided — Privy rejects requests missing it for
  // chain-action methods (e.g. eth_sendTransaction), but signing methods must
  // not send it. See Privy API reference linked above.
  if (params.caip2) body.caip2 = params.caip2
  return await privyFetchJson<T>({
    method: 'POST',
    path: `/v1/wallets/${encodeURIComponent(params.walletId)}/rpc`,
    body,
    idempotencyKey: params.idempotencyKey,
  })
}

/**
 * Full Privy wallet record including delegation state.
 * Returned by GET /v1/wallets/{id}.
 */
export type PrivyWalletFull = {
  id: string
  address: string
  chain_type: 'ethereum' | string
  additional_signers: Array<{ signer_id?: string; id?: string } | string>
  owner_id: string | null
  policy_ids: string[]
}

/**
 * Fetch the full Privy wallet record for `walletId`, including
 * `additional_signers` which is needed to verify delegation quorum membership.
 * Returns null if Privy responds with 404 (wallet not found).
 */
export async function fetchPrivyWalletFull(walletId: string): Promise<PrivyWalletFull | null> {
  const normalized = String(walletId ?? '').trim()
  if (!normalized) throw new Error('privy_wallet_id_missing')
  const { appId, appSecret } = getPrivyAuth()
  const url = `${PRIVY_API_ORIGIN}/v1/wallets/${encodeURIComponent(normalized)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'privy-app-id': appId,
      Authorization: basicAuthHeader(appId, appSecret),
    },
  })
  if (res.status === 404) return null
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`privy_http_${res.status}: ${text.slice(0, 500)}`)
  }
  try {
    const body = JSON.parse(text) as PrivyWalletFull
    if (!body || typeof body !== 'object') throw new Error('privy_wallet_full_invalid_body')
    if (!Array.isArray(body.additional_signers)) body.additional_signers = []
    if (!Array.isArray(body.policy_ids)) body.policy_ids = []
    return body
  } catch {
    throw new Error(`privy_non_json_response: ${text.slice(0, 500)}`)
  }
}

export async function secp256k1SignHash(params: { walletId: string; hash: `0x${string}`; idempotencyKey?: string }): Promise<`0x${string}`> {
  const res = await walletRpc<any>({
    walletId: params.walletId,
    method: 'secp256k1_sign',
    rpcParams: { hash: params.hash },
    idempotencyKey: params.idempotencyKey,
    teeContext: {
      action: 'privy_wallet_rpc:secp256k1_sign',
    },
  })
  const sig = String(res?.data?.signature ?? '').trim()
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('privy_secp256k1_sign_invalid_signature')
  return sig as `0x${string}`
}
