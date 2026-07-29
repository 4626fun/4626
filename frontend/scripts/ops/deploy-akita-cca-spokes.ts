#!/usr/bin/env tsx
/**
 * AKITA CCA spoke fan-out helper.
 *
 * Default is dry-run (prints the ordered checklist + runs read-only preflight).
 * Actual CREATE2 / peer-wire broadcasts stay in Foundry scripts per the runbook —
 * this CLI refuses to invent keys or mutate without an explicit future --broadcast
 * path once spoke deployers are wired.
 *
 *   pnpm -C frontend ops:deploy-akita-cca-spokes
 *   pnpm -C frontend ops:deploy-akita-cca-spokes --dry-run
 *   pnpm -C frontend ops:deploy-akita-cca-spokes --chain arbitrum
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CCA_LAUNCH_CHAINS,
  CCA_LAUNCH_CHAIN_KEYS,
  type CcaLaunchChainKey,
} from '../../src/config/ccaLaunchChains.ts'
import { AKITA_DEFAULTS, AKITA_EXPANSION_CHAIN_ENV_SUFFIX } from '../../src/config/contracts.defaults.ts'

declare const process: {
  argv: string[]
  cwd: () => string
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function runPreflight(chain?: CcaLaunchChainKey): number {
  const args = ['exec', 'tsx', 'scripts/ops/verify-cca-multichain-preflight.ts']
  if (chain) args.push('--chain', chain)
  const result = spawnSync('pnpm', args, {
    cwd: FRONTEND_ROOT,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stdout.write(result.stderr)
  return result.status ?? 1
}

function main(): void {
  const only = getArg('--chain') as CcaLaunchChainKey | ''
  const dryRun = !hasFlag('--broadcast')
  const keys = (only
    ? CCA_LAUNCH_CHAIN_KEYS.filter((k) => k === only && k !== 'base')
    : CCA_LAUNCH_CHAIN_KEYS.filter((k) => k !== 'base')) as CcaLaunchChainKey[]

  if (only && keys.length === 0) {
    process.stdout.write(`Unknown or non-spoke --chain ${only}. Valid: ethereum, arbitrum, unichain, robinhood\n`)
    process.exit(1)
  }

  process.stdout.write('■AKITA CCA spoke deploy helper\n')
  process.stdout.write(`Mode: ${dryRun ? 'DRY-RUN (default)' : 'BROADCAST'}\n`)
  process.stdout.write(`Hub ShareOFT: ${AKITA_DEFAULTS.shareOFT}\n`)
  process.stdout.write(`Hub CCA arm:  ${AKITA_DEFAULTS.ccaLaunchArm}\n\n`)

  process.stdout.write('=== Preflight ===\n')
  const preflightCode = only ? runPreflight(only as CcaLaunchChainKey) : runPreflight()
  if (preflightCode !== 0) {
    process.stdout.write('Preflight FAIL — fix factory/fee/poolManager/LZ before broadcast.\n')
    process.exit(preflightCode)
  }

  for (const key of keys) {
    const chain = CCA_LAUNCH_CHAINS[key]
    const suffix = AKITA_EXPANSION_CHAIN_ENV_SUFFIX[chain.chainId] ?? key.toUpperCase()
    process.stdout.write(`\n=== ${chain.label} ===\n`)
    if (chain.ccaFactoryV210ExpectedEmptyPreBootstrap) {
      process.stdout.write('BLOCKER: bootstrap CCA factory v2.1.0 (feeController=0) before OFT/arm deploy.\n')
    }
    process.stdout.write(`NEXT: DeployRemoteShareOft EXPECTED_CHAIN_ID=${chain.chainId}\n`)
    process.stdout.write('NEXT: Wire Base↔spoke ShareOFT peers ([15,15], 3-of-5)\n')
    process.stdout.write(
      `NEXT: DeployRemoteCreatorOracle EXPECTED_CHAIN_ID=${chain.chainId}` +
        ` SET_CHAINLINK_ETH_USD=${chain.chainlinkEthUsd}\n`,
    )
    process.stdout.write(`NEXT: WireCreatorOracleHubSpokePeers (hub Base + spoke eid ${chain.eid})\n`)
    process.stdout.write('NEXT: Deploy CCALaunchArm only (no vault/wrapper/gauge/token on spoke)\n')
    process.stdout.write(
      `NEXT: ConfigureSpokeCcaOracle POOL_MANAGER=${chain.poolManagerV4}\n`,
    )
    process.stdout.write(`NEXT: BroadcastCreatorOracleAssetPrice DST_EIDS+=${chain.eid}\n`)
    process.stdout.write(`NEXT: Pin VITE_AKITA_SHARE_OFT_${suffix} + VITE_AKITA_CCA_STRATEGY_${suffix}\n`)
  }

  if (dryRun) {
    process.stdout.write(
      '\nDRY-RUN complete. Broadcast of remote CREATE2/peer txs is intentionally not automated yet —\n' +
        'use Foundry scripts in docs/operations/cca-multichain-mainnet-runbook.md.\n' +
        'Passing --broadcast today exits non-zero until spoke deployers are wired.\n',
    )
    if (hasFlag('--broadcast')) {
      process.stdout.write('ERROR: --broadcast is not implemented for EVM spoke CREATE2 yet.\n')
      process.exit(1)
    }
    process.exit(0)
  }

  process.stdout.write('ERROR: --broadcast is not implemented for EVM spoke CREATE2 yet.\n')
  process.exit(1)
}

main()
