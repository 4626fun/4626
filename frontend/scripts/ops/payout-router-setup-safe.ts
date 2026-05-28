#!/usr/bin/env node

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import {
  buildPayoutRouterTreasurySetupPlan,
  executePayoutRouterTreasurySetup,
} from '../../server/_lib/onchain/payoutRouterTreasurySetup.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/payout-router-setup-safe.ts [options]

Required:
  --router <address>         PayoutRouter address
  --creator <address>        Creator coin address (for V3 path resolution)

Options:
  --execute                  Broadcast via protocol treasury Safe (default dry-run)
  --rpc <url>                Base RPC (default BASE_RPC_URL or mainnet)
  --help                     Show help

Examples:
  pnpm -C frontend exec tsx scripts/ops/payout-router-setup-safe.ts \\
    --router 0xRouter --creator 0xCreator

  pnpm -C frontend exec tsx scripts/ops/payout-router-setup-safe.ts \\
    --router 0xRouter --creator 0xCreator --execute
`)
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

function normalizeAddress(value: string): Address | null {
  const raw = value.trim()
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const router = normalizeAddress(getArg('--router'))
  const creator = normalizeAddress(getArg('--creator'))
  if (!router || !creator) {
    throw new Error('Missing or invalid --router / --creator')
  }

  const rpcUrl = getArg('--rpc', process.env.BASE_RPC_URL || 'https://mainnet.base.org')
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
  const execute = hasFlag('--execute')

  if (execute) {
    const result = await executePayoutRouterTreasurySetup({
      publicClient,
      rpcUrl,
      payoutRouter: router,
      creatorToken: creator,
    })
    process.stdout.write(`${JSON.stringify({ mode: 'execute', ...result }, null, 2)}\n`)
    return
  }

  const plan = await buildPayoutRouterTreasurySetupPlan({
    publicClient,
    payoutRouter: router,
    creatorToken: creator,
  })
  process.stdout.write(`${JSON.stringify({ mode: 'dry-run', plan }, null, 2)}\n`)
  process.stdout.write('Dry-run complete. Re-run with --execute to broadcast via protocol treasury Safe.\n')
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
