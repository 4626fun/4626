#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const srcRoot = path.join(repoRoot, 'src')
const exts = new Set(['.ts', '.tsx'])

const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

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
    out.push(full)
  }
  return out
}

function isUiFile(relPath) {
  return relPath.startsWith('components/ui/')
}

function importsFromFeatures(specifier) {
  return (
    specifier.startsWith('@/features/') ||
    /\.\.\/(\.\.\/)*features\//.test(specifier)
  )
}

async function main() {
  const violations = []
  const files = await walk(srcRoot)

  for (const filePath of files) {
    const relFromSrc = path.relative(srcRoot, filePath).replace(/\\/g, '/')
    if (!isUiFile(relFromSrc)) continue
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (!importsFromFeatures(specifier)) continue
      violations.push({
        file: path.relative(repoRoot, filePath),
        specifier,
      })
    }
  }

  if (violations.length === 0) {
    console.log('ok: src/components/ui does not import from src/features')
    return
  }

  console.error('error: src/components/ui must not import from src/features (ui is design-system-only):')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.specifier}`)
  }
  console.error('move shared primitives into src/components/ui or invert the dependency so features consume ui, not the other way around.')
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
})
