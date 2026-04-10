#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPLORE_FEATURE_DIR = path.join(ROOT_DIR, 'src', 'features', 'explore')
const EXPLORE_PAGES_DIR = path.join(ROOT_DIR, 'src', 'pages', 'explore')
const ALIAS_OPTION_RE = /\b(sortAliases|timeAliases)\b/
const LEGACY_ALIAS_QUERY_RE = /\bsort=fees24h\b/

function toPosixRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/')
}

function walkFiles(dir) {
  const out = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(full))
      continue
    }
    if (!entry.isFile()) continue
    out.push(full)
  }
  return out
}

function isSourceFile(filePath) {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx')
}

function isExploreTestFile(filePath) {
  return /\.test\.(ts|tsx)$/.test(filePath)
}

export function collectExploreAliasConfigViolationsFromSource(filePath, sourceText) {
  if (!isSourceFile(filePath)) return []
  if (!ALIAS_OPTION_RE.test(sourceText)) return []
  return [{ message: 'Explore URL-state alias options are forbidden (sortAliases/timeAliases)' }]
}

export function collectExploreAliasQueryFixtureViolationsFromSource(filePath, sourceText) {
  if (!isExploreTestFile(filePath)) return []
  if (!LEGACY_ALIAS_QUERY_RE.test(sourceText)) return []
  return [{ message: 'Legacy alias query fixture is forbidden in explore URL-state tests (sort=fees24h)' }]
}

export function collectExploreNoAliasViolations() {
  const files = [...walkFiles(EXPLORE_FEATURE_DIR), ...walkFiles(EXPLORE_PAGES_DIR)]
  const violations = []

  for (const file of files) {
    if (!isSourceFile(file)) continue
    const sourceText = readFileSync(file, 'utf8')
    const relative = toPosixRelative(file)

    for (const violation of collectExploreAliasConfigViolationsFromSource(file, sourceText)) {
      violations.push({
        file: relative,
        message: violation.message,
      })
    }
    for (const violation of collectExploreAliasQueryFixtureViolationsFromSource(file, sourceText)) {
      violations.push({
        file: relative,
        message: violation.message,
      })
    }
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.message.localeCompare(b.message))
  return violations
}

function main() {
  const printOnly = process.argv.includes('--print-current')
  const violations = collectExploreNoAliasViolations()

  if (printOnly) {
    console.log(JSON.stringify(violations, null, 2))
    return
  }

  if (violations.length > 0) {
    console.error('[guard:explore-no-aliases] Found Explore alias regressions:')
    for (const violation of violations) {
      console.error(`- ${violation.file} ${violation.message}`)
    }
    process.exit(1)
  }

  console.log('[guard:explore-no-aliases] OK')
}

if (
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
