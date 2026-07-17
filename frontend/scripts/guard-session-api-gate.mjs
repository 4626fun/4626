#!/usr/bin/env node
/**
 * Guard: cookie-backed session APIs must not be gated on wagmi connect + isSignedIn.
 *
 * `isSignedIn` in useSiweAuth means walletMatchesSession, not "logged in".
 * Use `canUseSessionApi` from `src/lib/auth/sessionApiGate.ts` instead.
 *
 * Run: pnpm -C frontend guard:session-api-gate
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { reportGuard } from './guard-utils.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCAN_DIR = join(ROOT, 'src')

const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', '.git'])
const SOURCE_FILE_RE = /\.(ts|tsx)$/i
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/i

/** Query/mutation enable patterns that conflate wallet connect with session. */
const FORBIDDEN_ENABLED = [
  /enabled\s*:\s*isConnected\s*&&\s*isSignedIn\b/,
  /enabled\s*:\s*isSignedIn\s*&&\s*isConnected\b/,
  /enabled\s*:\s*Boolean\(\s*isConnected\s*&&\s*isSignedIn\s*\)/,
  /enabled\s*:\s*Boolean\(\s*isSignedIn\s*&&\s*isConnected\s*\)/,
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIR_NAMES.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
      continue
    }
    if (!SOURCE_FILE_RE.test(name) || TEST_FILE_RE.test(name)) continue
    out.push(full)
  }
  return out
}

function main() {
  const violations = []

  for (const file of walk(SCAN_DIR)) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    const text = readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const re of FORBIDDEN_ENABLED) {
        if (!re.test(line)) continue
        violations.push({
          rule: 'no-isConnected-and-isSignedIn-enabled',
          file: rel,
          line: i + 1,
          specifier: line.trim(),
        })
      }
    }
  }

  const code = reportGuard({
    guard: 'session-api-gate',
    violations,
    checks: [
      'Scan frontend/src for enabled: isConnected && isSignedIn (and swaps)',
      'Cookie APIs must use canUseSessionApi(sessionHydrated, hasSession)',
    ],
    remediation: [
      'Import canUseSessionApi from @/lib/auth/sessionApiGate',
      'Gate reads with enabled: canUseSessionApi({ sessionHydrated, hasSession })',
      'Reserve isConnected + walletMatchesSession for signing/tx paths only',
    ],
  })
  process.exit(code)
}

main()
