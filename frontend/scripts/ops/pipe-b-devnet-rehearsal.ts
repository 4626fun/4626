#!/usr/bin/env node
/**
 * Pipe B (Phase B2 lottery) devnet rehearsal — hook + relay_entries path.
 *
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --live-devnet approve
 *   pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --skip-cost-probe
 *
 * Validates Part B lottery plumbing (Transfer Hook PendingEntries → keeper relay)
 * without conflating Pipe A LZ share mesh (see ops:pipe-a-devnet-rehearsal).
 *
 * Live devnet hook steps require SOLANA_PRIVATE_KEY + paid devnet RPC. The
 * canonical hook ID is preferred. A separately built devnet surrogate is
 * permitted only through SOLANA_DEVNET_HOOK_* and never reaches mainnet.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
  --live-devnet approve  Run the mutating cost-probe hook path after explicit approval
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

  const lzTemplate = readFileSync(
    resolve(REPO_ROOT, 'docs/_internal/operations/templates/layerzero-share-mesh.config.ts'),
    'utf8',
  )
  const expectedDvns = ['LayerZero Labs', 'Google', 'Nethermind', 'Horizen', 'Deutsche Telekom']
  const mainnetPoolBlock = lzTemplate.match(
    /MAINNET_BASE_SOLANA_OPTIONAL_DVNS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  )?.[1] ?? ''
  const configuredDvns = [...mainnetPoolBlock.matchAll(/'([^']+)'/g)].map((match) => match[1])
  const hasThreeOfFive =
    lzTemplate.includes('MAINNET_BASE_SOLANA_OPTIONAL_THRESHOLD = 3') &&
    configuredDvns.length === 5 &&
    expectedDvns.every((name) => configuredDvns.includes(name)) &&
    !lzTemplate.includes('MAINNET_BASE_SOLANA_OPTIONAL_THRESHOLD = 6')
  if (!hasThreeOfFive) {
    failed = true
    process.stderr.write('[fail] Base↔Solana LayerZero policy must remain 3-of-5\n')
  } else {
    process.stdout.write('[ok] Base↔Solana LayerZero policy is 3-of-5\n')
  }

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
      ['exec', 'vitest', 'run', 'tests/keepr-solana-lottery-relay.test.ts', 'tests/solana-keeper-orchestrator.test.ts'],
      kprDir,
    )
    if (!ok) failed = true
  }

  const requestedLive = hasFlag('--live-devnet')
  const approvedLive = hasFlag('approve')
  if (requestedLive && !approvedLive) {
    failed = true
    process.stderr.write(
      '\nLive B2 probe not started — pass the explicit approval token `approve` with --live-devnet.\n',
    )
  }
  const runLive = requestedLive && approvedLive
  if (runLive) {
    const devnetRpc =
      process.env.SOLANA_DEVNET_RPC_URL?.trim() ||
      process.env.RPC_URL_SOLANA_TESTNET?.trim() ||
      process.env.SOLANA_RPC_URL?.trim() ||
      ''
    const preflightOk = runStep(
      'Solana devnet rehearsal read-only preflight',
      'pnpm',
      ['ops:preflight-solana-devnet'],
      FRONTEND_ROOT,
      { SOLANA_RPC_URL: devnetRpc },
    )
    if (!preflightOk) {
      failed = true
      process.stderr.write(
        '\nLive B2 probe not started — provide a devnet RPC, funded payer, and either an already deployed canonical hook or COST_PROBE_HOOK_PROGRAM_KEYPAIR.\n',
      )
    }
    if (!failed && process.env.SOLANA_DEVNET_HOOK_PROGRAM_ID?.trim()) {
      const surrogateBytecodeOk = runStep(
        'Devnet surrogate hook exact-byte read-only verification',
        'pnpm',
        ['ops:verify-hook-devnet-surrogate-bytecode'],
        FRONTEND_ROOT,
        { SOLANA_DEVNET_RPC_URL: devnetRpc },
      )
      if (!surrogateBytecodeOk) failed = true
    }
  }
  if (runLive && !failed && !hasFlag('--skip-cost-probe')) {
    const kprDir = resolve(REPO_ROOT, 'kpr')
    if (!existsSync(resolve(kprDir, 'package.json'))) {
      process.stderr.write('\n[skip] kpr/ missing — live devnet probe not run\n')
    } else {
      const ok = runStep(
        'Solana devnet B2 hook smoke (Token-2022 mint + PDAs)',
        'pnpm',
        ['solana:cost-probe-devnet', '--', '--execute'],
        kprDir,
        {
          SKIP_PROGRAM_DEPLOY: '1',
          SKIP_METEORA: '1',
          // KPR accepts this override only after it has classified the RPC as
          // devnet/local. Do not read the generic mainnet-facing env here.
          ...(process.env.SOLANA_DEVNET_HOOK_PROGRAM_ID?.trim()
            ? { SOLANA_HOOK_PROGRAM_ID: process.env.SOLANA_DEVNET_HOOK_PROGRAM_ID.trim() }
            : {}),
          ...(process.env.SOLANA_DEVNET_HOOK_SO_PATH?.trim()
            ? { SOLANA_HOOK_SO_PATH: process.env.SOLANA_DEVNET_HOOK_SO_PATH.trim() }
            : {}),
          // The frontend env intentionally carries mainnet SOLANA_RPC_URL. Never
          // pass it through to a devnet rehearsal; prefer the dedicated key.
          SOLANA_RPC_URL:
            process.env.SOLANA_DEVNET_RPC_URL?.trim() ||
            process.env.RPC_URL_SOLANA_TESTNET?.trim() ||
            process.env.SOLANA_RPC_URL?.trim() ||
            '',
        },
      )
      if (!ok) {
        failed = true
        process.stderr.write(
          '\nLive B2 probe failed — common fixes:\n' +
            '  • Paid devnet RPC in SOLANA_RPC_URL\n' +
            '  • Funded SOLANA_PRIVATE_KEY payer (~2 SOL)\n' +
            '  • COST_PROBE_HOOK_PROGRAM_KEYPAIR for canonical devnet deployment, or SOLANA_DEVNET_HOOK_* for an isolated surrogate\n' +
            '  • Or re-run with --skip-cost-probe for offline gates only\n',
        )
      }
    }
  }

  process.stdout.write('\n--- Part B lottery readiness notes ---\n')
  process.stdout.write(
      '• B2 uses one regular LayerZero Token-2022 OFT mint with TransferHook and zero OFT fee\n' +
      '• Base↔Solana ULN is 3-of-5; re-verify all five DVNs in live metadata before wire\n' +
      '• Finalized logs feed the durable inbox; the ring buffer is reconciliation-only\n' +
      '• lottery_ingest, lottery_submit, and lottery_confirm remain independently default-off\n' +
      '• Devnet and funded mainnet canaries require explicit operator approval\n',
  )

  if (failed) {
    process.stderr.write('\nPipe B devnet rehearsal: FAIL\n')
    process.exit(1)
  }

  process.stdout.write('\nPipe B devnet rehearsal: PASS (offline + optional live hook smoke)\n')
}

main()
