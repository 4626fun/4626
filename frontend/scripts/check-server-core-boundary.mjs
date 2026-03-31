#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const apiRoot = path.join(repoRoot, 'api')
const exts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const bannedPatterns = [
  /server\/auth\/_shared\.js$/,
  /server\/_lib\/agentApiGuard\.js$/,
  /server\/_lib\/contracts\.js$/,
  /server\/_lib\/logger\.js$/,
  /server\/_lib\/postgres\.js$/,
  /server\/_lib\/rateLimit\.js$/,
  /server\/_lib\/requestPrincipal\.js$/,
  /server\/_lib\/session\.js$/,
]

const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function shouldScanFile(filePath) {
  const rel = path.relative(apiRoot, filePath).replace(/\\/g, '/')
  if (rel.startsWith('__tests__/')) return false
  return true
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    if (!exts.has(path.extname(entry.name))) continue
    if (!shouldScanFile(full)) continue
    out.push(full)
  }
  return out
}

function isBannedSpecifier(specifier) {
  return bannedPatterns.some((pattern) => pattern.test(specifier))
}

async function main() {
  const files = await walk(apiRoot)
  const violations = []

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (!isBannedSpecifier(specifier)) continue
      violations.push({
        file: path.relative(repoRoot, filePath),
        specifier,
      })
    }
  }

  if (violations.length === 0) {
    console.log('ok: API runtime files respect server-core boundary')
    return
  }

  console.error('error: direct imports to server-core-owned modules found in API runtime files:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`)
  }
  console.error(
    'use packages/server-core/src/index.js for shared auth/session/contracts/logging/db/rate-limit/request-principal primitives',
  )
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
})
