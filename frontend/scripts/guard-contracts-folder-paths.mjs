#!/usr/bin/env node
/**
 * Guard: block re-introduction of retired contracts/ folder paths after the
 * July 2026 shareoft-mesh + distribution slice.
 *
 * Canonical paths:
 *   shared/shareoft-mesh/{cca,univ4}
 *   shared/vault/recovery/
 *   shared/distribution/
 *   shared/interfaces/shareoft-mesh/
 *
 * Retired (forbidden in active code/docs):
 *   shared/arms/, shared/mesh/, shared/recovery/, shared/vesting/, shared/revenue/
 *   shared/strategies/{cca,univ4,launchpad}/
 *   shared/interfaces/arms/
 *
 * Run: pnpm -C frontend guard:contracts-folder-paths
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
  join(REPO_ROOT, 'frontend', 'skills'),
  join(REPO_ROOT, 'docs', 'reference'),
  join(REPO_ROOT, 'README.md'),
  join(REPO_ROOT, 'AGENTS.md'),
  join(REPO_ROOT, 'contracts', 'README.md'),
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
  '_archive',
  '_generated',
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
  'frontend/scripts/guard-contracts-folder-paths.mjs',
  'frontend/scripts/guard-contracts-folder-paths.test.mjs',
  'docs/architecture/contracts-folder-optimization-proposal.md',
  'contracts/_archive/README.md',
])

const RULES = [
  {
    reason: 'use shared/shareoft-mesh/cca (CCA launch arm), not shared/arms/ or shared/strategies/cca/',
    test: (line) =>
      /(?:@4626\/|contracts\/)shared\/(?:arms\/|strategies\/cca\/)/.test(line),
  },
  {
    reason: 'use shared/shareoft-mesh/univ4 (mesh LP), not shared/mesh/ or shared/strategies/univ4/',
    test: (line) =>
      /(?:@4626\/|contracts\/)shared\/(?:mesh\/|strategies\/univ4\/)/.test(line),
  },
  {
    reason: 'use shared/vault/recovery/, not shared/recovery/',
    test: (line) => /(?:@4626\/|contracts\/)shared\/recovery\//.test(line),
  },
  {
    reason: 'use shared/distribution/, not shared/vesting/ or shared/revenue/',
    test: (line) => /(?:@4626\/|contracts\/)shared\/(?:vesting|revenue)\//.test(line),
  },
  {
    reason: 'LBPStrategyWithTaxHook is archived under contracts/_archive/, not shared/strategies/launchpad/',
    test: (line) =>
      /(?:@4626\/|contracts\/)shared\/strategies\/launchpad\//.test(line),
  },
  {
    reason: 'use shared/interfaces/shareoft-mesh/, not shared/interfaces/arms/',
    test: (line) => /(?:@4626\/|contracts\/)shared\/interfaces\/arms\//.test(line),
  },
]

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

function findViolations(content) {
  const hits = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    if (line.includes('contracts/_archive/') || line.includes('@4626/_archive/')) continue
    for (const rule of RULES) {
      if (rule.test(line)) {
        hits.push({ lineNo, reason: rule.reason, line })
        break
      }
    }
  }
  return hits
}

function main() {
  const files = collectFiles()
  const failures = []

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/')
    if (rel.startsWith('docs/_internal/') || rel.startsWith('docs/audits/')) continue
    if (rel.startsWith('deployments/')) continue
    const content = readFileSync(file, 'utf8')
    const hits = findViolations(content)
    for (const hit of hits) {
      failures.push({ rel, ...hit })
    }
  }

  if (failures.length === 0) {
    console.log('contracts folder paths guard passed')
    return
  }

  console.error(`contracts folder paths guard failed (${failures.length} hit(s)):`)
  for (const failure of failures) {
    console.error(`  ${failure.rel}:${failure.lineNo} — ${failure.reason}`)
    console.error(`    ${failure.line.trim()}`)
  }
  process.exit(1)
}

main()
