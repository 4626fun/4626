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

type OutputMode = 'text' | 'json' | 'markdown'

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/verify-phase3-helper-create2-auth.ts [options]

Options:
  --batcher <address>   DeploymentBatcher override
  --json                Machine-readable output
  --markdown            Markdown summary + JSON payload
  --help                Show this help
`)
}

function resolveOutputMode(): OutputMode {
  const json = hasFlag('--json')
  const markdown = hasFlag('--markdown')
  if (json && markdown) throw new Error('Choose only one output format: --json or --markdown')
  if (json) return 'json'
  if (markdown) return 'markdown'
  return 'text'
}

async function main() {
  if (hasFlag('--help')) {
    usage()
    return
  }
  const outputMode = resolveOutputMode()
  const batcherArg = getArg('--batcher')
  const batcher = getAddress(
    isAddress(String(batcherArg ?? '')) ? (batcherArg as Address) : SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  )
  const rpcUrl = String(process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const status = await readPhase3HelperCreate2Authorization({ publicClient, batcher })
  const payload = { ok: status.ok, batcher, ...status }
  if (outputMode === 'json') {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else if (outputMode === 'markdown') {
    process.stdout.write(`## Phase3 Helper CREATE2 Authorization\n\n`)
    process.stdout.write(`- Status: \`${status.ok ? 'pass' : 'fail'}\`\n`)
    process.stdout.write(`- Batcher: \`${batcher}\`\n`)
    process.stdout.write(`- Helper: \`${status.helper}\`\n`)
    process.stdout.write(`- Deployer: \`${status.deployer}\`\n`)
    process.stdout.write(`- Authorized: \`${String(status.authorized)}\`\n\n`)
    process.stdout.write(`\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`)
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    process.stdout.write(
      status.ok
        ? 'phase3 helper create2 authorization: PASS\n'
        : 'phase3 helper create2 authorization: FAIL — helper is not authorized on create2 deployer\n',
    )
  }
  if (!status.ok) process.exit(2)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
