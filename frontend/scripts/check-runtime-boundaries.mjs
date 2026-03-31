#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const frontendRoot = path.resolve(process.cwd())
const srcRoot = path.join(frontendRoot, 'src')
const forbiddenFromSrcRoots = [
  path.join(frontendRoot, 'api'),
  path.join(frontendRoot, 'apps', 'api'),
  path.join(frontendRoot, 'server'),
  path.join(frontendRoot, 'services'),
  path.join(frontendRoot, 'packages', 'server-core'),
]
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
      continue
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue
    files.push(full)
  }
  return files
}

function isWithin(candidate, root) {
  const normalizedCandidate = path.resolve(candidate)
  const normalizedRoot = path.resolve(root)
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  )
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

async function pathExists(filePath) {
  try {
    await fs.stat(filePath)
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

async function main() {
  const srcFiles = await walk(srcRoot)
  const violations = []

  for (const filePath of srcFiles) {
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier || !specifier.startsWith('.')) continue
      const resolved = await resolveImportTarget(filePath, specifier)
      if (!resolved) continue

      if (!forbiddenFromSrcRoots.some((root) => isWithin(resolved, root))) continue
      violations.push({
        file: path.relative(frontendRoot, filePath),
        specifier,
        resolved: path.relative(frontendRoot, resolved),
      })
    }
  }

  if (violations.length === 0) {
    console.log('ok: runtime boundaries validated (src has no server/api/service imports)')
    return
  }

  console.error('error: client src imports server-only runtime code:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier} -> ${violation.resolved}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
})
