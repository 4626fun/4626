import * as nodeCrypto from 'node:crypto'

const crypto = nodeCrypto as unknown as {
  createPrivateKey(key: unknown): unknown
  sign(algorithm: string, data: unknown, key: unknown): { toString(encoding: 'base64'): string }
}

declare const process: { env: Record<string, string | undefined> }

const PRIVY_API_ORIGIN = 'https://api.privy.io'

function requireEnv(key: string): string {
  const v = (process.env[key] ?? '').trim()
  if (!v) throw new Error(`${key} missing`)
  return v
}

function basicAuthHeader(appId: string, appSecret: string): string {
  const token = Buffer.from(`${appId}:${appSecret}`, 'utf8').toString('base64')
  return `Basic ${token}`
}

function normalizePrivyUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function stableCanonicalize(value: unknown): string {
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
  return JSON.stringify(String(value))
}

function getAuthorizationKeyPrivateKeyPem(): string {
  const raw = requireEnv('PRIVY_WALLET_AUTHORIZATION_KEY')
  const b64 = raw.replace(/^wallet-auth:/, '').trim()
  if (!b64) throw new Error('PRIVY_WALLET_AUTHORIZATION_KEY invalid')
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
}

function getPrivyAuth(): { appId: string; appSecret: string } {
  const appId = requireEnv('PRIVY_APP_ID')
  const appSecret = requireEnv('PRIVY_APP_SECRET')
  return { appId, appSecret }
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
  const key = crypto.createPrivateKey({ key: keyPem, format: 'pem' })
  const sig = crypto.sign('sha256', Buffer.from(serialized, 'utf8'), key)
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

export async function walletRpc<T>(params: {
  walletId: string
  method: string
  rpcParams: any
  idempotencyKey?: string
}): Promise<T> {
  const body = { method: params.method, params: params.rpcParams }
  return await privyFetchJson<T>({
    method: 'POST',
    path: `/v1/wallets/${encodeURIComponent(params.walletId)}/rpc`,
    body,
    idempotencyKey: params.idempotencyKey,
  })
}

export async function secp256k1SignHash(params: {
  walletId: string
  hash: `0x${string}`
  idempotencyKey?: string
}): Promise<`0x${string}`> {
  const res = await walletRpc<any>({
    walletId: params.walletId,
    method: 'secp256k1_sign',
    rpcParams: { hash: params.hash },
    idempotencyKey: params.idempotencyKey,
  })
  const sig = String(res?.data?.signature ?? '').trim()
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw new Error('privy_secp256k1_sign_invalid_signature')
  return sig as `0x${string}`
}
