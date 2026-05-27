#!/usr/bin/env node
/**
 * Pipe B (Phase B2 lottery) devnet rehearsal — hook + relay_entries path.
 *
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --live-devnet
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --skip-cost-probe
 *
 * Validates Part B lottery plumbing (Transfer Hook PendingEntries → keeper relay)
 * without conflating Pipe A LZ share mesh (see ops:pipe-a-devnet-rehearsal).
 *
 * Live devnet hook steps require SOLANA_PRIVATE_KEY + paid devnet RPC; hook program
 * is not on devnet at mainnet id — set COST_PROBE_HOOK_PROGRAM_KEYPAIR for deploy.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const HOOK_CRATE = resolve(REPO_ROOT, 'programs/creator-share-hook')

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function runStep(label: string, command: string, args: string[], cwd: string, env?: Record<string, string>): boolean {
  process.stdout.write(`\n=== ${label} ===\n`)
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    process.stderr.write(`\n[fail] ${label} (exit ${result.status ?? 'unknown'})\n`)
    return false
  }
  process.stdout.write(`[ok] ${label}\n`)
  return true
}

function usage(): void {
  process.stdout.write(`Pipe B devnet rehearsal (B2 lottery path)

Usage:
  pnpm -C frontend ops:pipe-b-devnet-rehearsal [options]

Options:
  --skip-rust            Skip creator-share-hook Rust unit tests
  --skip-kpr             Skip kpr vitest (relay buffer + discriminator tests)
  --skip-cost-probe      Skip live devnet hook mint + PDA cost probe (default offline)
  --live-devnet          Run cost-probe hook path on devnet (needs funded payer + hook deploy)
  --help                 Show this help

Policy: docs/operations/solana-share-mesh-lottery-policy.md (B1 vs B2)
Keeper: canonical ix names relay_entries / settle_fees (SOLANA_HOOK_IX_SCHEMA=legacy only for rollback)
`)
}

function main(): void {
  if (hasFlag('--help')) {
    usage()
    return
  }

  let failed = false

  if (!hasFlag('--skip-rust')) {
    const ok = runStep(
      'Rust PendingEntries + execute_hook unit tests',
      'cargo',
      ['test', '-p', 'creator-share-hook', 'pending_entries', '--', '--nocapture'],
      HOOK_CRATE,
    )
    if (!ok) failed = true
  }

  if (!hasFlag('--skip-kpr')) {
    const kprDir = resolve(REPO_ROOT, 'kpr')
    const ok = runStep(
      'KPR relay_entries buffer + discriminator tests',
      'pnpm',
      ['exec', 'vitest', 'run', 'tests/keepr-solana-relay-entries.test.ts', 'tests/solana-keeper-orchestrator.test.ts'],
      kprDir,
    )
    if (!ok) failed = true
  }

  const runLive = hasFlag('--live-devnet')
  if (runLive && !hasFlag('--skip-cost-probe')) {
    const kprDir = resolve(REPO_ROOT, 'kpr')
    if (!existsSync(resolve(kprDir, 'package.json'))) {
      process.stderr.write('\n[skip] kpr/ missing — live devnet probe not run\n')
    } else {
      const ok = runStep(
        'Solana devnet B2 hook smoke (Token-2022 mint + PDAs)',
        'pnpm',
        ['solana:cost-probe-devnet'],
        kprDir,
        {
          SKIP_PROGRAM_DEPLOY: '1',
          SKIP_METEORA: '1',
          ...(process.env.SOLANA_RPC_URL ? {} : { SOLANA_RPC_URL: process.env.RPC_URL_SOLANA_TESTNET ?? '' }),
        },
      )
      if (!ok) {
        failed = true
        process.stderr.write(
          '\nLive B2 probe failed — common fixes:\n' +
            '  • Paid devnet RPC in SOLANA_RPC_URL\n' +
            '  • Funded SOLANA_PRIVATE_KEY payer (~2 SOL)\n' +
            '  • COST_PROBE_HOOK_PROGRAM_KEYPAIR for devnet hook deploy at Ejpzi…\n' +
            '  • Or re-run with --skip-cost-probe for offline gates only\n',
        )
      }
    }
  }

  process.stdout.write('\n--- Part B lottery readiness notes ---\n')
  process.stdout.write(
    '• B2 requires Token-2022 + Transfer Hook mint (not Pipe A LZ standard SPL alone)\n' +
      '• Meteora pool buy → hook PendingEntries → relay_entries → Base lottery\n' +
      '• Keepers call relay_entries / settle_fees (redeploy hook before enabling on mainnet)\n' +
      '• Enable relay_entries only after share-mesh pool + hook verified (policy doc)\n',
  )

  if (failed) {
    process.stderr.write('\nPipe B devnet rehearsal: FAIL\n')
    process.exit(1)
  }

  process.stdout.write('\nPipe B devnet rehearsal: PASS (offline + optional live hook smoke)\n')
}

main()
