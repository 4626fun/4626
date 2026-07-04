#!/usr/bin/env tsx
/**
 * Read-only verification for Base hub ↔ Robinhood remote ShareOFT mesh.
 *
 *   pnpm -C frontend ops:verify-robinhood-mesh \
 *     --creator 0xCreatorToken \
 *     --base-share-oft 0xBaseShareOFT \
 *     --robinhood-share-oft 0xRobinhoodShareOFT \
 *     [--hub-gauge 0xBaseGauge] \
 *     [--registry 0xRegistry]
 *
 * Exit 0 = ready. Exit 1 = blocked.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { BASE_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { ROBINHOOD_REMOTE_SHARE_OFT } from '../../src/config/remoteShareOftChains.js'
import { readRobinhoodShareMeshWiringStatus } from '../../src/lib/deploy/robinhoodShareBridgeWiring.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

const robinhoodChain = {
  id: ROBINHOOD_REMOTE_SHARE_OFT.chainId,
  name: 'Robinhood Chain',
  nativeCurrency: ROBINHOOD_REMOTE_SHARE_OFT.nativeCurrency,
  rpcUrls: {
    default: { http: [ROBINHOOD_REMOTE_SHARE_OFT.defaultRpcUrl] },
  },
} as const

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))
loadEnvFile(resolve(FRONTEND_ROOT, '..', '.env'))

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value)
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(
      'Usage: pnpm -C frontend ops:verify-robinhood-mesh \\\n' +
        '  --creator 0xCreatorToken \\\n' +
        '  --base-share-oft 0xBaseShareOFT \\\n' +
        '  --robinhood-share-oft 0xRobinhoodShareOFT \\\n' +
        '  [--hub-gauge 0xBaseGauge] [--registry 0xRegistry]\n',
    )
    process.exit(0)
  }

  const creator = requireAddress(getArg('--creator'), 'creator')
  const baseShareOft = requireAddress(getArg('--base-share-oft'), 'base-share-oft')
  const robinhoodShareOft = requireAddress(getArg('--robinhood-share-oft'), 'robinhood-share-oft')
  const hubGaugeRaw = getArg('--hub-gauge')
  const hubGauge = hubGaugeRaw ? requireAddress(hubGaugeRaw, 'hub-gauge') : undefined
  const registry = requireAddress(getArg('--registry', BASE_DEFAULTS.registry), 'registry')

  const baseRpc =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  const robinhoodRpc =
    process.env.ROBINHOOD_RPC_URL?.trim() || ROBINHOOD_REMOTE_SHARE_OFT.defaultRpcUrl

  const baseClient = createPublicClient({ chain: base, transport: http(baseRpc, { timeout: 30_000 }) })
  const robinhoodClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(robinhoodRpc, { timeout: 30_000 }),
  })

  process.stdout.write('\n=== Robinhood remote ShareOFT mesh readiness ===\n\n')
  process.stdout.write(`Creator:           ${creator}\n`)
  process.stdout.write(`Base ShareOFT:     ${baseShareOft}\n`)
  process.stdout.write(`Robinhood ShareOFT:${robinhoodShareOft}\n`)
  process.stdout.write(`Registry:          ${registry}\n`)
  process.stdout.write(`Base RPC:          ${baseRpc}\n`)
  process.stdout.write(`Robinhood RPC:     ${robinhoodRpc}\n\n`)

  const status = await readRobinhoodShareMeshWiringStatus({
    baseClient,
    robinhoodClient,
    registryAddress: registry,
    creatorToken: creator,
    baseShareOft,
    robinhoodShareOft,
    hubGaugeReceiver: hubGauge,
  })

  for (const check of status.checks) {
    process.stdout.write(`${check.ok ? '✓' : '✗'} ${check.id}: ${check.detail}\n`)
  }

  process.stdout.write('\n')
  if (status.ready) {
    process.stdout.write('READY — peers aligned and fee quotes succeed both directions.\n\n')
    process.exit(0)
  }

  process.stdout.write('BLOCKED — fix failing checks before enabling user-facing Robinhood bridge flows.\n')
  process.stdout.write('Runbook: docs/_internal/operations/operations/robinhood/robinhood-share-mesh-provisioning.md\n\n')
  process.exit(1)
}

main().catch((error) => {
  process.stdout.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
