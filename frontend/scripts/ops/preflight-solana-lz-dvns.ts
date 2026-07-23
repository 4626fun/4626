#!/usr/bin/env tsx
/**
 * Read-only LayerZero DVN metadata preflight for the Base ↔ Solana path.
 *
 * This verifies a route-specific policy input (the production default is five
 * active v2 DVNs shared by Base and Solana with a 3-of-5 threshold). It does
 * not inspect or mutate ULN config on an OApp/OFT; that remains a separate
 * on-chain/configuration gate.
 */

import { pathToFileURL } from 'node:url'

export const MAINNET_BASE_SOLANA_DVNS = [
  'LayerZero Labs',
  'Google',
  'Nethermind',
  'Horizen',
  'Deutsche Telekom',
] as const

export const MAINNET_BASE_SOLANA_DVN_THRESHOLD = 3
// The legacy `/dvns` endpoint currently returns only mainnet chain records
// even when passed `stage=testnet`. The deployments metadata is the official
// source that carries each chain's V2 stage and its active DVN map.
export const DEFAULT_DVN_METADATA_URL = 'https://metadata.layerzero-api.com/v1/metadata/deployments'

type DvnRecord = {
  canonicalName?: unknown
  version?: unknown
  deprecated?: unknown
  // LayerZero Read DVNs are for request/response queries only. They must not
  // be selected for this ordinary push-message pathway.
  lzReadCompatible?: unknown
}

type ChainRecord = {
  chainName?: unknown
  environment?: unknown
  dvns?: Record<string, DvnRecord>
}

type Deployment = {
  chainKey?: unknown
  stage?: unknown
  version?: unknown
}

type DeploymentChainRecord = {
  chainKey?: unknown
  deployments?: unknown
  dvns?: Record<string, DvnRecord>
}

type DvnMetadata = Record<string, ChainRecord | DeploymentChainRecord>

export type DvnCandidate = {
  chain: string
  address: string
  canonicalName: string
  version: number
}

export type DvnPreflightResult = {
  ok: boolean
  url: string
  stage: string
  chains: string[]
  threshold: number
  expectedDvns: string[]
  checks: Record<string, boolean>
  candidates: Record<string, DvnCandidate[]>
  error?: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function metadataUrl(stage: string, chains: string[]): string {
  const raw = env('LZ_DVN_METADATA_URL') || DEFAULT_DVN_METADATA_URL
  try {
    const url = new URL(raw)
    url.searchParams.set('version', 'v2')
    url.searchParams.set('stage', stage)
    url.searchParams.set('chains', chains.join(','))
    return url.toString()
  } catch {
    return ''
  }
}

function activeCandidates(
  chainName: string,
  chain: (ChainRecord | DeploymentChainRecord) | undefined,
  name: string,
): DvnCandidate[] {
  return Object.entries(chain?.dvns ?? {})
    .filter(([, value]) => {
      return value?.canonicalName === name &&
        value?.version === 2 &&
        value?.deprecated !== true &&
        value?.lzReadCompatible !== true
    })
    .map(([address]) => ({
      chain: chainName,
      address,
      canonicalName: name,
      version: 2,
    }))
}

function isConfiguredChain(
  chain: (ChainRecord | DeploymentChainRecord) | undefined,
  requestedChain: string,
  stage: string,
): boolean {
  if (!chain || typeof chain !== 'object' || !chain.dvns) return false
  // Retained for an explicitly configured legacy metadata mirror.
  if ('chainName' in chain && chain.chainName === requestedChain && chain.environment === stage) return true
  if (!('chainKey' in chain) || chain.chainKey !== requestedChain || !Array.isArray(chain.deployments)) return false
  return chain.deployments.some((deployment) => {
    if (!deployment || typeof deployment !== 'object') return false
    const candidate = deployment as Deployment
    return candidate.chainKey === requestedChain && candidate.stage === stage && candidate.version === 2
  })
}

function findChainRecord(
  body: DvnMetadata,
  requestedChain: string,
  stage: string,
): (ChainRecord | DeploymentChainRecord) | undefined {
  return Object.values(body).find((chain) => isConfiguredChain(chain, requestedChain, stage))
}

export async function readSolanaLayerZeroDvnPreflight(params?: {
  fetchImpl?: typeof fetch
  stage?: string
  chains?: string[]
  expectedDvns?: readonly string[]
  threshold?: number
}): Promise<DvnPreflightResult> {
  const stage = params?.stage ?? (env('LZ_DVN_METADATA_STAGE') || 'mainnet')
  const chains = params?.chains ?? ['base', 'solana']
  const expectedDvns = [...(params?.expectedDvns ?? MAINNET_BASE_SOLANA_DVNS)]
  const threshold = params?.threshold ?? MAINNET_BASE_SOLANA_DVN_THRESHOLD
  const url = metadataUrl(stage, chains)
  const checks: Record<string, boolean> = {
    metadata_url_configured: Boolean(url),
    metadata_http_ok: false,
    metadata_shape_valid: false,
    chains_present: false,
    expected_dvn_count: expectedDvns.length >= threshold && new Set(expectedDvns).size === expectedDvns.length,
    threshold_is_configured: Number.isInteger(threshold) && threshold > 0 && threshold <= expectedDvns.length,
    active_shared_dvns: false,
  }
  const candidates: Record<string, DvnCandidate[]> = {}

  if (!url) {
    return {
      ok: false,
      url,
      stage,
      chains,
      threshold,
      expectedDvns,
      checks,
      candidates,
      error: 'invalid_dvn_metadata_url',
    }
  }

  let response: Response
  try {
    response = await (params?.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    return {
      ok: false,
      url,
      stage,
      chains,
      threshold,
      expectedDvns,
      checks,
      candidates,
      error: error instanceof Error ? error.message : String(error),
    }
  }
  checks.metadata_http_ok = response.ok
  if (!response.ok) {
    return {
      ok: false,
      url,
      stage,
      chains,
      threshold,
      expectedDvns,
      checks,
      candidates,
      error: `dvn_metadata_http_${response.status}`,
    }
  }

  const body = await response.json().catch(() => null) as DvnMetadata | null
  checks.metadata_shape_valid = Boolean(body && typeof body === 'object' && !Array.isArray(body))
  if (!checks.metadata_shape_valid) {
    return {
      ok: false,
      url,
      stage,
      chains,
      threshold,
      expectedDvns,
      checks,
      candidates,
      error: 'dvn_metadata_invalid_json_shape',
    }
  }

  const routeChains = Object.fromEntries(chains.map((chain) => [chain, findChainRecord(body ?? {}, chain, stage)])) as Record<
    string,
    ChainRecord | DeploymentChainRecord | undefined
  >
  checks.chains_present = chains.every((chain) => Boolean(routeChains[chain]))
  for (const name of expectedDvns) {
    const perChain = chains.flatMap((chain) => activeCandidates(chain, routeChains[chain], name))
    candidates[name] = perChain
  }
  checks.active_shared_dvns = checks.chains_present && expectedDvns.every((name) => {
    return chains.every((chain) => activeCandidates(chain, routeChains[chain], name).length > 0)
  })

  const ok = Object.values(checks).every(Boolean)
  return {
    ok,
    url,
    stage,
    chains,
    threshold,
    expectedDvns,
    checks,
    candidates,
    error: ok ? undefined : 'dvn_policy_preflight_failed',
  }
}

async function main(): Promise<void> {
  const result = await readSolanaLayerZeroDvnPreflight()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
