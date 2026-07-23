#!/usr/bin/env tsx
/**
 * Read-only B2 provisioner readiness check.
 *
 * This intentionally requires the extended endpoint capability. B1's legacy
 * `/meteora-ixs` health is not sufficient to authorize hook/pool provisioning
 * or lottery settlement calls.
 */

import { pathToFileURL } from 'node:url'

type HealthPayload = Record<string, unknown>

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function provisionerSecret(): string {
  return env('SOLANA_HOOK_PROVISIONER_SECRET') ||
    env('SOLANA_METEORA_POOL_PROVISIONER_SECRET') ||
    env('METEORA_IX_PROVISIONER_SECRET')
}

function healthUrl(): string {
  const configured = env('SOLANA_PROVISIONER_HEALTH_URL') ||
    env('SOLANA_HOOK_PROVISIONER_URL') ||
    env('SOLANA_METEORA_POOL_PROVISIONER_URL')
  if (!configured) return ''
  try {
    return new URL('/healthz', configured).toString()
  } catch {
    return ''
  }
}

function isTrue(value: unknown): boolean {
  return value === true
}

export async function readSolanaProvisionerPreflight(params?: {
  fetchImpl?: typeof fetch
  url?: string
  secret?: string
}): Promise<{
  ok: boolean
  status: number | null
  url: string
  keys: string[]
  checks: Record<string, boolean>
  payload: HealthPayload | null
  error?: string
}> {
  const url = params?.url ?? healthUrl()
  const secret = params?.secret ?? provisionerSecret()
  const checks: Record<string, boolean> = {
    health_url_configured: Boolean(url),
    bearer_secret_configured: Boolean(secret),
  }
  if (!url || !secret) {
    return { ok: false, status: null, url, keys: [], checks, payload: null, error: 'missing_provisioner_health_url_or_secret' }
  }

  let response: Response
  try {
    response = await (params?.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { accept: 'application/json', authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      keys: [],
      checks: { ...checks, health_http_ok: false },
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  const body = await response.json().catch(() => null) as HealthPayload | null
  const keys = body && typeof body === 'object' ? Object.keys(body).sort() : []
  const resultChecks = {
    ...checks,
    health_http_ok: response.ok,
    health_ok: isTrue(body?.ok),
    payer_configured: isTrue(body?.payerConfigured),
    payer_healthy: isTrue(body?.payerHealthy),
    solana_rpc_configured: isTrue(body?.solanaRpcConfigured),
    extended_endpoints_enabled: isTrue(body?.extendedEndpointsEnabled),
  }
  return {
    ok: Object.values(resultChecks).every(Boolean),
    status: response.status,
    url,
    keys,
    checks: resultChecks,
    payload: body,
    error: response.ok ? undefined : `provisioner_health_http_${response.status}`,
  }
}

async function main(): Promise<void> {
  const result = await readSolanaProvisionerPreflight()
  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    status: result.status,
    url: result.url ? new URL(result.url).origin + new URL(result.url).pathname : '',
    keys: result.keys,
    checks: result.checks,
    error: result.error,
  }, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
