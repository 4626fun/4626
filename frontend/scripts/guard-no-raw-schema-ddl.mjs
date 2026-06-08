#!/usr/bin/env node
/**
 * Guard: prevent re-introduction of raw DDL strings in server code.
 *
 * Part of the 2026 Supabase schema condensation effort.
 * Authoritative schema lives only in supabase/migrations/.
 * Runtime bootstrap must go through schemaBootstrap.ts helpers.
 *
 * Run: pnpm -C frontend guard:schema
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { reportGuard } from './guard-utils.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SERVER_DIR = join(ROOT, 'server')

const PATTERNS = [
  /CREATE TABLE IF NOT EXISTS/i,
  /CREATE SCHEMA IF NOT EXISTS/i,
  /ALTER TABLE .* ADD COLUMN IF NOT EXISTS/i,
]

const EXCLUDE_DIRS = new Set(['__tests__', 'scripts'])
const EXCLUDE_FILES = new Set(['schemaBootstrap.ts'])
const TEST_FILE_RE = /\.test\.(ts|js|mjs)$|\.spec\.(ts|js|mjs)$/i

function walk(dir) {
  const entries = readdirSync(dir)
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry)) files.push(...walk(full))
    } else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.mjs'))) {
      if (!EXCLUDE_FILES.has(entry) && !TEST_FILE_RE.test(entry)) files.push(full)
    }
  }
  return files
}

const violations = []
const files = walk(SERVER_DIR)

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  for (const re of PATTERNS) {
    if (re.test(content)) {
      // Known allowed exception: vector extension setup for agent memory (infrastructure, not app tables)
      if (file.includes('runtimeBridge.ts') && content.includes('extensions.vector')) {
        continue
      }
      const rel = relative(ROOT, file)
      violations.push({
        rule: 'raw-ddl',
        file: rel,
        specifier: re.source,
      })
      break
    }
  }
}

const exitCode = reportGuard({
  guard: 'No raw DDL strings in server production code',
  violations,
  checks: ['All production DDL is delegated through schemaBootstrap and migrations'],
  remediation: [
    'Add tables/columns via supabase/migrations/ first.',
    'Delegate runtime bootstrap through schemaBootstrap.ts.',
  ],
})
process.exit(exitCode)