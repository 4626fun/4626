import { getAccessToken } from '@privy-io/react-auth'
import type { Hex } from 'viem'

import { getPrivyApiUrl, getPrivyAppId } from '@/lib/flags/flags'
import { resolveEffectivePrivyClientId } from '@/lib/flags/featureFlags'
import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'
import { assertPrivySessionMarkerCookie } from '@/lib/privy/loopbackSessionMarkerShim'

const RAW_DIGEST_RE = /^0x[0-9a-fA-F]{64}$/

export type PrivyAuthorizationSignatureGenerator = (input: {
  version: 1
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body: Record<string, unknown>
  headers: {
    'privy-app-id': string
    'privy-idempotency-key'?: string
  }
}) => Promise<{ signature: string }>

function walletRpcPath(walletId: string): string {
  return `/api/v1/wallets/${walletId}/rpc`
}

function isPrivyProxyHost(host: string): boolean {
  return host === 'privy.4626.fun' || host === 'privy.app.4626.fun'
}

function resolvePrivyWalletRpcBaseUrl(): string {
  const resolved = (getPrivyApiUrl() ?? 'https://auth.privy.io').replace(/\/$/, '')
  // Wallet RPC auth-signature verification can fail behind first-party proxy hosts
  // when upstream verification canonicalizes against auth.privy.io URL forms.
  // Keep session/bootstrap traffic on custom domains, but pin this signing lane
  // to the canonical Privy origin whenever we're on the 4626 proxy host family.
  try {
    const parsed = new URL(resolved)
    if (isPrivyProxyHost(parsed.hostname.toLowerCase())) {
      return 'https://auth.privy.io'
    }
    return parsed.origin
  } catch {
    return 'https://auth.privy.io'
  }
}

/**
 * Custom-auth-domain base (e.g. https://privy.4626.fun) when configured.
 * In server-cookie mode the Privy session lives in an HttpOnly cookie scoped
 * to this host, so bearer-only requests to auth.privy.io can 401 with
 * "Missing auth token" while the same request authenticates via cookie here.
 */
function resolvePrivyProxyBaseUrl(): string | null {
  const resolved = (getPrivyApiUrl() ?? '').replace(/\/$/, '')
  if (!resolved) return null
  try {
    const parsed = new URL(resolved)
    return isPrivyProxyHost(parsed.hostname.toLowerCase()) ? parsed.origin : null
  } catch {
    return null
  }
}

/** Full request URL for Wallet API RPC — must match fetch target and auth-signature payload. */
export function resolvePrivyWalletRpcAuthorizationUrl(walletId: string): string {
  const id = String(walletId ?? '').trim()
  if (!id) {
    throw new Error('Privy wallet id is required for wallet RPC authorization URL.')
  }
  const apiBase = resolvePrivyWalletRpcBaseUrl()
  return `${apiBase}${walletRpcPath(id)}`
}

function parseWalletRpcSignature(payload: unknown, context: string): Hex {
  if (typeof payload === 'string' && /^0x[0-9a-fA-F]+$/.test(payload)) {
    return payload as Hex
  }
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const data = record?.data
  if (data && typeof data === 'object') {
    const signature = (data as Record<string, unknown>).signature
    if (typeof signature === 'string' && /^0x[0-9a-fA-F]+$/.test(signature)) {
      return signature as Hex
    }
  }
  const direct = record?.signature
  if (typeof direct === 'string' && /^0x[0-9a-fA-F]+$/.test(direct)) {
    return direct as Hex
  }
  throw new Error(`Invalid signature returned from ${context}`)
}

async function postAuthorizedWalletRpc(params: {
  walletId: string
  body: Record<string, unknown>
  generateAuthorizationSignature: PrivyAuthorizationSignatureGenerator
  getToken?: () => Promise<string | null>
  refreshSession?: () => Promise<unknown>
  context: string
}): Promise<Hex> {
  if (typeof params.refreshSession === 'function') {
    await params.refreshSession().catch(() => null)
  }

  const appId = getPrivyAppId()
  if (!appId) {
    throw new Error('Privy app id is not configured.')
  }

  // On localhost/loopback, getAccessToken() requires a readable first-party
  // `privy-session` marker cookie before it returns a token — assert it right
  // before this read (same pattern as refreshPrivyEmbeddedSignerSession).
  // Without this, an otherwise-live session can spuriously read back `null`
  // here (e.g. XMTP inbox personal_sign) even though `privy.authenticated`
  // and other reads elsewhere succeeded moments earlier.
  assertPrivySessionMarkerCookie()

  const getToken = params.getToken ?? getAccessToken
  const accessToken = await getToken()
  if (!accessToken) {
    throw new Error('Privy access token missing — sign in again with email OTP.')
  }

  const rpcAuthorizationUrl = resolvePrivyWalletRpcAuthorizationUrl(params.walletId)

  const { signature: authorizationSignature } = await params.generateAuthorizationSignature({
    version: 1,
    method: 'POST',
    url: rpcAuthorizationUrl,
    body: params.body,
    headers: { 'privy-app-id': appId },
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'privy-app-id': appId,
    Authorization: `Bearer ${accessToken}`,
    'privy-authorization-signature': authorizationSignature,
  }
  // Apps configured with an app client issue access tokens bound to that
  // client context. Privy verifies the bearer against the client id, so
  // omitting this header makes valid tokens fail as "Missing auth token."
  const clientId = resolveEffectivePrivyClientId()
  if (clientId) {
    headers['privy-client-id'] = clientId
  }

  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(params.body),
  }

  let response = await fetch(rpcAuthorizationUrl, requestInit)

  // Bearer verification can fail at auth.privy.io when the session was issued
  // through the first-party proxy (server-cookie mode). The proxy host holds
  // the HttpOnly session cookies, so retry there. The authorization signature
  // stays canonicalized against the auth.privy.io URL form, which is what
  // upstream verification expects even for proxied requests.
  if (response.status === 401) {
    const proxyBase = resolvePrivyProxyBaseUrl()
    if (proxyBase && !rpcAuthorizationUrl.startsWith(proxyBase)) {
      const proxyUrl = `${proxyBase}${walletRpcPath(params.walletId)}`
      console.warn(
        `[privy-authorized-rpc] ${params.context} got 401 at canonical origin, retrying via first-party proxy`,
      )
      response = await fetch(proxyUrl, requestInit)
    }
  }

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Privy wallet ${params.context} failed (${response.status}): ${responseText.slice(0, 400)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new Error(`Privy wallet ${params.context} returned a non-JSON response.`)
  }

  return parseWalletRpcSignature(parsed, params.context)
}

/**
 * Privy unified-stack wallets with an `owner_id` require a user authorization
 * signature on Wallet API RPC calls. Mirrors `@privy-io/js-sdk-core` wallet RPC.
 */
export async function privyAuthorizedWalletSecp256k1Sign(params: {
  walletId: string
  hash: Hex
  generateAuthorizationSignature: PrivyAuthorizationSignatureGenerator
  getToken?: () => Promise<string | null>
  refreshSession?: () => Promise<unknown>
}): Promise<Hex> {
  const walletId = String(params.walletId ?? '').trim()
  if (!walletId) {
    throw new Error('Privy wallet id is required for authorized secp256k1 signing.')
  }
  if (!RAW_DIGEST_RE.test(String(params.hash ?? ''))) {
    throw new Error('Privy secp256k1_sign requires a 32-byte digest hash (0x + 64 hex chars).')
  }

  return postAuthorizedWalletRpc({
    walletId,
    body: {
      chain_type: 'ethereum',
      method: 'secp256k1_sign',
      params: { hash: params.hash },
    },
    generateAuthorizationSignature: params.generateAuthorizationSignature,
    getToken: params.getToken,
    refreshSession: params.refreshSession,
    context: 'secp256k1_sign',
  })
}

/**
 * EIP-191 personal_sign via the Privy Wallet API with a user authorization
 * signature. Needed for unified-stack (owner_id) embedded wallets where the
 * SDK's own personal_sign path 401s with "No valid authorization signatures"
 * (e.g. XMTP inbox registration on /waitlist). Accepts the hex-encoded
 * message exactly as EIP-1193 `personal_sign` transports it.
 */
export async function privyAuthorizedWalletPersonalSign(params: {
  walletId: string
  /** 0x-prefixed hex-encoded message bytes (EIP-1193 personal_sign param form). */
  messageHex: string
  generateAuthorizationSignature: PrivyAuthorizationSignatureGenerator
  getToken?: () => Promise<string | null>
  refreshSession?: () => Promise<unknown>
}): Promise<Hex> {
  const walletId = String(params.walletId ?? '').trim()
  if (!walletId) {
    throw new Error('Privy wallet id is required for authorized personal_sign.')
  }
  const messageHex = String(params.messageHex ?? '').trim()
  if (!/^0x[0-9a-fA-F]*$/.test(messageHex)) {
    throw new Error('Privy personal_sign requires a 0x-prefixed hex-encoded message.')
  }

  return postAuthorizedWalletRpc({
    walletId,
    body: {
      chain_type: 'ethereum',
      method: 'personal_sign',
      params: {
        // Privy Wallet API hex encoding expects the digits without the 0x prefix.
        message: messageHex.slice(2),
        encoding: 'hex',
      },
    },
    generateAuthorizationSignature: params.generateAuthorizationSignature,
    getToken: params.getToken,
    refreshSession: params.refreshSession,
    context: 'personal_sign',
  })
}

function normalizeTypedDataPayload(typedData: unknown): Record<string, unknown> {
  const record =
    typedData && typeof typedData === 'object' ? (typedData as Record<string, unknown>) : null
  if (!record) {
    throw new Error('Privy eth_signTypedData_v4 requires an object payload.')
  }

  const domain =
    record.domain && typeof record.domain === 'object'
      ? (record.domain as Record<string, unknown>)
      : null
  const message =
    record.message && typeof record.message === 'object'
      ? (record.message as Record<string, unknown>)
      : null
  const types =
    record.types && typeof record.types === 'object'
      ? (record.types as Record<string, unknown>)
      : null
  const primaryTypeRaw =
    typeof record.primary_type === 'string'
      ? record.primary_type
      : typeof record.primaryType === 'string'
      ? record.primaryType
      : null
  const primaryType = String(primaryTypeRaw ?? '').trim()

  if (!domain || !message || !types || !primaryType) {
    throw new Error(
      'Privy eth_signTypedData_v4 requires typed data with domain, message, types, and primaryType.',
    )
  }

  return {
    domain,
    message,
    types,
    primary_type: primaryType,
  }
}

/**
 * EIP-712 eth_signTypedData_v4 via Privy Wallet API with user authorization
 * signature. Unified-stack embedded wallets require this for wallet RPC calls.
 */
export async function privyAuthorizedWalletSignTypedData(params: {
  walletId: string
  typedData: unknown
  address?: string | null
  generateAuthorizationSignature: PrivyAuthorizationSignatureGenerator
  getToken?: () => Promise<string | null>
  refreshSession?: () => Promise<unknown>
}): Promise<Hex> {
  const walletId = String(params.walletId ?? '').trim()
  if (!walletId) {
    throw new Error('Privy wallet id is required for authorized eth_signTypedData_v4.')
  }
  const normalizedAddress = String(params.address ?? '').trim()
  const body: Record<string, unknown> = {
    chain_type: 'ethereum',
    method: 'eth_signTypedData_v4',
    params: {
      typed_data: normalizeTypedDataPayload(params.typedData),
    },
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(normalizedAddress)) {
    body.address = normalizedAddress
  }

  return postAuthorizedWalletRpc({
    walletId,
    body,
    generateAuthorizationSignature: params.generateAuthorizationSignature,
    getToken: params.getToken,
    refreshSession: params.refreshSession,
    context: 'eth_signTypedData_v4',
  })
}

export function resolvePrivyUnifiedWalletId(params: {
  wallet?: unknown
  user?: unknown
  address?: string | null
}): string | null {
  const walletRecord =
    params.wallet && typeof params.wallet === 'object' ? (params.wallet as Record<string, unknown>) : null
  const walletId = typeof walletRecord?.id === 'string' ? walletRecord.id.trim() : ''
  if (walletId) return walletId

  const targetAddress = String(params.address ?? walletRecord?.address ?? '')
    .trim()
    .toLowerCase()
  if (!targetAddress) return null

  const userRecord = params.user && typeof params.user === 'object' ? (params.user as Record<string, unknown>) : null
  const candidates: unknown[] = []
  if (userRecord?.wallet) candidates.push(userRecord.wallet)
  if (Array.isArray(userRecord?.wallets)) candidates.push(...userRecord.wallets)
  const linked = Array.isArray(userRecord?.linkedAccounts)
    ? userRecord.linkedAccounts
    : Array.isArray(userRecord?.linked_accounts)
      ? userRecord.linked_accounts
      : []
  candidates.push(...linked)

  for (const candidate of candidates) {
    const record = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : null
    if (!record) continue
    const address = String(record.address ?? '').trim().toLowerCase()
    if (address !== targetAddress) continue
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (id) return id
  }

  return null
}

export function isPrivyUnifiedStackWallet(wallet: unknown, user?: unknown): boolean {
  const record = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
  if (record) {
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (id) {
      const recoveryMethod = String(record.recovery_method ?? record.recoveryMethod ?? '')
        .trim()
        .toLowerCase()
      if (recoveryMethod === 'privy-v2') return true
      const ownerId = String(record.owner_id ?? record.ownerId ?? '').trim()
      if (ownerId.length > 0) return true
    }
  }

  const targetAddress = String(record?.address ?? '').trim().toLowerCase()
  if (!targetAddress) return false

  const userRecord = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  const candidates: unknown[] = []
  if (userRecord?.wallet) candidates.push(userRecord.wallet)
  if (Array.isArray(userRecord?.wallets)) candidates.push(...userRecord.wallets)
  const linked = Array.isArray(userRecord?.linkedAccounts)
    ? userRecord.linkedAccounts
    : Array.isArray(userRecord?.linked_accounts)
      ? userRecord.linked_accounts
      : []
  candidates.push(...linked)

  for (const candidate of candidates) {
    const linkedRecord = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : null
    if (!linkedRecord) continue
    const address = String(linkedRecord.address ?? '').trim().toLowerCase()
    if (address !== targetAddress) continue
    const recoveryMethod = String(linkedRecord.recovery_method ?? linkedRecord.recoveryMethod ?? '')
      .trim()
      .toLowerCase()
    if (recoveryMethod === 'privy-v2') return true
    const ownerId = String(linkedRecord.owner_id ?? linkedRecord.ownerId ?? '').trim()
    if (ownerId.length > 0) return true
  }

  return false
}

export async function refreshPrivyEmbeddedSignerSessionDefault(input: {
  wallet?: unknown
  setActiveWallet?: (wallet: unknown) => unknown | Promise<unknown>
  logLabel?: string
}): Promise<true> {
  return refreshPrivyEmbeddedSignerSession(input)
}
