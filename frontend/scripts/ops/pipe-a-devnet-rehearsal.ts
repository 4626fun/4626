#!/usr/bin/env node
/**
 * Pipe A devnet rehearsal — fast local gates before mainnet LZ + setSolanaShareOftPeer.
 *
 *   pnpm -C frontend ops:pipe-a-devnet-rehearsal
 *   pnpm -C frontend ops:pipe-a-devnet-rehearsal -- --skip-cost-probe
 *   pnpm -C frontend ops:pipe-a-devnet-rehearsal -- --peer 0x<64-hex-oft-store-peer>
 *
 * What this runs:
 * 1. Forge ShareOftPeer wiring tests (Base batcher finalize peer logic)
 * 2. Vitest shareBridgeOftWiring + finalizeShareBridgeFee suites
 * 3. Optional kpr cost-probe on Solana devnet (rent rehearsal; not a real LZ OFT)
 *
 * Full LZ OFT store + peer bytes32 still requires LayerZero create-lz-oapp (see --help).
 * Devnet peer (EID 40168) must never be written to mainnet batcher (EID 30168).
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  cwd: () => string
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')

const SOLANA_DEVNET_EID = 40168
const SOLANA_MAINNET_EID = 30168

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

function assertPeerBytes32(raw: string): string {
  const value = raw.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`Invalid --peer: expected 0x + 64 hex chars, got ${raw}`)
  }
  if (value === `0x${'00'.repeat(32)}`) {
    throw new Error('--peer must be non-zero')
  }
  return value
}

function usage(): void {
  process.stdout.write(`Pipe A devnet rehearsal

Usage:
  pnpm -C frontend ops:pipe-a-devnet-rehearsal [options]

Options:
  --skip-forge           Skip forge ShareOftPeer wiring tests
  --skip-vitest          Skip vitest wiring/fee suites
  --skip-cost-probe      Skip kpr solana:cost-probe-devnet
  --peer <bytes32>       Validate an OFT store peer from LayerZero devnet create
  --help                 Show this help

Env (cost probe):
  SOLANA_PRIVATE_KEY or COST_PROBE_KEYPAIR — devnet payer (avoid random /tmp keypair)
  SOLANA_RPC_URL or RPC_URL_SOLANA_TESTNET — prefer paid devnet RPC (public URL 429s)

After rehearsal passes, deploy real LZ OFT on devnet:
  pnpm dlx create-lz-oapp@latest --ci -d /tmp/4626-oft-devnet -e oft-solana -p pnpm
  # then: anchor build, solana program deploy -ud, hardhat lz:oft:solana:create --eid ${SOLANA_DEVNET_EID}

Mainnet cutover (separate): setSolanaShareOftPeer with EID ${SOLANA_MAINNET_EID} peer only.
See docs/operations/solana-share-mesh-budget-paths.md and batcher-pipe-a-cutover.md
`)
}

function main(): void {
  if (hasFlag('--help')) {
    usage()
    return
  }

  const peerRaw = getArg('--peer', '')
  if (peerRaw) {
    const peer = assertPeerBytes32(peerRaw)
    process.stdout.write(`\nPeer format OK: ${peer}\n`)
    process.stdout.write(
      `Reminder: devnet peer (EID ${SOLANA_DEVNET_EID}) is for rehearsal only — mainnet batcher needs EID ${SOLANA_MAINNET_EID} peer.\n`,
    )
  }

  let failed = false

  if (!hasFlag('--skip-forge')) {
    const ok = runStep(
      'Forge ShareOftPeer wiring',
      'forge',
      ['test', '--match-path', 'test/DeploymentBatcher.ShareOftPeerWiring.t.sol'],
      REPO_ROOT,
    )
    if (!ok) failed = true
  }

  if (!hasFlag('--skip-vitest')) {
    const ok = runStep(
      'Vitest share bridge wiring',
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        'src/lib/deploy/shareBridgeOftWiring.test.ts',
        'src/lib/deploy/finalizeShareBridgeFee.test.ts',
      ],
      FRONTEND_ROOT,
    )
    if (!ok) failed = true
  }

  if (!hasFlag('--skip-cost-probe')) {
    const kprDir = resolve(REPO_ROOT, 'kpr')
    if (!existsSync(resolve(kprDir, 'package.json'))) {
      process.stderr.write('\n[skip] kpr/ missing — cost probe not run\n')
    } else {
      const ok = runStep(
        'Solana devnet cost probe (Path 1 rent proxy)',
        'pnpm',
        ['solana:cost-probe-devnet'],
        kprDir,
        {
          SKIP_HOOK: '1',
          SKIP_METEORA: '1',
          ...(process.env.SOLANA_RPC_URL ? {} : { SOLANA_RPC_URL: process.env.RPC_URL_SOLANA_TESTNET ?? '' }),
        },
      )
      if (!ok) {
        failed = true
        process.stderr.write(
          '\nCost probe failed — common fixes:\n' +
            '  • Set SOLANA_RPC_URL or RPC_URL_SOLANA_TESTNET to a paid devnet endpoint (public RPC 429s)\n' +
            '  • Set SOLANA_PRIVATE_KEY to a funded devnet payer\n' +
            '  • Or: solana-test-validator + SOLANA_RPC_URL=http://127.0.0.1:8899\n' +
            '  • Re-run with --skip-cost-probe to finish Base-side checks only\n',
        )
      }
    }
  }

  process.stdout.write('\n--- Next (manual LZ devnet, ~6 min anchor build) ---\n')
  process.stdout.write(
    `pnpm dlx create-lz-oapp@latest --ci -d /tmp/4626-oft-devnet -e oft-solana -p pnpm\n` +
      `# .env: SOLANA_PRIVATE_KEY + RPC_URL_SOLANA_TESTNET\n` +
      `# anchor build → solana program deploy -ud → hardhat lz:oft:solana:create --eid ${SOLANA_DEVNET_EID}\n` +
      `# Then validate: pnpm -C frontend ops:pipe-a-devnet-rehearsal -- --peer 0x<oft-store-peer>\n`,
  )

  if (failed) {
    process.stderr.write('\nPipe A devnet rehearsal: FAIL (see steps above)\n')
    process.exit(1)
  }

  process.stdout.write('\nPipe A devnet rehearsal: PASS (Base wiring + optional devnet cost probe)\n')
}

main()
