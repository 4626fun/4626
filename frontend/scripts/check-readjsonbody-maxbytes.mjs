#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const HANDLERS_DIR = path.join(ROOT_DIR, 'api', '_handlers')

// Existing debt budget by file. CI fails only when a file exceeds its budget
// or when a new file introduces an unbounded readJsonBody(req) call.
const BASELINE_DEBT_BUDGET = {}

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

function isMutatingHandler(sourceText) {
  return MUTATING_METHOD_RE.test(sourceText)
}

function callHasMaxBytesArg(sourceText, argNode) {
  if (!argNode) return false
  const text = sourceText.slice(argNode.getStart(), argNode.getEnd())
  return text.includes('maxBytes')
}

function collectViolations(filePath, sourceText) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = []

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'readJsonBody') {
      const firstArg = node.arguments[0]
      if (!firstArg || !ts.isIdentifier(firstArg) || firstArg.text !== 'req') {
        return ts.forEachChild(node, visit)
      }
      const secondArg = node.arguments[1]
      if (!callHasMaxBytesArg(sourceText, secondArg)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push({
          line: pos.line + 1,
          column: pos.character + 1,
        })
      }
    }
    return ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return violations
}

function main() {
  const printOnly = process.argv.includes('--print-current')
  const files = walkTsFiles(HANDLERS_DIR)
  const debtByFile = new Map()
  const detailedViolations = []

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8')
    if (!isMutatingHandler(sourceText)) continue
    const violations = collectViolations(file, sourceText)
    if (violations.length === 0) continue
    const relative = toPosixRelative(file)
    debtByFile.set(relative, violations.length)
    for (const v of violations) {
      detailedViolations.push(`${relative}:${v.line}:${v.column}`)
    }
  }

  const sortedDebt = Object.fromEntries(
    [...debtByFile.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  )

  if (printOnly) {
    console.log(JSON.stringify(sortedDebt, null, 2))
    return
  }

  const errors = []
  for (const [file, count] of debtByFile.entries()) {
    const budget = BASELINE_DEBT_BUDGET[file]
    if (typeof budget !== 'number') {
      errors.push(`${file}: ${count} unbounded readJsonBody(req) call(s) (new file not in baseline)`)
      continue
    }
    if (count > budget) {
      errors.push(`${file}: ${count} unbounded call(s) exceeds baseline budget ${budget}`)
    }
  }

  if (errors.length > 0) {
    console.error('[guard:readjsonbody-maxbytes] Detected regressions:')
    for (const err of errors) {
      console.error(`- ${err}`)
    }
    console.error('\nCurrent violating call-sites:')
    for (const item of detailedViolations.sort()) {
      console.error(`- ${item}`)
    }
    process.exit(1)
  }

  const reducedDebt = []
  for (const [file, budget] of Object.entries(BASELINE_DEBT_BUDGET)) {
    const current = debtByFile.get(file) ?? 0
    if (current < budget) {
      reducedDebt.push(`${file}: baseline ${budget} -> current ${current}`)
    }
  }
  if (reducedDebt.length > 0) {
    console.log('[guard:readjsonbody-maxbytes] Debt reduced in some files; consider updating baseline:')
    for (const item of reducedDebt.sort()) {
      console.log(`- ${item}`)
    }
  }

  console.log('[guard:readjsonbody-maxbytes] OK')
}

main()
