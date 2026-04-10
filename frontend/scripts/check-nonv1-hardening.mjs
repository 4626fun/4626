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
const RETRY_AFTER_LOOKBACK_LINES = 30
const RETRY_AFTER_RE = /retry-after|setRetryAfter|setRateLimitRetryAfter|set[A-Za-z0-9_]*RateLimitHeaders?/i
const MUTATING_METHOD_RE = /\breq\.method\b[\s\S]{0,240}['"`](POST|PUT|PATCH|DELETE)['"`]|['"`](POST|PUT|PATCH|DELETE)['"`][\s\S]{0,240}\breq\.method\b/

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

function isNonV1Handler(relativePath) {
  return relativePath.startsWith('api/_handlers/') && !relativePath.includes('/v1/')
}

function isV1Handler(relativePath) {
  return relativePath.startsWith('api/_handlers/v1/')
}

function isMutatingHandler(sourceText) {
  return MUTATING_METHOD_RE.test(sourceText)
}

function isStatus429Call(node) {
  if (!ts.isCallExpression(node)) return false
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  if (node.expression.name.text !== 'status') return false
  if (node.arguments.length < 1) return false
  const [firstArg] = node.arguments
  return ts.isNumericLiteral(firstArg) && firstArg.text === '429'
}

function unwrap(node) {
  let current = node
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function isReqExpression(node) {
  const unwrapped = unwrap(node)
  return ts.isIdentifier(unwrapped) && unwrapped.text === 'req'
}

function hasReqBodyReference(node) {
  let found = false

  function visit(current) {
    if (found) return
    if (ts.isPropertyAccessExpression(current) && current.name.text === 'body' && isReqExpression(current.expression)) {
      found = true
      return
    }
    if (
      ts.isElementAccessExpression(current) &&
      isReqExpression(current.expression) &&
      ts.isStringLiteral(current.argumentExpression) &&
      current.argumentExpression.text === 'body'
    ) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }

  visit(node)
  return found
}

function hasReadJsonBodyCall(node) {
  let found = false

  function visit(current) {
    if (found) return
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'readJsonBody') {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }

  visit(node)
  return found
}

export function collectNonV1RetryAfterViolationsFromSource(filePath, sourceText) {
  const relative = toPosixRelative(filePath)
  if (!isNonV1Handler(relative)) return []
  if (!sourceText.includes('status(429)')) return []

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines = sourceText.split(/\r?\n/)
  const violations = []

  function visit(node) {
    if (isStatus429Call(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const lineNumber = pos.line + 1
      const startLine = Math.max(1, lineNumber - RETRY_AFTER_LOOKBACK_LINES)
      const window = lines.slice(startLine - 1, lineNumber).join('\n')
      if (!RETRY_AFTER_RE.test(window)) {
        violations.push({
          line: lineNumber,
          message: '429 response is missing nearby Retry-After header handling',
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

export function collectV1MutatingRetryAfterViolationsFromSource(filePath, sourceText) {
  const relative = toPosixRelative(filePath)
  if (!isV1Handler(relative)) return []
  if (!isMutatingHandler(sourceText)) return []
  if (!sourceText.includes('status(429)')) return []

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines = sourceText.split(/\r?\n/)
  const violations = []

  function visit(node) {
    if (isStatus429Call(node)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const lineNumber = pos.line + 1
      const startLine = Math.max(1, lineNumber - RETRY_AFTER_LOOKBACK_LINES)
      const window = lines.slice(startLine - 1, lineNumber).join('\n')
      if (!RETRY_AFTER_RE.test(window)) {
        violations.push({
          line: lineNumber,
          message: 'Mutating v1 429 response is missing nearby Retry-After header handling',
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

export function collectReadJsonBodyReqBodyFallbackViolationsFromSource(filePath, sourceText) {
  const relative = toPosixRelative(filePath)
  if (!relative.startsWith('api/_handlers/')) return []
  if (!sourceText.includes('readJsonBody') || !sourceText.includes('??')) return []

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = []

  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      if (hasReadJsonBodyCall(node.left) && hasReqBodyReference(node.right)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push({
          line: pos.line + 1,
          message: 'readJsonBody(req, ...) must not fall back to req.body via nullish coalescing',
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

export function collectV1ReadJsonBodyViolationsFromSource(filePath, sourceText) {
  const relative = toPosixRelative(filePath)
  if (!isV1Handler(relative)) return []
  if (!isMutatingHandler(sourceText)) return []
  if (!sourceText.includes('readJsonBody(')) return []

  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = []

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'readJsonBody') {
      const firstArg = node.arguments[0]
      if (firstArg && isReqExpression(firstArg)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push({
          line: pos.line + 1,
          message: 'Mutating v1 handlers must use readBoundedJsonObjectBody(req, ...) instead of readJsonBody(req, ...)',
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

export function collectNonV1HardeningViolations({ handlersDir = DEFAULT_HANDLERS_DIR } = {}) {
  const files = walkTsFiles(handlersDir)
  const retryAfterViolations = []
  const v1MutatingRetryAfterViolations = []
  const reqBodyFallbackViolations = []
  const v1ReadJsonBodyViolations = []

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8')
    const relative = toPosixRelative(file)

    for (const violation of collectNonV1RetryAfterViolationsFromSource(file, sourceText)) {
      retryAfterViolations.push({
        file: relative,
        line: violation.line,
        message: violation.message,
      })
    }

    for (const violation of collectV1MutatingRetryAfterViolationsFromSource(file, sourceText)) {
      v1MutatingRetryAfterViolations.push({
        file: relative,
        line: violation.line,
        message: violation.message,
      })
    }

    for (const violation of collectReadJsonBodyReqBodyFallbackViolationsFromSource(file, sourceText)) {
      reqBodyFallbackViolations.push({
        file: relative,
        line: violation.line,
        message: violation.message,
      })
    }

    for (const violation of collectV1ReadJsonBodyViolationsFromSource(file, sourceText)) {
      v1ReadJsonBodyViolations.push({
        file: relative,
        line: violation.line,
        message: violation.message,
      })
    }
  }

  retryAfterViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  v1MutatingRetryAfterViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  reqBodyFallbackViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  v1ReadJsonBodyViolations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

  return {
    retryAfterViolations,
    v1MutatingRetryAfterViolations,
    reqBodyFallbackViolations,
    v1ReadJsonBodyViolations,
  }
}

function main() {
  const printOnly = process.argv.includes('--print-current')
  const handlersDirArg = process.argv
    .find((arg) => arg.startsWith('--handlers-dir='))
    ?.slice('--handlers-dir='.length)

  const handlersDir = handlersDirArg
    ? path.resolve(process.cwd(), handlersDirArg)
    : DEFAULT_HANDLERS_DIR

  const violations = collectNonV1HardeningViolations({ handlersDir })
  if (printOnly) {
    console.log(JSON.stringify(violations, null, 2))
    return
  }

  if (violations.retryAfterViolations.length > 0) {
    console.error('[guard:api-nonv1-hardening] Non-v1 429 responses missing Retry-After:')
    for (const violation of violations.retryAfterViolations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`)
    }
  }

  if (violations.v1MutatingRetryAfterViolations.length > 0) {
    console.error('[guard:api-nonv1-hardening] Mutating v1 429 responses missing Retry-After:')
    for (const violation of violations.v1MutatingRetryAfterViolations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`)
    }
  }

  if (violations.reqBodyFallbackViolations.length > 0) {
    console.error('[guard:api-nonv1-hardening] Unsafe readJsonBody(req) fallback to req.body:')
    for (const violation of violations.reqBodyFallbackViolations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`)
    }
  }

  if (violations.v1ReadJsonBodyViolations.length > 0) {
    console.error('[guard:api-nonv1-hardening] Mutating v1 handlers must use readBoundedJsonObjectBody:')
    for (const violation of violations.v1ReadJsonBodyViolations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`)
    }
  }

  if (
    violations.retryAfterViolations.length > 0 ||
    violations.v1MutatingRetryAfterViolations.length > 0 ||
    violations.reqBodyFallbackViolations.length > 0 ||
    violations.v1ReadJsonBodyViolations.length > 0
  ) {
    process.exit(1)
  }

  console.log('[guard:api-nonv1-hardening] OK')
}

if (IS_DIRECT_RUN) {
  main()
}
