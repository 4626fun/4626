#!/usr/bin/env node
/**
 * EIP-170 deployability gate with a *bounded* allowlist for known oversize
 * production contracts that are not yet split.
 *
 * Policy:
 * - Default: any contract with runtime size > 24,576 B fails CI.
 * - Allowlisted contracts may exceed 24,576 only up to their maxRuntimeBytes.
 * - Growth past maxRuntimeBytes fails (forces an intentional allowlist bump
 *   or a size split in the same PR).
 * - Compile failures always fail (non-zero forge exit without a size table).
 *
 * Usage:
 *   node scripts/check-eip170-size-gate.mjs
 *   node scripts/check-eip170-size-gate.mjs --from-log /tmp/sizes.txt
 *
 * Env:
 *   FOUNDRY_PROFILE (default: ci when run from GitHub Actions)
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const EIP170 = 24_576

/**
 * Known oversize deployables (measured 2026-07 on FOUNDRY_PROFILE=ci).
 * maxRuntimeBytes = soft ceiling: room for minor optimizer noise, not features.
 * Bump only with a PR note + size budget review (see docs/operations/contract-size-gate.md).
 */
const ALLOWLIST = Object.freeze({
  AgentOracle: 28_700,
  AgentShareOFT: 28_400,
  CreatorShareOFT: 28_000,
  CharmStrategy4626Factory: 25_600,
  CreatorOracle: 24_900,
})

function parseArgs(argv) {
  const out = { fromLog: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--from-log' && argv[i + 1]) {
      out.fromLog = argv[++i]
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`Usage: node scripts/check-eip170-size-gate.mjs [--from-log path]`)
      process.exit(0)
    }
  }
  return out
}

/** @returns {{ name: string, runtime: number }[]} */
function parseSizeTable(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('|') || line.includes('Contract') || line.startsWith('|---')) continue
    const parts = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((p) => p.trim())
    if (parts.length < 2) continue
    // Strip path suffix: "CurrencyLibrary (lib/...)" → keep full name for uniqueness
    let name = parts[0]
    // Drop pure-library noise (runtime ~16)
    const runtimeRaw = parts[1].replace(/,/g, '')
    const runtime = Number(runtimeRaw)
    if (!Number.isFinite(runtime) || runtime <= 0) continue
    // Ignore forge metadata rows
    if (name === 'Contract' || !name) continue
    rows.push({ name, runtime })
  }
  return rows
}

function stripPathSuffix(name) {
  const idx = name.indexOf(' (')
  return idx === -1 ? name : name.slice(0, idx).trim()
}

/**
 * Multi-solc builds (auto_detect_solc + exact-pinned import graphs) emit
 * "<Contract>.<solcVersion>" artifact variants. The allowlist is per contract,
 * not per toolchain, so normalize the suffix away before lookup. Contract
 * identifiers cannot contain dots, so this only ever strips foundry's suffix.
 */
function allowlistKey(base) {
  return base.replace(/\.0\.\d+\.\d+$/, '')
}

function main() {
  const args = parseArgs(process.argv)
  let text
  let forgeExit = 0

  if (args.fromLog) {
    const p = resolve(args.fromLog)
    if (!existsSync(p)) {
      console.error(`::error::size log not found: ${p}`)
      process.exit(2)
    }
    text = readFileSync(p, 'utf8')
  } else {
    const profile = process.env.FOUNDRY_PROFILE || (process.env.CI ? 'ci' : 'default')
    console.log(`Running: FOUNDRY_PROFILE=${profile} forge build --skip test --sizes`)
    const r = spawnSync(
      'forge',
      ['build', '--skip', 'test', '--sizes'],
      {
        encoding: 'utf8',
        env: { ...process.env, FOUNDRY_PROFILE: profile },
        maxBuffer: 32 * 1024 * 1024,
      },
    )
    text = `${r.stdout || ''}\n${r.stderr || ''}`
    forgeExit = r.status ?? 1
    if (r.error) {
      console.error(`::error::failed to spawn forge: ${r.error.message}`)
      process.exit(2)
    }
  }

  const rows = parseSizeTable(text)
  if (rows.length === 0) {
    console.error('::error::No contract size table found (compile failed or unexpected forge output).')
    if (text.trim()) {
      console.error(text.slice(-4000))
    }
    process.exit(forgeExit !== 0 ? forgeExit : 1)
  }

  /** @type {string[]} */
  const hardFails = []
  /** @type {string[]} */
  const allowHits = []
  /** @type {string[]} */
  const allowGrowthFails = []

  for (const { name, runtime } of rows) {
    const base = stripPathSuffix(name)
    if (runtime <= EIP170) continue

    const maxAllowed = ALLOWLIST[allowlistKey(base)]
    if (maxAllowed === undefined) {
      hardFails.push(`${base}: runtime ${runtime} B > EIP-170 ${EIP170} B (not allowlisted)`)
      continue
    }
    if (runtime > maxAllowed) {
      allowGrowthFails.push(
        `${base}: runtime ${runtime} B > allowlist max ${maxAllowed} B (was known-oversize; split or raise cap with size budget review)`,
      )
      continue
    }
    allowHits.push(`${base}: ${runtime} B (allowlisted, max ${maxAllowed} B, over by ${runtime - EIP170} B)`)
  }

  if (allowHits.length) {
    console.log('## Known oversize (allowlisted — report only within cap)')
    for (const line of allowHits) console.log(`  WARN  ${line}`)
  }

  if (hardFails.length || allowGrowthFails.length) {
    console.error('## EIP-170 size gate FAILED')
    for (const line of hardFails) console.error(`  FAIL  ${line}`)
    for (const line of allowGrowthFails) console.error(`  FAIL  ${line}`)
    console.error('')
    console.error('See docs/operations/contract-size-gate.md')
    process.exit(1)
  }

  console.log(`## EIP-170 size gate OK (${rows.length} contracts measured; ${allowHits.length} allowlisted oversize)`)
  // forge may still exit non-zero solely due to allowlisted oversize — we override to 0
  process.exit(0)
}

main()
