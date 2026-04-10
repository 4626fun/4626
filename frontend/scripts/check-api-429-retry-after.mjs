#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HANDLERS_DIR = path.join(ROOT_DIR, 'api', '_handlers')
const LOOKBACK_LINES = 60
const RETRY_AFTER_RE =
  /retry-after|setRetryAfter|setRateLimitRetryAfter|set[A-Za-z0-9_]*RateLimitHeaders?|setRateLimitHeaders?/i

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

function isStatus429Call(node) {
  if (!ts.isCallExpression(node)) return false
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  if (node.expression.name.text !== 'status') return false
  const firstArg = node.arguments[0]
  return Boolean(firstArg && ts.isNumericLiteral(firstArg) && firstArg.text === '429')
}

function isStatusCode429Assignment(node) {
  if (!ts.isBinaryExpression(node)) return false
  if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false
  if (!ts.isPropertyAccessExpression(node.left)) return false
  if (node.left.name.text !== 'statusCode') return false
  return ts.isNumericLiteral(node.right) && node.right.text === '429'
}

function hasRetryAfterNearLine(sourceLines, lineNumber) {
  const startLine = Math.max(1, lineNumber - LOOKBACK_LINES)
  const window = sourceLines.slice(startLine - 1, lineNumber).join('\n')
  return RETRY_AFTER_RE.test(window)
}

export function collectGlobal429RetryAfterViolationsFromSource(filePath, sourceText) {
  if (!toPosixRelative(filePath).startsWith('api/_handlers/')) return []
  if (!sourceText.includes('429')) return []

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines = sourceText.split(/\r?\n/)
  const violations = []

  function recordViolation(node, kind) {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    const lineNumber = pos.line + 1
    if (hasRetryAfterNearLine(lines, lineNumber)) return
    violations.push({
      line: lineNumber,
      message: `${kind} response is missing nearby Retry-After header handling`,
    })
  }

  function visit(node) {
    if (isStatus429Call(node)) {
      recordViolation(node, '429')
    } else if (isStatusCode429Assignment(node)) {
      recordViolation(node, 'statusCode=429')
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

export function collectGlobal429RetryAfterViolations({ handlersDir = HANDLERS_DIR } = {}) {
  const files = walkTsFiles(handlersDir)
  const violations = []

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8')
    const relative = toPosixRelative(file)
    const fileViolations = collectGlobal429RetryAfterViolationsFromSource(file, sourceText)
    for (const violation of fileViolations) {
      violations.push({
        file: relative,
        line: violation.line,
        message: violation.message,
      })
    }
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  return violations
}

function main() {
  const printOnly = process.argv.includes('--print-current')
  const handlersDirArg = process.argv
    .find((arg) => arg.startsWith('--handlers-dir='))
    ?.slice('--handlers-dir='.length)
  const handlersDir = handlersDirArg ? path.resolve(process.cwd(), handlersDirArg) : HANDLERS_DIR

  const violations = collectGlobal429RetryAfterViolations({ handlersDir })

  if (printOnly) {
    console.log(JSON.stringify(violations, null, 2))
    return
  }

  if (violations.length > 0) {
    console.error('[guard:api-429-retry-after] Found 429 responses without nearby Retry-After handling:')
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`)
    }
    process.exit(1)
  }

  console.log('[guard:api-429-retry-after] OK')
}

if (
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
