#!/usr/bin/env node
import { createPublicClient, getAddress, http, isAddress } from 'viem'
import { base } from 'viem/chains'

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from '../../src/config/contracts.defaults.js'
import { resolveAlignedPhase1DeployDeps } from '../../src/lib/deploy/phase1ModuleDeploy.js'

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

async function main(): Promise<void> {
  const batcherRaw = getArg('--batcher') ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER
  if (!isAddress(batcherRaw)) throw new Error(`Invalid --batcher ${batcherRaw}`)
  const batcherAddress = getAddress(batcherRaw)
  const rpc =
    process.env.BASE_RPC_URL?.replace('wss://', 'https://').replace('/ws/', '/rpc/') ??
    'https://mainnet.base.org'

  const publicClient = createPublicClient({ chain: base, transport: http(rpc, { timeout: 60_000 }) })
  const aligned = await resolveAlignedPhase1DeployDeps({ publicClient, batcherAddress })

  if (aligned.ok) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          batcher: batcherAddress,
          create2Deployer: aligned.create2Deployer,
          bytecodeStore: aligned.bytecodeStore,
        },
        null,
        2,
      )}\n`,
    )
    process.exit(0)
  }

  process.stderr.write(`${JSON.stringify({ ok: false, batcher: batcherAddress, ...aligned }, null, 2)}\n`)
  process.exit(2)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
