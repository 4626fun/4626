#!/usr/bin/env node
/**
 * Delete orphan Privy wallet + key quorum (dry-run by default).
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/delete-privy-orphan-quorum.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/delete-privy-orphan-quorum.ts --apply
 *
 * Optional:
 *   --authorization-key-env <ENV_NAME>  default PRIVY_WALLET_AUTHORIZATION_KEY
 *                                       (alfaclub quorum needs its own key — see docs)
 */

import { createPrivateKey, sign } from 'node:crypto'

const PRIVY_API_ORIGIN = 'https://api.privy.io'
const DEFAULT_WALLET_ID = 'l6zzzn135ig2w0y44r1ycq19'
const DEFAULT_QUORUM_ID = 'iugbyquej8u2oe80w6ox9kfv'

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  const value = process.argv[idx + 1]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function requireEnv(key: string): string {
  const value = String(process.env[key] ?? '').trim()
  if (!value) throw new Error(`${key} missing`)
  return value
}

function basicAuthHeader(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`, 'utf8').toString('base64')}`
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
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableCanonicalize(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(String(value))
}

function authorizationSignature(params: {
  method: 'DELETE' | 'PATCH'
  url: string
  body: unknown
  appId: string
  authorizationKeyEnv?: string
}): string | null {
  const envName = params.authorizationKeyEnv ?? 'PRIVY_WALLET_AUTHORIZATION_KEY'
  const raw = String(process.env[envName] ?? '').trim()
  if (!raw) return null
  const b64 = raw.replace(/^wallet-auth:/, '').trim()
  if (!b64) return null

  const payload = {
    version: 1,
    method: params.method,
    url: normalizePrivyUrl(params.url),
    body: params.body ?? {},
    headers: { 'privy-app-id': params.appId },
  }
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
  const key = createPrivateKey({ key: keyPem, format: 'pem' })
  return sign('sha256', Buffer.from(stableCanonicalize(payload), 'utf8'), key).toString('base64')
}

async function privyRequest(params: {
  method: 'GET' | 'DELETE'
  path: string
  authorizationKeyEnv?: string
}): Promise<{ status: number; body: string }> {
  const appId = requireEnv('PRIVY_APP_ID')
  const appSecret = requireEnv('PRIVY_APP_SECRET')
  const url = `${PRIVY_API_ORIGIN}${params.path}`
  const headers: Record<string, string> = {
    'privy-app-id': appId,
    Authorization: basicAuthHeader(appId, appSecret),
  }
  if (params.method === 'DELETE') {
    const sig = authorizationSignature({
      method: 'DELETE',
      url,
      body: {},
      appId,
      authorizationKeyEnv: params.authorizationKeyEnv,
    })
    if (sig) headers['privy-authorization-signature'] = sig
  }

  const res = await fetch(url, { method: params.method, headers })
  return { status: res.status, body: await res.text() }
}

async function main() {
  const apply = hasFlag('--apply')
  const dryRun = hasFlag('--dry-run') || !apply
  const walletId = getArg('--wallet-id', DEFAULT_WALLET_ID)
  const quorumId = getArg('--quorum-id', DEFAULT_QUORUM_ID)

  const walletGet = await privyRequest({ method: 'GET', path: `/v1/wallets/${encodeURIComponent(walletId)}` })
  const quorumGet = await privyRequest({ method: 'GET', path: `/v1/key_quorums/${encodeURIComponent(quorumId)}` })

  console.log('wallet GET', walletGet.status, walletGet.body.slice(0, 500))
  console.log('quorum GET', quorumGet.status, quorumGet.body.slice(0, 500))

  if (dryRun) {
    console.log('\nDry run — would DELETE wallet then key quorum. Re-run with --apply.')
    return
  }

  const walletDelete = await privyRequest({
    method: 'DELETE',
    path: `/v1/wallets/${encodeURIComponent(walletId)}`,
    authorizationKeyEnv: getArg('--authorization-key-env', 'PRIVY_WALLET_AUTHORIZATION_KEY'),
  })
  console.log('\nwallet DELETE', walletDelete.status, walletDelete.body.slice(0, 800))
  if (walletDelete.status !== 200 && walletDelete.status !== 204 && walletDelete.status !== 404) {
    throw new Error(`wallet delete failed: ${walletDelete.status}`)
  }

  const quorumDelete = await privyRequest({
    method: 'DELETE',
    path: `/v1/key_quorums/${encodeURIComponent(quorumId)}`,
    authorizationKeyEnv: getArg('--authorization-key-env', 'PRIVY_WALLET_AUTHORIZATION_KEY'),
  })
  console.log('quorum DELETE', quorumDelete.status, quorumDelete.body.slice(0, 800))
  if (quorumDelete.status !== 200 && quorumDelete.status !== 204 && quorumDelete.status !== 404) {
    throw new Error(`quorum delete failed: ${quorumDelete.status}`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
