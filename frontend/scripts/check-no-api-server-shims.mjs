#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const apiRoot = path.join(repoRoot, 'api')
const forbiddenRoot = path.join(apiRoot, 'server')
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue
    out.push(full)
  }
  return out
}

function normalizeFileUrlPath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function toCandidatePaths(basePath) {
  const candidates = [basePath]
  for (const ext of allowedExtensions) {
    candidates.push(`${basePath}${ext}`)
  }
  for (const ext of allowedExtensions) {
    candidates.push(path.join(basePath, `index${ext}`))
  }
  return candidates
}

async function pathExists(candidate) {
  try {
    await fs.stat(candidate)
    return true
  } catch {
    return false
  }
}

async function resolveImportTarget(filePath, specifier) {
  if (!specifier.startsWith('.')) return null
  const basePath = path.resolve(path.dirname(filePath), specifier)
  for (const candidate of toCandidatePaths(basePath)) {
    if (await pathExists(candidate)) return candidate
  }
  return basePath
}

function isWithin(candidate, root) {
  const normalizedCandidate = path.resolve(candidate)
  const normalizedRoot = path.resolve(root)
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  )
}

async function main() {
  const files = await walk(apiRoot)
  const violations = []

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier || !specifier.startsWith('.')) continue
      const resolved = await resolveImportTarget(filePath, specifier)
      if (!resolved) continue
      if (!isWithin(resolved, forbiddenRoot)) continue
      violations.push({
        file: path.relative(repoRoot, filePath),
        specifier,
        resolved: path.relative(repoRoot, resolved),
      })
    }
  }

  if (violations.length === 0) {
    console.log('ok: no imports resolve into frontend/api/server shims')
    return
  }

  console.error('error: found imports resolving into deprecated frontend/api/server shims:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier} -> ${violation.resolved}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
})
