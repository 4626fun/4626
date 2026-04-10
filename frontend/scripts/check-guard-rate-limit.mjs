#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_HANDLERS_DIR = path.join(ROOT_DIR, 'api', '_handlers')
const IS_DIRECT_RUN =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

function toPosixRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/')
}

function walkTsFiles(dir) {
  const out = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full))
      continue
    }
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.d.ts')) continue
    out.push(full)
  }
  return out
}

function isIdentifierCall(node, name) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
}

export function collectRateLimitGuardViolationsFromSource(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let hasGuardAgentApiRequest = false
  let hasCheckRateLimit = false
  let hasRateLimitKey = false

  function visit(node) {
    if (isIdentifierCall(node, 'guardAgentApiRequest')) hasGuardAgentApiRequest = true
    if (isIdentifierCall(node, 'checkRateLimit')) hasCheckRateLimit = true
    if (isIdentifierCall(node, 'rateLimitKey')) hasRateLimitKey = true
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)

  if (!hasGuardAgentApiRequest) return null
  const missing = []
  if (!hasCheckRateLimit) missing.push('checkRateLimit')
  if (!hasRateLimitKey) missing.push('rateLimitKey')
  if (missing.length === 0) return null
  return { missing }
}

export function collectRateLimitGuardViolations({ handlersDir = DEFAULT_HANDLERS_DIR } = {}) {
  const files = walkTsFiles(handlersDir)
  const violations = []
  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8')
    const violation = collectRateLimitGuardViolationsFromSource(file, sourceText)
    if (!violation) continue
    violations.push({
      file: toPosixRelative(file),
      missing: violation.missing,
    })
  }
  violations.sort((a, b) => a.file.localeCompare(b.file))
  return violations
}

function main() {
  const printOnly = process.argv.includes('--print-current')
  const handlersDirArg = process.argv
    .find((arg) => arg.startsWith('--handlers-dir='))
    ?.slice('--handlers-dir='.length)

  const handlersDir = handlersDirArg
    ? path.resolve(process.cwd(), handlersDirArg)
    : DEFAULT_HANDLERS_DIR

  const violations = collectRateLimitGuardViolations({ handlersDir })

  if (printOnly) {
    console.log(JSON.stringify(violations, null, 2))
    return
  }

  if (violations.length > 0) {
    console.error('[guard:api-rate-limit-guards] Detected handlers with guardAgentApiRequest but missing rate-limit guard calls:')
    for (const violation of violations) {
      console.error(`- ${violation.file}: missing ${violation.missing.join(', ')}`)
    }
    process.exit(1)
  }

  console.log('[guard:api-rate-limit-guards] OK')
}

if (IS_DIRECT_RUN) {
  main()
}
