#!/usr/bin/env node

import { getAddress, isAddress } from 'viem'

import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { ensureKeeperRegistryForVault } from '../../server/_lib/keepr/keeperRegistryBootstrap.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts [options]

Options:
  --vault <address>       Vault address (default: AKITA live vault)
  --creator <address>     Optional canonical owner / CSW override
  --chain-id <id>         Chain id (default: 8453)
  --strategy-variant <v>  Strategy profile variant (default: default_strategy)
  --dry-run               Print resolved target without writing (default)
  --execute               Upsert keepr_vaults + ajna_vaults rows
  --help                  Show this help

Examples:
  pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts --dry-run
  pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts --execute
  pnpm -C frontend exec tsx scripts/ops/backfill-keepr-vault.ts --vault 0x82C0... --execute
`)
}

function parseArgs(argv: string[]): {
  vault: `0x${string}`
  creator: `0x${string}` | null
  chainId: number
  strategyVariant: string
  execute: boolean
} {
  let vault = AKITA_DEFAULTS.vault as `0x${string}`
  let creator: `0x${string}` | null = null
  let chainId = 8453
  let strategyVariant = 'default_strategy'
  let execute = false

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      usage()
      process.exit(0)
    }
    if (arg === '--dry-run') {
      execute = false
      continue
    }
    if (arg === '--execute') {
      execute = true
      continue
    }
    if (arg === '--vault') {
      const next = argv[++i]
      if (!next || !isAddress(next)) throw new Error('Invalid --vault address')
      vault = getAddress(next).toLowerCase() as `0x${string}`
      continue
    }
    if (arg === '--creator') {
      const next = argv[++i]
      if (!next || !isAddress(next)) throw new Error('Invalid --creator address')
      creator = getAddress(next).toLowerCase() as `0x${string}`
      continue
    }
    if (arg === '--chain-id') {
      const next = Number(argv[++i])
      if (!Number.isFinite(next) || next <= 0) throw new Error('Invalid --chain-id')
      chainId = Math.trunc(next)
      continue
    }
    if (arg === '--strategy-variant') {
      const next = argv[++i]
      if (!next?.trim()) throw new Error('Missing --strategy-variant value')
      strategyVariant = next.trim()
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return { vault, creator, chainId, strategyVariant, execute }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  process.stdout.write(
    `${args.execute ? 'Executing' : 'Dry-run'} keeper registry bootstrap for ${args.vault} (chain ${args.chainId})\n`,
  )

  if (!args.execute) {
    process.stdout.write(
      JSON.stringify(
        {
          mode: 'dry_run',
          vaultAddress: args.vault,
          chainId: args.chainId,
          creatorAddress: args.creator,
          strategyVariant: args.strategyVariant,
          hint: 'Re-run with --execute to write keepr_vaults + ajna_vaults rows',
        },
        null,
        2,
      ) + '\n',
    )
    return
  }

  const result = await ensureKeeperRegistryForVault({
    vaultAddress: args.vault,
    chainId: args.chainId,
    creatorAddress: args.creator,
    strategyVariant: args.strategyVariant,
    source: 'ops.backfill-keepr-vault',
    skipProvisionIfExists: false,
    seedAjna: true,
  })

  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (!result.keeprProvisioned) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
