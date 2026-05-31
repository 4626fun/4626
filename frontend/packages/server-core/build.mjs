#!/usr/bin/env node
/**
 * Bundler-based build for @4626/server-core.
 *
 * Uses esbuild (already a devDependency of the frontend workspace) to transpile
 * all .ts files in src/ → dist/, preserving module structure.
 *
 * Also emits compiled .js siblings for every `server/**` module that dist/
 * re-exports via relative imports. Without those artifacts, externalized
 * `@4626/server-core` on Vercel resolves `../../../server/*.js` at runtime
 * and crashes the catch-all API bundle.
 */
import { readFileSync, readdirSync, rmSync, mkdirSync, statSync } from 'fs'
import { resolve, dirname, join, relative } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '../..')
const pnpmStore = resolve(frontendRoot, 'node_modules/.pnpm')

let esbuildMain = null
try {
  const entries = readdirSync(pnpmStore)
  for (const entry of entries) {
    if (entry.startsWith('esbuild@')) {
      const candidate = resolve(pnpmStore, entry, 'node_modules/esbuild/lib/main.js')
      if (statSync(candidate, { throwIfNoEntry: false })) {
        esbuildMain = candidate
        break
      }
    }
  }
} catch {}

if (!esbuildMain) {
  throw new Error('Could not locate esbuild in pnpm store. Is it installed in the frontend workspace?')
}

console.log(`[server-core] Using esbuild from: ${esbuildMain}`)
const { build } = await import(pathToFileURL(esbuildMain).href)

const SRC_DIR = resolve(__dirname, 'src')
const OUT_DIR = resolve(__dirname, 'dist')
const SERVER_IMPORT_RE = /from ['"](\.\.\/\.\.\/\.\.\/server\/[^'"]+\.js)['"]/g

function collectTsEntries(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      entries.push(...collectTsEntries(full))
      continue
    }
    if (name.endsWith('.ts')) entries.push(full)
  }
  return entries
}

function collectServerReexportEntryPoints() {
  const entryPoints = new Set()
  for (const file of collectTsEntries(SRC_DIR)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SERVER_IMPORT_RE)) {
      const jsImport = match[1]
      const serverRelative = jsImport.replace(/^\.\.\/\.\.\/\.\.\//, '')
      const tsPath = resolve(frontendRoot, serverRelative.replace(/\.js$/, '.ts'))
      if (!statSync(tsPath, { throwIfNoEntry: false })) {
        throw new Error(`[server-core] Missing server re-export source for ${jsImport} (${tsPath})`)
      }
      entryPoints.add(tsPath)
    }
  }
  return [...entryPoints]
}

console.log('[server-core] Cleaning dist...')
rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const entryPoints = collectTsEntries(SRC_DIR)
console.log(`[server-core] Found ${entryPoints.length} package .ts files to transpile.`)

console.log('[server-core] Running esbuild for package src/ → dist/ (transpile only)...')
await build({
  entryPoints,
  outdir: OUT_DIR,
  outbase: SRC_DIR,
  bundle: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  loader: { '.ts': 'ts' },
  logLevel: 'warning',
})

for (const name of ['packages', 'server', 'src']) {
  const stray = join(OUT_DIR, name)
  if (statSync(stray, { throwIfNoEntry: false })) {
    rmSync(stray, { recursive: true, force: true })
  }
}

const serverEntryPoints = collectServerReexportEntryPoints()
console.log(`[server-core] Emitting ${serverEntryPoints.length} server/*.js runtime siblings for Vercel...`)
for (const tsPath of serverEntryPoints) {
  const jsPath = tsPath.replace(/\.ts$/, '.js')
  if (statSync(jsPath, { throwIfNoEntry: false })) {
    rmSync(jsPath, { force: true })
    const mapPath = `${jsPath}.map`
    if (statSync(mapPath, { throwIfNoEntry: false })) rmSync(mapPath, { force: true })
  }
}
await build({
  entryPoints: serverEntryPoints,
  outdir: frontendRoot,
  outbase: frontendRoot,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  loader: { '.ts': 'ts' },
  packages: 'external',
  allowOverwrite: true,
  logLevel: 'warning',
})

console.log('[server-core] Build finished successfully.')
for (const tsPath of serverEntryPoints.slice(0, 5)) {
  console.log(`            ${relative(frontendRoot, tsPath.replace(/\.ts$/, '.js'))}`)
}
if (serverEntryPoints.length > 5) {
  console.log(`            …and ${serverEntryPoints.length - 5} more`)
}
