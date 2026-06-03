#!/usr/bin/env tsx

type JsonEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
}

function env(name: string, fallback = ''): string {
  const value = String(process.env[name] ?? fallback).trim()
  if (!value) throw new Error(`missing_required_env:${name}`)
  return value
}

async function postJson<T>(input: {
  baseUrl: string
  apiKey: string
  path: string
  body: Record<string, unknown>
}): Promise<JsonEnvelope<T>> {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input.body),
  })
  const json = (await response.json().catch(() => null)) as JsonEnvelope<T> | null
  if (!json) throw new Error(`invalid_json_response:${input.path}`)
  if (!response.ok) {
    throw new Error(`http_${response.status}:${input.path}:${json.error ?? 'unknown_error'}`)
  }
  return json
}

async function main() {
  const baseUrl = env('KEEPER_COORDINATION_BASE_URL')
  const apiKey = env('KPR_API_KEY')

  const strategyAddress = env('CRE_CANARY_STRATEGY_ADDRESS', '0x1111111111111111111111111111111111111111')
  const vaultAddress = env('CRE_CANARY_VAULT_ADDRESS', '0x2222222222222222222222222222222222222222')
  const oracleAddress = env('CRE_CANARY_ORACLE_ADDRESS', '0x3333333333333333333333333333333333333333')
  const source = env('CRE_CANARY_SOURCE', 'cre-canary-smoke')
  const nowMs = Date.now()

  const nav = await postJson({
    baseUrl,
    apiKey,
    path: '/api/keeper/cre-solana-nav-ingest',
    body: {
      strategyAddress,
      vaultAddress,
      reportedRemoteNav: '1000000000000000000',
      reportTimestampMs: nowMs,
      source,
    },
  })
  console.log('[canary] solana-nav-ingest', nav)

  const health = await postJson({
    baseUrl,
    apiKey,
    path: '/api/keeper/cre-strategy-health-ingest',
    body: {
      vaultAddress,
      strategyAddress,
      status: 'healthy',
      confidenceBps: 9000,
      reportTimestampMs: nowMs,
      source,
    },
  })
  console.log('[canary] strategy-health-ingest', health)

  const oracle = await postJson({
    baseUrl,
    apiKey,
    path: '/api/keeper/cre-oracle-validate-update',
    body: {
      oracleAddress,
      proposedPrice: '1000',
      reportTimestampMs: nowMs,
      source,
    },
  })
  console.log('[canary] oracle-validate-update', oracle)
}

main().catch((error) => {
  console.error('[canary] failed', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
