#!/usr/bin/env node
/**
 * Verify DeploymentBatcher.phase3Helper is authorized on its create2 deployer.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/verify-phase3-helper-create2-auth.ts
 */

import { createPublicClient, getAddress, http, isAddress, type Address } from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { readPhase3HelperCreate2Authorization } from '../../server/_lib/deploy/ensurePhase3HelperCreate2Authorization.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => void
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  const batcherArg = getArg('--batcher')
  const batcher = getAddress(
    isAddress(String(batcherArg ?? '')) ? (batcherArg as Address) : SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  )
  const rpcUrl = String(process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const status = await readPhase3HelperCreate2Authorization({ publicClient, batcher })
  process.stdout.write(`${JSON.stringify({ ok: status.ok, batcher, ...status }, null, 2)}\n`)
  if (!status.ok) process.exit(2)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
