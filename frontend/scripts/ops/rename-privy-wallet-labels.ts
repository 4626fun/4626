#!/usr/bin/env node
/**
 * Rename Privy dashboard labels to match 4626 wallet lanes.
 *
 * Does NOT rotate IDs or change env vars — only human-readable names in Privy.
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/rename-privy-wallet-labels.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/rename-privy-wallet-labels.ts --apply
 *
 * Optional overrides:
 *   --owner-id <key_quorum_id>
 *   --policy-id <policy_id>
 *   --agent-wallet-id <wallet_id>   (default: qka29gnn1to96pji6kw2qcq0 / 0xfB11237…)
 */

import { createPrivateKey, sign } from 'node:crypto'

/** Canonical Privy dashboard labels — keep in sync with docs/operations/privy-wallet-lanes.md */
export const PRIVY_CANONICAL_LABELS = {
  serverAgentOwnerDisplayName: '4626 Server Agent Owner',
  agentWalletPolicyName: '4626 Agent Wallet Policy',
  agentSignerWalletDisplayName: '4626 Agent Signer (server)',
  xmtpAgentWalletDisplayName: '4626 XMTP Agent Signer',
} as const

const PRIVY_API_ORIGIN = 'https://api.privy.io'
const DEFAULT_OWNER_ID = 'lr8vgu2l0wnmwg824n4jrtr3'
const DEFAULT_POLICY_ID = 'a7vgzko1jhidbaqqg1whufnc'
const DEFAULT_AGENT_WALLET_ID = 'qka29gnn1to96pji6kw2qcq0'
const DEFAULT_XMTP_WALLET_ID = 'wyji2bc8j6sfcu5nilf4325h'

type PlannedChange = {
  resource: string
  id: string
  field: string
  from: string | null
  to: string
}

function getArg(flag: string, fallback: string | null = null): string | null {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return fallback
  const value = process.argv[idx + 1]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
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
  method: 'PATCH'
  url: string
  body: unknown
  appId: string
}): string | null {
  const raw = String(process.env.PRIVY_WALLET_AUTHORIZATION_KEY ?? '').trim()
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

async function privyJson<T>(params: {
  method: 'GET' | 'PATCH'
  path: string
  body?: unknown
}): Promise<T> {
  const appId = requireEnv('PRIVY_APP_ID')
  const appSecret = requireEnv('PRIVY_APP_SECRET')
  const url = `${PRIVY_API_ORIGIN}${params.path}`
  const headers: Record<string, string> = {
    'privy-app-id': appId,
    Authorization: basicAuthHeader(appId, appSecret),
  }
  if (params.method === 'PATCH') {
    headers['Content-Type'] = 'application/json'
    const sig = authorizationSignature({ method: 'PATCH', url, body: params.body ?? {}, appId })
    if (sig) headers['privy-authorization-signature'] = sig
  }

  const res = await fetch(url, {
    method: params.method,
    headers,
    body: params.method === 'PATCH' ? JSON.stringify(params.body ?? {}) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`privy_http_${res.status}: ${text.slice(0, 800)}`)
  return JSON.parse(text) as T
}

async function planChanges(): Promise<PlannedChange[]> {
  const ownerId = getArg('--owner-id', process.env.PRIVY_WALLET_OWNER_ID?.trim() || DEFAULT_OWNER_ID)!
  const policyId = getArg('--policy-id', process.env.PRIVY_WALLET_POLICY_ID?.trim() || DEFAULT_POLICY_ID)!
  const agentWalletId = getArg('--agent-wallet-id', DEFAULT_AGENT_WALLET_ID)!
  const xmtpWalletId = getArg(
    '--xmtp-wallet-id',
    process.env.CANONICAL_CSW_PRIVY_WALLET_ID?.trim() ||
      process.env.XMTP_AGENT_PRIVY_WALLET_ID?.trim() ||
      DEFAULT_XMTP_WALLET_ID,
  )!

  const planned: PlannedChange[] = []

  const quorum = await privyJson<{ id: string; display_name?: string | null }>({
    method: 'GET',
    path: `/v1/key_quorums/${encodeURIComponent(ownerId)}`,
  })
  if ((quorum.display_name ?? null) !== PRIVY_CANONICAL_LABELS.serverAgentOwnerDisplayName) {
    planned.push({
      resource: 'key_quorum',
      id: ownerId,
      field: 'display_name',
      from: quorum.display_name ?? null,
      to: PRIVY_CANONICAL_LABELS.serverAgentOwnerDisplayName,
    })
  }

  const policy = await privyJson<{ id: string; name?: string | null }>({
    method: 'GET',
    path: `/v1/policies/${encodeURIComponent(policyId)}`,
  })
  if ((policy.name ?? null) !== PRIVY_CANONICAL_LABELS.agentWalletPolicyName) {
    planned.push({
      resource: 'policy',
      id: policyId,
      field: 'name',
      from: policy.name ?? null,
      to: PRIVY_CANONICAL_LABELS.agentWalletPolicyName,
    })
  }

  const agentWallet = await privyJson<{ id: string; display_name?: string | null; address?: string }>({
    method: 'GET',
    path: `/v1/wallets/${encodeURIComponent(agentWalletId)}`,
  })
  if ((agentWallet.display_name ?? null) !== PRIVY_CANONICAL_LABELS.agentSignerWalletDisplayName) {
    planned.push({
      resource: 'wallet',
      id: agentWalletId,
      field: 'display_name',
      from: agentWallet.display_name ?? null,
      to: PRIVY_CANONICAL_LABELS.agentSignerWalletDisplayName,
    })
  }

  const xmtpWallet = await privyJson<{ id: string; display_name?: string | null; address?: string }>({
    method: 'GET',
    path: `/v1/wallets/${encodeURIComponent(xmtpWalletId)}`,
  })
  if ((xmtpWallet.display_name ?? null) !== PRIVY_CANONICAL_LABELS.xmtpAgentWalletDisplayName) {
    planned.push({
      resource: 'wallet',
      id: xmtpWalletId,
      field: 'display_name',
      from: xmtpWallet.display_name ?? null,
      to: PRIVY_CANONICAL_LABELS.xmtpAgentWalletDisplayName,
    })
  }

  return planned
}

async function applyChange(change: PlannedChange): Promise<void> {
  if (change.resource === 'key_quorum') {
    await privyJson({
      method: 'PATCH',
      path: `/v1/key_quorums/${encodeURIComponent(change.id)}`,
      body: { display_name: change.to },
    })
    return
  }
  if (change.resource === 'policy') {
    await privyJson({
      method: 'PATCH',
      path: `/v1/policies/${encodeURIComponent(change.id)}`,
      body: { name: change.to },
    })
    return
  }
  if (change.resource === 'wallet') {
    await privyJson({
      method: 'PATCH',
      path: `/v1/wallets/${encodeURIComponent(change.id)}`,
      body: { display_name: change.to },
    })
    return
  }
  throw new Error(`unknown resource ${change.resource}`)
}

async function main() {
  const apply = hasFlag('--apply')
  const dryRun = hasFlag('--dry-run') || !apply
  if (!dryRun && !apply) {
    console.error('Pass --dry-run or --apply')
    process.exit(1)
  }

  const planned = await planChanges()
  if (planned.length === 0) {
    console.log('All Privy labels already match canonical names.')
    return
  }

  console.log(`${dryRun ? 'Planned' : 'Applying'} ${planned.length} Privy label update(s):`)
  for (const change of planned) {
    console.log(`- ${change.resource} ${change.id}: ${change.field} "${change.from ?? '(empty)'}" -> "${change.to}"`)
  }

  if (dryRun) {
    console.log('\nRe-run with --apply to write these names to Privy.')
    return
  }

  for (const change of planned) {
    await applyChange(change)
    console.log(`updated ${change.resource} ${change.id}`)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
