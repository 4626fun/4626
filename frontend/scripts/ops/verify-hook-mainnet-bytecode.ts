#!/usr/bin/env node
/**
 * Read-only: classify live mainnet creator-share-hook bytecode.
 *
 *   pnpm -C frontend ops:verify-hook-mainnet-bytecode
 *
 * Exit: 0 = canonical, 2 = legacy, 1 = error/unclassified
 */

import {
  inspectHookMainnetBytecode,
  recommendedHookIxSchema,
} from './hookBytecodeClassify.js'

declare const process: {
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

function main(): void {
  try {
    const report = inspectHookMainnetBytecode()
    process.stdout.write(`\n=== creator-share-hook mainnet bytecode ===\n`)
    process.stdout.write(`Program: ${report.programId}\n`)
    process.stdout.write(`RPC: ${report.rpcUrl}\n\n`)
    process.stdout.write(`${report.programShow}\n\n`)
    process.stdout.write(`Dump bytes: ${report.dumpBytes ?? 'n/a'}\n`)
    process.stdout.write(`Classification: ${report.kind}\n`)
    process.stdout.write(`Recommended SOLANA_HOOK_IX_SCHEMA: ${recommendedHookIxSchema(report.kind)}\n`)

    if (report.kind === 'canonical') {
      process.stdout.write('\nPASS: live program uses relay_entries / settle_fees\n')
      process.exit(0)
    }
    if (report.kind === 'legacy') {
      process.stderr.write('\nPARTIAL: live program still uses drain_entries / flush_fees — upgrade required\n')
      process.stderr.write('Run: bash programs/creator-share-hook/scripts/upgrade-mainnet.sh\n')
      process.exit(2)
    }

    process.stderr.write('\nFAIL: could not classify bytecode strings\n')
    process.exit(1)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`verify-hook-mainnet-bytecode failed: ${message}\n`)
    process.exit(1)
  }
}

main()
