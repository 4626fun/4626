import { getAccessToken } from '@privy-io/react-auth'
import type { Hex } from 'viem'

import { getPrivyApiUrl, getPrivyAppId } from '@/lib/flags/flags'
import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'

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

function resolvePrivyWalletRpcBaseUrl(): string {
  const resolved = (getPrivyApiUrl() ?? 'https://auth.privy.io').replace(/\/$/, '')
  // Wallet RPC auth-signature verification can fail behind first-party proxy hosts
  // when upstream verification canonicalizes against auth.privy.io URL forms.
  // Keep session/bootstrap traffic on custom domains, but pin this signing lane
  // to the canonical Privy origin whenever we're on the 4626 proxy host family.
  try {
    const parsed = new URL(resolved)
    const host = parsed.hostname.toLowerCase()
    if (host === 'privy.4626.fun' || host === 'privy.app.4626.fun') {
      return 'https://auth.privy.io'
    }
    return parsed.origin
  } catch {
    return 'https://auth.privy.io'
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

  if (typeof params.refreshSession === 'function') {
    await params.refreshSession().catch(() => null)
  }

  const appId = getPrivyAppId()
  if (!appId) {
    throw new Error('Privy app id is not configured.')
  }

  const getToken = params.getToken ?? getAccessToken
  const accessToken = await getToken()
  if (!accessToken) {
    throw new Error('Privy access token missing — sign in again with email OTP.')
  }

  const rpcAuthorizationUrl = resolvePrivyWalletRpcAuthorizationUrl(walletId)
  const body = {
    chain_type: 'ethereum',
    method: 'secp256k1_sign',
    params: { hash: params.hash },
  }

  const { signature: authorizationSignature } = await params.generateAuthorizationSignature({
    version: 1,
    method: 'POST',
    url: rpcAuthorizationUrl,
    body,
    headers: { 'privy-app-id': appId },
  })

  const response = await fetch(rpcAuthorizationUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'privy-app-id': appId,
      Authorization: `Bearer ${accessToken}`,
      'privy-authorization-signature': authorizationSignature,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(
      `Privy wallet secp256k1_sign failed (${response.status}): ${responseText.slice(0, 400)}`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new Error('Privy wallet secp256k1_sign returned a non-JSON response.')
  }

  return parseWalletRpcSignature(parsed, 'privyAuthorizedWalletSecp256k1Sign')
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
