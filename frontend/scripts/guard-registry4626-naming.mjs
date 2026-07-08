#!/usr/bin/env node
/**
 * Guard: block re-introduction of wrong 4626 suffix naming on shared infra types.
 *
 * Canonical names use the *4626 suffix*:
 *   Registry4626, IRegistry4626
 *   LotteryManager4626, ILotteryManager4626
 *   VRFConsumer4626
 *
 * Forbidden in active paths:
 *   - 4626Registry / I4626Registry*
 *   - CreatorRegistry*, CreatorLotteryManager, CreatorVRFConsumer*
 *   - 4626LotteryManager / 4626VRFConsumer prefix artifact paths
 *
 * Run: pnpm -C frontend guard:registry4626-naming
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const SCAN_PATHS = [
  join(REPO_ROOT, 'contracts'),
  join(REPO_ROOT, 'script'),
  join(REPO_ROOT, 'kpr'),
  join(REPO_ROOT, 'test'),
  join(REPO_ROOT, 'frontend', 'src'),
  join(REPO_ROOT, 'frontend', 'server'),
  join(REPO_ROOT, 'frontend', 'api'),
  join(REPO_ROOT, 'frontend', 'scripts'),
  join(REPO_ROOT, 'docs', 'reference'),
  join(REPO_ROOT, 'README.md'),
  join(REPO_ROOT, 'AGENTS.md'),
  join(REPO_ROOT, 'deployments'),
  join(REPO_ROOT, '.env.example'),
  join(ROOT, '.env.example'),
]

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  'out',
  'cache',
  'lib',
  'archives',
  '__tests__',
  'snapshots',
  'test-ledger',
])

const ALLOWLIST_SUFFIXES = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.sol',
  '.md',
  '.json',
  '.sh',
  '.sql',
  '.example',
])

const ALLOWLIST_RELATIVE = new Set([
  'frontend/scripts/guard-registry4626-naming.mjs',
  'frontend/scripts/guard-registry4626-naming.test.mjs',
  'docs/architecture/contracts-folder-optimization-proposal.md',
])

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(entry.name)) continue
      walk(full, out)
      continue
    }
    const rel = relative(REPO_ROOT, full).replaceAll('\\', '/')
    if (ALLOWLIST_RELATIVE.has(rel)) continue
    const dot = rel.lastIndexOf('.')
    const suffix = dot >= 0 ? rel.slice(dot) : ''
    if (suffix && !ALLOWLIST_SUFFIXES.has(suffix)) continue
    out.push(full)
  }
}

function collectFiles() {
  const files = []
  for (const path of SCAN_PATHS) {
    try {
      const st = statSync(path)
      if (st.isDirectory()) walk(path, files)
      else files.push(path)
    } catch {
      // optional path
    }
  }
  return files
}

function stripAllowed4626SuffixTokens(line) {
  return line
    .replaceAll('IRegistry4626', '')
    .replaceAll('Registry4626', '')
    .replaceAll('REGISTRY_4626', '')
    .replaceAll('ILotteryManager4626', '')
    .replaceAll('LotteryManager4626', '')
    .replaceAll('VRFConsumer4626', '')
}

function findViolations(content) {
  const hits = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    const stripped = stripAllowed4626SuffixTokens(line)

    if (/\b4626Registry\b/i.test(stripped)) {
      hits.push({ lineNo, reason: 'use Registry4626 (4626 suffix), not 4626Registry prefix', line })
    }
    if (/\b(?:DEFAULT|BASE_MAINNET)_4626_REGISTRY\b/.test(line)) {
      hits.push({ lineNo, reason: 'use *_REGISTRY_4626 constant naming', line })
    }
    if (/\bget4626Registry[A-Za-z0-9_]*/.test(line)) {
      hits.push({ lineNo, reason: 'use getRegistry4626* helper naming', line })
    }
    if (/\bSeed4626Registry\b/.test(line)) {
      hits.push({ lineNo, reason: 'use SeedRegistry4626 / SeedCreatorRegistry script naming', line })
    }
    if (/\bI4626Registry(?:\.sol|[A-Za-z0-9_]*)?\b/.test(line)) {
      hits.push({ lineNo, reason: 'use IRegistry4626 (4626 suffix), not I4626Registry prefix', line })
    }
    if (/\bCreatorRegistry\.sol\b/.test(line)) {
      hits.push({ lineNo, reason: 'contract file must be Registry4626.sol', line })
    }
    if (/\b(?:4626Registry|CreatorRegistry)\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be Registry4626.json', line })
    }
    if (/\|\s*CreatorRegistry\s*\|/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use Registry4626', line })
    }
    if (/\bCreatorLotteryManager\b/.test(line)) {
      hits.push({ lineNo, reason: 'use LotteryManager4626 (4626 suffix)', line })
    }
    if (/\bCreatorVRFConsumer(?:V2_5)?\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VRFConsumer4626 (4626 suffix)', line })
    }
    if (/\bICreatorVRFConsumer[A-Za-z0-9_]*/.test(line)) {
      hits.push({ lineNo, reason: 'use IVRFConsumer4626* interface naming', line })
    }
    if (/\b4626LotteryManager\b/.test(line)) {
      hits.push({ lineNo, reason: 'use LotteryManager4626.json / LotteryManager4626.sol', line })
    }
    if (/\b4626VRFConsumer\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VRFConsumer4626.json / VRFConsumer4626.sol', line })
    }
    if (/\bCreatorLotteryManager\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be LotteryManager4626.json', line })
    }
    if (/\bCreatorVRFConsumer(?:V2_5)?\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be VRFConsumer4626.json', line })
    }
    if (/\|\s*CreatorLotteryManager\s*\|/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use LotteryManager4626', line })
    }
    if (/\|\s*CreatorVRFConsumer/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use VRFConsumer4626', line })
    }
  }
  return hits
}

function main() {
  const files = collectFiles()
  const failures = []

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/')
    const content = readFileSync(file, 'utf8')
    const hits = findViolations(content)
    for (const hit of hits) {
      failures.push({ rel, ...hit })
    }
  }

  if (failures.length === 0) {
    console.log('registry4626 naming guard passed')
    return
  }

  console.error(`registry4626 naming guard failed (${failures.length} hit(s)):`)
  for (const failure of failures) {
    console.error(`  ${failure.rel}:${failure.lineNo} — ${failure.reason}`)
    console.error(`    ${failure.line.trim()}`)
  }
  process.exit(1)
}

main()
