#!/usr/bin/env node

/**
 * Rollout tripwire for EIP-8130 native account abstraction (Base Cobalt).
 *
 * Probes Base networks for the 8130 system surface and compares each result
 * against the level we have planned for. Base mainnet and Sepolia are expected
 * to stay `unsupported` — when either moves, the exit code flips to 2 and it is
 * time to work through docs/_internal/eip-8130-native-aa-readiness.md. Vibenet
 * is informational; it is an ephemeral devnet and churns by design.
 *
 * Read-only: `eth_chainId` + `eth_getCode` only.
 */

import {
  classifyNativeAaReadiness,
  nativeAaCheckExitCode,
  probeNativeAaReadiness,
  type NativeAaReadiness,
  type NativeAaReadinessLevel,
  type NativeAaRpcCall,
} from '../../src/features/status/nativeAaReadiness.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type Endpoint = {
  id: string
  label: string
  url: string
  required: boolean
  expectedChainId: number | null
  /** Null = informational only; readiness changes do not signal drift. */
  expectedLevel: NativeAaReadinessLevel | null
}

const DEFAULT_ENDPOINTS: Endpoint[] = [
  {
    id: 'base-mainnet',
    label: 'Base mainnet',
    url: 'https://mainnet.base.org',
    required: true,
    expectedChainId: 8453,
    expectedLevel: 'unsupported',
  },
  {
    id: 'base-sepolia',
    label: 'Base Sepolia',
    url: 'https://sepolia.base.org',
    required: true,
    expectedChainId: 84532,
    expectedLevel: 'unsupported',
  },
  {
    id: 'base-vibenet',
    label: 'Base Vibenet (preview)',
    url: 'https://rpc.vibes.base.org',
    required: false,
    expectedChainId: 84538453,
    expectedLevel: null,
  },
]

const READINESS_LEVELS: NativeAaReadinessLevel[] = ['unsupported', 'partial', 'supported']

type OutputMode = 'text' | 'json' | 'markdown'

type EndpointResult = Endpoint & {
  readiness: NativeAaReadiness
  drifted: boolean
  error: string | null
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function resolveOutputMode(): OutputMode {
  const json = hasFlag('--json')
  const markdown = hasFlag('--markdown')
  if (json && markdown) throw new Error('Choose only one output format: --json or --markdown')
  if (json) return 'json'
  if (markdown) return 'markdown'
  return 'text'
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/check-native-aa-readiness.ts [options]

Options:
  --rpc <url>              Probe one ad-hoc endpoint instead of the Base defaults
  --expect <level>         Assert the --rpc endpoint sits at unsupported|partial|supported
  --account-config <addr>  Also probe ACCOUNT_CONFIG_ADDRESS (CREATE2-derived, unpublished)
  --timeout <ms>           Per-request timeout (default: 10000)
  --json                   Machine-readable output only
  --markdown               Markdown summary + JSON payload
  --help                   Show this help

Exit 0 when every network sits at its expected readiness level, 2 when Base
mainnet or Sepolia drifts (Cobalt landed — work through
docs/_internal/eip-8130-native-aa-readiness.md), 1 on a fatal error.
`)
}

function makeRpc(url: string, timeoutMs: number): NativeAaRpcCall {
  let id = 0
  return async (method, params) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = (await response.json()) as { result?: unknown; error?: { message?: string } }
      if (body.error) throw new Error(body.error.message || 'JSON-RPC error')
      return body.result ?? null
    } finally {
      clearTimeout(timer)
    }
  }
}

function unreachable(message: string): NativeAaReadiness {
  return {
    ...classifyNativeAaReadiness({
      chainId: null,
      nonceManagerCode: null,
      txContextCode: null,
      accountConfiguration: null,
    }),
    summary: `Probe failed: ${message}`,
  }
}

async function probeEndpoint(
  endpoint: Endpoint,
  options: { accountConfigurationAddress: string | null; timeoutMs: number },
): Promise<EndpointResult> {
  const rpc = makeRpc(endpoint.url, options.timeoutMs)
  try {
    const readiness = await probeNativeAaReadiness(rpc, {
      accountConfigurationAddress: options.accountConfigurationAddress,
      expectedChainId: endpoint.expectedChainId,
    })
    return {
      ...endpoint,
      readiness,
      drifted: endpoint.expectedLevel !== null && readiness.level !== endpoint.expectedLevel,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...endpoint, readiness: unreachable(message), drifted: false, error: message }
  }
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }
  const outputMode = resolveOutputMode()
  const accountConfigurationAddress =
    getArg('--account-config', process.env.EIP_8130_ACCOUNT_CONFIG_ADDRESS ?? '') || null
  const timeoutRaw = Number.parseInt(getArg('--timeout', '10000'), 10)
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 10_000

  const rpcOverride = getArg('--rpc')
  const expected = getArg('--expect')
  if (expected && !READINESS_LEVELS.includes(expected as NativeAaReadinessLevel)) {
    throw new Error(`--expect must be one of ${READINESS_LEVELS.join(' | ')}`)
  }
  if (expected && !rpcOverride) {
    throw new Error('--expect applies to --rpc; the default networks carry their own expectations')
  }
  const endpoints: Endpoint[] = rpcOverride
    ? [
        {
          id: 'custom',
          label: rpcOverride,
          url: rpcOverride,
          required: true,
          expectedChainId: null,
          expectedLevel: (expected as NativeAaReadinessLevel) || null,
        },
      ]
    : DEFAULT_ENDPOINTS

  const results = await Promise.all(
    endpoints.map((endpoint) =>
      probeEndpoint(endpoint, { accountConfigurationAddress, timeoutMs }),
    ),
  )

  const drifted = results.filter((result) => result.drifted)
  const failed = results.filter((result) => result.required && result.error !== null)
  const asserted = results.filter((result) => result.expectedLevel !== null)
  const exitCode = nativeAaCheckExitCode(results)
  const payload = {
    checkedAt: new Date().toISOString(),
    accountConfigurationAddress,
    probeFailed: failed.length > 0,
    nativeAaLandedOnPlannedNetworks: drifted.length > 0,
    networks: results.map((result) => ({
      id: result.id,
      label: result.label,
      url: result.url,
      chainId: result.readiness.chainId,
      expectedLevel: result.expectedLevel,
      level: result.readiness.level,
      drifted: result.drifted,
      nonceManagerPresent: result.readiness.nonceManagerPresent,
      txContextPresent: result.readiness.txContextPresent,
      accountConfigurationPresent: result.readiness.accountConfigurationPresent,
      summary: result.readiness.summary,
      error: result.error,
    })),
  }

  if (outputMode === 'json') {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else if (outputMode === 'markdown') {
    process.stdout.write(`## EIP-8130 Native AA Readiness\n\n`)
    process.stdout.write(`- Checked: \`${payload.checkedAt}\`\n`)
    process.stdout.write(
      `- Status: \`${failed.length > 0 ? 'probe failed' : drifted.length > 0 ? 'drifted' : 'as planned'}\`\n\n`,
    )
    process.stdout.write(`| Network | Chain ID | Expected | Observed | Nonce mgr | Tx context |\n`)
    process.stdout.write(`|---|---|---|---|---|---|\n`)
    for (const network of payload.networks) {
      process.stdout.write(
        `| ${network.label} | ${network.chainId ?? 'n/a'} | ${network.expectedLevel ?? 'informational'} | ${network.level} | ${network.nonceManagerPresent ? 'yes' : 'no'} | ${network.txContextPresent ? 'yes' : 'no'} |\n`,
      )
    }
    process.stdout.write(`\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`)
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    process.stdout.write(
      failed.length > 0
        ? `EIP-8130 readiness: PROBE FAILED — ${failed
            .map((result) => `${result.label}: ${result.error}`)
            .join(', ')}.\n`
        : drifted.length > 0
          ? `EIP-8130 readiness: DRIFTED — ${drifted
              .map((result) => `${result.label} is ${result.readiness.level}`)
              .join(
                ', ',
              )}. Work through docs/_internal/eip-8130-native-aa-readiness.md before changing execution lanes.\n`
          : asserted.length > 0
            ? `EIP-8130 readiness: AS PLANNED — ${asserted
                .map((result) => `${result.label} is ${result.readiness.level}`)
                .join(', ')}.\n`
            : 'EIP-8130 readiness: OBSERVED ONLY — no expected level asserted.\n',
    )
  }

  process.exit(exitCode)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
