#!/usr/bin/env tsx
/**
 * Read-only source-side audit for the isolated Solana Devnet -> Base Sepolia
 * lottery transport rehearsal. It never creates an OApp, Store, Peer, or
 * receiver and never quotes or submits a LayerZero message.
 */
import { pathToFileURL } from 'node:url'

import { Connection } from '@solana/web3.js'
import { UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'

import { readSolanaLayerZeroDvnPreflight } from './preflight-solana-lz-dvns.js'
import { resolveTestnetDvnPolicy } from './preflight-solana-lottery-oapp.js'

export const BASE_SEPOLIA_EID = 40_245

type UlnCounts = {
  requiredDvnCount?: number
  optionalDvnCount?: number
  optionalDvnThreshold?: number
  requiredDvns?: Array<{ toBase58: () => string }>
  optionalDvns?: Array<{ toBase58: () => string }>
}

function normalizedCount(value: unknown): number {
  const count = Number(value)
  // LayerZero uses u8::MAX as a nil/default override sentinel.
  return Number.isInteger(count) && count >= 0 && count !== 255 ? count : 0
}

export function assessSolanaDevnetBaseSepoliaDefaultUln(config: UlnCounts | null, threshold: number): {
  configured: boolean
  requiredDvnCount: number
  optionalDvnCount: number
  optionalDvnThreshold: number
  totalDvnCount: number
  thresholdSufficient: boolean
  dvnAddresses: string[]
} {
  const requiredDvnCount = normalizedCount(config?.requiredDvnCount)
  const optionalDvnCount = normalizedCount(config?.optionalDvnCount)
  const optionalDvnThreshold = normalizedCount(config?.optionalDvnThreshold)
  const configured = config != null
  const dvnAddresses = [
    ...(config?.requiredDvns ?? []),
    ...(config?.optionalDvns ?? []),
  ].map((dvn) => dvn.toBase58())
  return {
    configured,
    requiredDvnCount,
    optionalDvnCount,
    optionalDvnThreshold,
    totalDvnCount: requiredDvnCount + optionalDvnCount,
    thresholdSufficient: configured && Number.isInteger(threshold) && threshold > 0 && requiredDvnCount + optionalDvnCount >= threshold,
    dvnAddresses,
  }
}

async function main(): Promise<void> {
  const rpc = String(process.env.SOLANA_DEVNET_RPC_URL ?? '').trim()
  if (!rpc) throw new Error('solana_devnet_rpc_missing')

  let policy: ReturnType<typeof resolveTestnetDvnPolicy> | null = null
  let policyError: string | null = null
  try {
    policy = resolveTestnetDvnPolicy(process.env)
  } catch (error) {
    policyError = error instanceof Error ? error.message : String(error)
  }

  const connection = new Connection(rpc, 'finalized')
  const uln = new UlnProgram.Uln(UlnProgram.PROGRAM_ID)
  const state = await uln.getDefaultSendConfigState(connection, BASE_SEPOLIA_EID, 'finalized') as { uln?: UlnCounts } | null
  const source = assessSolanaDevnetBaseSepoliaDefaultUln(state?.uln ?? null, policy?.threshold ?? 0)
  const metadata = policy
    ? await readSolanaLayerZeroDvnPreflight({
      stage: 'testnet',
      chains: ['base-sepolia', 'solana-testnet'],
      expectedDvns: policy.expected,
      threshold: policy.threshold,
    })
    : null
  const sourceDefaultDvnsInPolicy = policy != null && metadata?.ok === true &&
    source.dvnAddresses.length === source.totalDvnCount &&
    source.dvnAddresses.every((address) => {
      return policy.expected.some((name) => {
        return (metadata.candidates[name] ?? []).some((candidate) => {
          return candidate.chain === 'solana-testnet' && candidate.address === address
        })
      })
    })
  const checks = {
    test_dvn_policy_configured: policy != null,
    source_default_uln_available: source.configured,
    official_route_policy_verified: metadata?.ok === true,
    source_default_dvns_in_policy: sourceDefaultDvnsInPolicy,
  }
  // The official Devnet default is intentionally 1-of-1. A test-only OApp
  // must apply the verified custom 2-of-2 policy after its Store exists;
  // requiring that custom config before the receiver/OApp is deployed would
  // make the secure test route impossible to bootstrap.
  const customSourceUlnConfigRequired = policy != null && !source.thresholdSufficient
  const ok = Object.values(checks).every(Boolean)
  process.stdout.write(`${JSON.stringify({
    ok,
    route: { source: 'solana-devnet', sourceEid: 40_168, destination: 'base-sepolia', destinationEid: BASE_SEPOLIA_EID },
    checks,
    policy: policy ? { names: policy.expected, threshold: policy.threshold } : null,
    policyError,
    sourceDefaultUln: source,
    customSourceUlnConfigRequired,
    metadata: metadata ? { url: metadata.url, checks: metadata.checks, error: metadata.error } : null,
  }, null, 2)}\n`)
  if (!ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`solana lottery test-route preflight failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
