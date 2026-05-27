#!/usr/bin/env node
/**
 * Read-only: classify live mainnet creator-share-hook bytecode (legacy vs canonical ix names).
 *
 *   pnpm -C frontend ops:verify-hook-mainnet-bytecode
 *
 * Exit: 0 = canonical (relay_entries), 2 = legacy (drain/flush), 1 = error/unclassified
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const PROGRAM_ID = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'
const RPC_URL = process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com'

function runSolana(args: string[]): string {
  return execFileSync('solana', args, { encoding: 'utf8' }).trim()
}

function classifyDump(text: string): 'canonical' | 'legacy' | 'unknown' {
  const hasCanonical = /relay_entries|RelayEntries|settle_fees|SettleFees/.test(text)
  const hasLegacy = /drain_entries|DrainEntries|flush_fees|FlushFees/.test(text)
  if (hasCanonical && !hasLegacy) return 'canonical'
  if (hasLegacy && !hasCanonical) return 'legacy'
  if (hasCanonical && hasLegacy) return 'unknown'
  return 'unknown'
}

function main(): void {
  try {
    execFileSync('solana', ['--version'], { stdio: 'pipe' })
  } catch {
    process.stderr.write('solana CLI not on PATH\n')
    process.exit(1)
  }

  process.stdout.write(`\n=== creator-share-hook mainnet bytecode ===\n`)
  process.stdout.write(`Program: ${PROGRAM_ID}\n`)
  process.stdout.write(`RPC: ${RPC_URL}\n\n`)

  const show = runSolana(['program', 'show', PROGRAM_ID, '--url', RPC_URL])
  process.stdout.write(`${show}\n\n`)

  const dir = mkdtempSync(join(tmpdir(), 'hook-bytecode-'))
  const dumpPath = join(dir, 'creator_share_hook.so')
  try {
    runSolana(['program', 'dump', PROGRAM_ID, dumpPath, '--url', RPC_URL])
    const blob = readFileSync(dumpPath)
    const stringsOut = execFileSync('strings', [dumpPath], { encoding: 'utf8' })
    const kind = classifyDump(stringsOut)

    process.stdout.write(`Dump: ${dumpPath} (${blob.length} bytes)\n`)
    process.stdout.write(`Classification: ${kind}\n`)

    if (kind === 'canonical') {
      process.stdout.write('\nPASS: live program uses relay_entries / settle_fees\n')
      process.exit(0)
    }
    if (kind === 'legacy') {
      process.stderr.write('\nPARTIAL: live program still uses drain_entries / flush_fees — upgrade required\n')
      process.stderr.write('Run: bash programs/creator-share-hook/scripts/upgrade-mainnet.sh\n')
      process.exit(2)
    }

    process.stderr.write('\nFAIL: could not classify bytecode strings\n')
    process.exit(1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main()
