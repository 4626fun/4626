#!/usr/bin/env node
/**
 * Guard: block re-introduction of retired canonical CSW env keys and the
 * pre-migration CSW address in active runtime code.
 *
 * Policy: one canonical parent CSW per account (`CANONICAL_CSW_*` env +
 * `frontend/src/wallet/canonicalWalletPolicy.ts`). Legacy `XMTP_AGENT_CSW_*`,
 * `VITE_AGENT_XMTP_ADDRESS`, and `0x4beabd…04ef` as a live identity must not
 * return to production paths.
 *
 * Run: pnpm -C frontend guard:canonical-csw
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const SCAN_DIRS = [
  join(ROOT, 'src'),
  join(ROOT, 'server'),
  join(ROOT, 'api'),
  join(REPO_ROOT, 'scripts'),
  join(REPO_ROOT, 'kpr'),
]

const ENV_EXAMPLE_FILES = [
  join(ROOT, '.env.example'),
  join(REPO_ROOT, '.env.example'),
]

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  'archives',
  '__tests__',
  'test-ledger',
  'snapshots',
])
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|mjs)$/i

/** Retired env keys — code must not read these via process.env / import.meta.env. */
const RETIRED_ENV_PATTERNS = [
  /process\.env\.XMTP_AGENT_CSW_/,
  /process\.env\[['"]XMTP_AGENT_CSW_/,
  /process\.env\.XMTP_AGENT_PRIVY_WALLET_ID\b/,
  /process\.env\[['"]XMTP_AGENT_PRIVY_WALLET_ID['"]\]/,
  /process\.env\.XMTP_AGENT_CSW_SKIP_CANONICAL\b/,
  /process\.env\.XMTP_AGENT_ADDRESS\b/,
  /process\.env\[['"]XMTP_AGENT_ADDRESS['"]\]/,
  /import\.meta\.env\.VITE_AGENT_XMTP/,
  /import\.meta\.env\[['"]VITE_AGENT_XMTP/,
]

const CANONICAL_SERVER_ENV_READ = /process\.env\.(CANONICAL_CSW_[A-Z0-9_]+)/g
const CANONICAL_CLIENT_ENV_READ = /import\.meta\.env\.(VITE_CANONICAL_CSW_[A-Z0-9_]+)/g

const CANONICAL_SERVER_ENV_ALLOWLIST = new Set([
  'server/_lib/wallet/canonicalCswEnv.ts',
  'server/_lib/wallet/canonicalCswEnv.test.ts',
  'server/_lib/agent/agentRegistration.test.ts',
])

const CANONICAL_CLIENT_ENV_ALLOWLIST = new Set([
  'src/lib/xmtp/agentXmtpAddress.ts',
  'src/lib/xmtp/agentXmtpAddress.test.ts',
])

const RETIRED_ENV_EXAMPLE_RE = /^(?:export\s+)?(XMTP_AGENT_CSW_[A-Z0-9_]+|XMTP_AGENT_PRIVY_WALLET_ID|XMTP_AGENT_ADDRESS|VITE_AGENT_XMTP_ADDRESS)\s*=/

const LEGACY_CSW_LITERAL = /0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef/i

/** Files allowed to reference the pre-migration CSW address (fixtures / migration notes). */
const LEGACY_ADDRESS_ALLOWLIST = new Set([
  'src/wallet/canonicalWalletPolicy.ts',
  'src/lib/wallet/cswOwnerAbi.ts',
  'src/hooks/useAccountMe.canonicalMerge.test.ts',
  'src/lib/relay/goldenRelayPart1Shape.test.ts',
  'server/_lib/relay/buildOwnerMutationRelayFlow.test.ts',
])

function isCommentLine(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')
}

function walk(dir, files = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }
  for (const entry of entries) {
    if (EXCLUDE_DIR_NAMES.has(entry)) continue
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walk(full, files)
    } else if (st.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

function relPath(filePath) {
  const relFromFrontend = relative(ROOT, filePath).split('\\').join('/')
  const relFromRepo = relative(REPO_ROOT, filePath).split('\\').join('/')
  return relFromFrontend.startsWith('..') ? relFromRepo : relFromFrontend
}

export function checkSourceFile(filePath) {
  const rel = relPath(filePath)
  const content = readFileSync(filePath, 'utf8')
  const violations = []

  for (const [index, line] of content.split('\n').entries()) {
    if (isCommentLine(line)) continue

    for (const re of RETIRED_ENV_PATTERNS) {
      if (re.test(line)) {
        if (!TEST_FILE_RE.test(rel)) {
          violations.push({
            rel,
            line: index + 1,
            message: 'retired canonical CSW env read',
            snippet: line.trim().slice(0, 120),
          })
        }
        break
      }
    }

    if (CANONICAL_SERVER_ENV_READ.test(line) && !CANONICAL_SERVER_ENV_ALLOWLIST.has(rel)) {
      CANONICAL_SERVER_ENV_READ.lastIndex = 0
      if (!TEST_FILE_RE.test(rel)) {
        violations.push({
          rel,
          line: index + 1,
          message: 'direct process.env.CANONICAL_CSW_* read (use canonicalCswEnv.ts)',
          snippet: line.trim().slice(0, 120),
        })
      }
    }
    CANONICAL_SERVER_ENV_READ.lastIndex = 0

    if (CANONICAL_CLIENT_ENV_READ.test(line) && !CANONICAL_CLIENT_ENV_ALLOWLIST.has(rel)) {
      CANONICAL_CLIENT_ENV_READ.lastIndex = 0
      if (!TEST_FILE_RE.test(rel)) {
        violations.push({
          rel,
          line: index + 1,
          message: 'direct import.meta.env.VITE_CANONICAL_CSW_* read (use agentXmtpAddress.ts)',
          snippet: line.trim().slice(0, 120),
        })
      }
    }
    CANONICAL_CLIENT_ENV_READ.lastIndex = 0

    if (LEGACY_CSW_LITERAL.test(line)) {
      const allowlisted =
        LEGACY_ADDRESS_ALLOWLIST.has(rel) || TEST_FILE_RE.test(rel)
      if (!allowlisted) {
        violations.push({
          rel,
          line: index + 1,
          message: 'pre-migration CSW address literal (use CANONICAL_CSW_ADDRESS)',
          snippet: line.trim().slice(0, 120),
        })
      }
    }
  }

  return violations
}

export function checkEnvExampleFile(filePath) {
  const rel = relPath(filePath)
  const violations = []
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return violations
  }

  for (const [index, line] of content.split('\n').entries()) {
    if (isCommentLine(line)) continue
    if (RETIRED_ENV_EXAMPLE_RE.test(line.trim())) {
      violations.push({
        rel,
        line: index + 1,
        message: 'retired canonical CSW env key in .env.example (use CANONICAL_CSW_* only)',
        snippet: line.trim().slice(0, 120),
      })
    }
  }

  return violations
}

export function collectCanonicalCswGuardViolations() {
  const files = SCAN_DIRS.flatMap((dir) => walk(dir))
  const violations = files.flatMap(checkSourceFile)
  for (const envExample of ENV_EXAMPLE_FILES) {
    violations.push(...checkEnvExampleFile(envExample))
  }
  violations.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)
  return violations
}

function main() {
  const violations = collectCanonicalCswGuardViolations()

  if (violations.length > 0) {
    console.error('[guard:canonical-csw] Found canonical CSW regressions:')
    for (const v of violations) {
      console.error(`- ${v.rel}:${v.line} ${v.message}`)
      console.error(`    ${v.snippet}`)
    }
    console.error('\nUse CANONICAL_CSW_* / VITE_CANONICAL_CSW_ADDRESS and canonicalWalletPolicy.ts.')
    process.exit(1)
  }

  console.log('[guard:canonical-csw] OK — no retired env reads, stray legacy CSW literals, or env-example drift.')
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectRun) {
  main()
}
